import { randomUUID } from "node:crypto";

import type pg from "pg";
import type { Logger } from "pino";

import type { ArtifactPath, EvaluationGroupID, EventSummaryID, Recipe } from "@/types";
import {
  RecipeStepInputKind,
  RecipeStepKind,
  RecipeStepOutputKind,
  RecipeStepStatus,
  RecipeTriggerKind,
} from "@/types";

import { submitJob } from "@/lib/submitJob";

import { artifactPathMatchesPattern, encodeArtifactPath } from "@/model/artifactPath";
import { PGEvaluationRunManager } from "@/model/evaluationRun";

import type { RecipeStepEvalInputs } from "@/routes/recipe/types";

type SnapshotSelector = {
  artifactPath: ArtifactPath;
  eventSummaryID: EventSummaryID;
};

export async function scheduleEvaluationsForSelectors({
  orgID,
  selectors,
  context,
}: {
  orgID: string;
  selectors: SnapshotSelector[];
  context: { pgClient: pg.ClientBase; logger: Logger };
}) {
  if (selectors.length === 0) return;

  const logger = context.logger.child({ orgID, selectorCount: selectors.length });

  try {
    const recipeQueryResults = await context.pgClient.query<{ recipe: Recipe }>({
      text: `
        SELECT "recipe"
          FROM public.recipes
          WHERE "org_id" = $1;
      `,
      values: [orgID],
    });

    if (recipeQueryResults.rows.length === 0) return;

    const matchesByRecipeID = new Map<
      string,
      {
        recipe: Recipe;
        targets: Map<string, EvaluationTarget>;
      }
    >();

    for (const row of recipeQueryResults.rows) {
      const recipe = row.recipe;
      if (!recipe || recipe.isDeleted) continue;

      const enabledSteps = recipe.steps.filter((step) => step.status === RecipeStepStatus.enabled);
      if (enabledSteps.length === 0) continue;

      const recipeWithEnabledSteps: Recipe = {
        ...recipe,
        steps: enabledSteps,
      };

      for (const trigger of recipe.triggers ?? []) {
        if (trigger.kind !== RecipeTriggerKind.artifactPath) continue;
        if (!trigger.artifactPathPattern) continue;

        for (const selector of selectors) {
          if (!artifactPathMatchesPattern(selector.artifactPath, trigger.artifactPathPattern)) continue;

          const match =
            matchesByRecipeID.get(recipeWithEnabledSteps.id) ??
            (() => {
              const newMatch = {
                recipe: recipeWithEnabledSteps,
                targets: new Map<string, EvaluationTarget>(),
              };
              matchesByRecipeID.set(recipeWithEnabledSteps.id, newMatch);
              return newMatch;
            })();

          const artifactRootPath = selector.artifactPath.slice(0, trigger.artifactPathPattern.length);
          const key = `${trigger.evaluationGroupID}|${encodeArtifactPath(artifactRootPath)}|${selector.eventSummaryID}`;
          if (match.targets.has(key)) continue;
          match.targets.set(key, {
            artifactPath: artifactRootPath,
            eventSummaryID: selector.eventSummaryID,
            evaluationGroupID: trigger.evaluationGroupID,
          });
        }
      }
    }

    if (matchesByRecipeID.size === 0) return;

    const jobPromises = Array.from(matchesByRecipeID.values(), ({ recipe, targets }) =>
      enqueueEvaluateRecipeSteps({
        orgID,
        recipe,
        targets: Array.from(targets.values()),
        logger,
        context,
      }),
    );

    await Promise.allSettled(jobPromises);
  } catch (error) {
    logger.error({ error }, "Failed to schedule evaluations for selectors.");
  }
}

type EvaluationTarget = {
  artifactPath: ArtifactPath;
  eventSummaryID: EventSummaryID;
  evaluationGroupID: EvaluationGroupID;
};

async function enqueueEvaluateRecipeSteps({
  orgID,
  recipe,
  targets,
  logger,
  context,
}: {
  orgID: string;
  recipe: Recipe;
  targets: EvaluationTarget[];
  logger: Logger;
  context: { pgClient: pg.ClientBase; logger: Logger };
}) {
  const evaluationSteps = recipe.steps.filter((step) => step.kind === RecipeStepKind.evaluate);
  const targetRuns = targets.map((target) => ({ target, recipeRunID: randomUUID() }));

  await PGEvaluationRunManager.persistEvaluationRuns({
    orgID,
    runs: targetRuns.map(({ recipeRunID }) => ({
      evaluationRunID: recipeRunID,
      run: {
        // TODO: Persist modelID and modelParameters
        // modelID: firstStep.model.name,
        // modelParameters: firstStep.model.parameters,
        recipeID: recipe.id,
        stepModels: evaluationSteps.map((step) => ({
          stepID: step.id,
          modelID: step.model.name,
          modelParameters: step.model.parameters,
        })),
      },
    })),
    context: { pgClient: context.pgClient, logger },
  });

  for (const { target, recipeRunID } of targetRuns) {
    const stepPromises = evaluationSteps.map(async (step) => {
      const stepInput = step.inputs.at(0);
      if (
        step.inputs.length !== 1 ||
        !stepInput ||
        stepInput.kind !== RecipeStepInputKind.artifact ||
        stepInput.input.keyPath !== ""
      ) {
        logger.warn(
          { recipeID: recipe.id, stepID: step.id, stepInputs: step.inputs },
          "Skipping evaluation step due to unsupported inputs configuration.",
        );
        return;
      }

      const stepOutput = step.outputs.at(0);
      if (
        step.outputs.length !== 1 ||
        !stepOutput ||
        stepOutput.kind !== RecipeStepOutputKind.metric ||
        !stepOutput.output.includeEvidence
      ) {
        logger.warn(
          { recipeID: recipe.id, stepID: step.id, stepOutputs: step.outputs },
          "Skipping evaluation step due to unsupported outputs configuration.",
        );
        return;
      }

      const inputArtifactPath = target.artifactPath.concat(stepInput.input.childArtifactPath ?? []);
      const outputArtifactPath = target.artifactPath.concat(stepOutput.output.childArtifactPath ?? []);

      const inputs: RecipeStepEvalInputs = {
        input: {
          key: stepInput.token,
          selector: {
            artifactPath: inputArtifactPath,
            eventSummaryIDs: [target.eventSummaryID],
          },
        },
        prompt: step.promptTemplate,
        model: {
          name: step.model.name,
          ...step.model.parameters,
        },
        output: {
          selector: {
            artifactPath: outputArtifactPath,
            eventSummaryIDs: [target.eventSummaryID],
          },
          metricID: stepOutput.output.metricID,
        },
        evaluationGroupID: target.evaluationGroupID,
      };

      const response = await submitJob({
        orgID,
        kind: "evaluateRecipeStep",
        inputs,
        callbackURL: null,
        eventSummaryID: target.eventSummaryID,
        generationID: randomUUID(),
        recipeRunID,
        logger,
      });

      if (response.kind === "error") {
        logger.warn(
          {
            recipeID: recipe.id,
            stepID: step.id,
            error: response.error,
            status: response.status,
          },
          "Failed to enqueue evaluateRecipeStep job.",
        );
      }
    });

    await Promise.allSettled(stepPromises);
  }
}
