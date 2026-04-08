import { randomUUID } from "node:crypto";

import type { Recipe } from "@/types";
import { RecipeStepKind, RecipeStepStatus } from "@/types";

import { withPGClient } from "@/server/persistence";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";
import { submitJob } from "@/lib/submitJob";

import { PGEvaluationRunManager } from "@/model/evaluationRun";

import { RunRecipesRequestSchema, RunRecipesResponseSchema } from "./definitions";
import { recipeEvaluationModelFromConfiguration, resolveEvaluationModelOverride } from "./evaluationModelOverride";

function buildRecipeForRun({
  recipe,
  evaluationModelOverride,
}: {
  recipe: Recipe;
  evaluationModelOverride: ReturnType<typeof resolveEvaluationModelOverride>;
}): Recipe {
  const enabledSteps = recipe.steps.filter((step) => step.status === RecipeStepStatus.enabled);
  if (!evaluationModelOverride) {
    return {
      ...recipe,
      steps: enabledSteps,
    };
  }

  return {
    ...recipe,
    steps: enabledSteps.map((step) => {
      if (step.kind !== RecipeStepKind.evaluate) return step;

      return {
        ...step,
        model: recipeEvaluationModelFromConfiguration(evaluationModelOverride),
      };
    }),
  };
}

export const runRecipes = new RouteGroup();

runRecipes.post(
  "run",
  {
    requestSchema: RunRecipesRequestSchema,
    responseSchema: RunRecipesResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context) => {
    if (!context.user?.organizations.has(request.orgID.toLowerCase())) {
      throw new AuthorizationError();
    }

    const orgID = request.orgID.toLowerCase();
    const evaluationModelOverride = resolveEvaluationModelOverride({
      requestedEvaluationModelID: request.evaluationModelID,
    });

    // Load all recipes matching the IDs in the request
    const recipeQueryResults = await withPGClient(context, async ({ pgClient }) => {
      return await pgClient.query<{ recipe: Recipe }>({
        text: `
          SELECT recipe
            FROM public.recipes
            WHERE "org_id" = $1
            AND "id" = ANY($2);
        `,
        values: [orgID, request.recipeIDs],
      });
    });

    const scheduledRuns = recipeQueryResults.rows.map((row) => {
      const recipeWithEnabledSteps = buildRecipeForRun({
        recipe: row.recipe,
        evaluationModelOverride,
      });
      const evaluationSteps = recipeWithEnabledSteps.steps.filter((step) => step.kind === RecipeStepKind.evaluate);
      const recipeRunID = randomUUID();

      return {
        recipeID: recipeWithEnabledSteps.id,
        recipeWithEnabledSteps,
        recipeRunID,
        persistedRun: {
          evaluationRunID: recipeRunID,
          run: {
            evaluationGroupIDs: request.evaluationGroupIDs,
            // TODO: Persist modelID and modelParameters once we decide how to represent multi-step runs.
            // modelID: firstStep.model.name,
            // modelParameters: firstStep.model.parameters,
            recipeID: recipeWithEnabledSteps.id,
            stepModels: evaluationSteps.map((step) => ({
              stepID: step.id,
              modelID: step.model.name,
              modelParameters: step.model.parameters,
            })),
          },
        },
      };
    });

    await withPGClient(context, async ({ pgClient }) => {
      await PGEvaluationRunManager.persistEvaluationRuns({
        orgID,
        runs: scheduledRuns.map((item) => item.persistedRun),
        context: { pgClient, logger: context.logger },
      });
    });

    // Submit jobs concurrently for all loaded recipes
    const failedRecipeIds: string[] = [];
    const jobPromises = scheduledRuns.map(async (item) => {
      const response = await submitJob({
        orgID: request.orgID,
        kind: "scheduleRecipeEvaluation",
        inputs: {
          recipe: item.recipeWithEnabledSteps,
          evaluationGroupIDs: request.evaluationGroupIDs,
        },
        recipeRunID: item.recipeRunID,
        callbackURL: null,
        logger: context.logger,
      });

      return response;
    });

    const responses = await Promise.all(jobPromises);

    // Collect failures
    for (let i = 0; i < responses.length; i++) {
      if (responses[i].kind !== "success") {
        failedRecipeIds.push(scheduledRuns[i].recipeID);
      }
    }

    if (failedRecipeIds.length > 0) {
      context.logger.error({ failedRecipeIds }, "Failed to submit jobs for these recipes");
      return {
        status: "error",
        message: `Failed to schedule ${failedRecipeIds.length} recipe jobs`,
      };
    }

    return {
      status: "success",
    };
  },
);

export const __visibleForTesting = {
  buildRecipeForRun,
  resolveEvaluationModelOverride,
};
