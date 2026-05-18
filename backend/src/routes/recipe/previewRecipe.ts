import { randomUUID } from "node:crypto";

import type pg from "pg";

import type { ArtifactSnapshotStrict, OrganizationID } from "@/types";
import {
  type ArtifactPath,
  type Metric,
  type MetricDefinition,
  type MetricRecording,
  MetricValueAggregationRule,
  type RecipeStep,
  RecipeStepInputKind,
  RecipeStepKind,
  RecipeStepOutputKind,
  RecipeStepStatus,
} from "@/types";

import { withPGClient } from "@/server/persistence";
import { CONFIG } from "@/serverInitSetup/config";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { encodeArtifactPathComponents } from "@/model/artifactPath";

import { displayNameForArtifactPath } from "@/routes/org/configuration/loadOrgConfiguration";

import { PreviewRecipeRequestSchema, PreviewRecipeResponseSchema } from "./definitions";
import {
  evaluationServiceModelFromConfiguration,
  recipeEvaluationModelFromEvaluationServiceModel,
  resolveEvaluationModelOverride,
} from "./evaluationModelOverride";
import { type RecipeCreateRequest, type RecipeCreateResponse, RecipeCreateResponseSchema } from "./types";
import { fetchService } from "./utils";

const Constants = {
  create_recipe: {
    model: "", // let the eval service decide the best model to use for creating the recipe
  },
  defaultArtifactPath: [
    { kind: "dataset", id: "" },
    { kind: "artifact", id: "" },
  ],
};

type Generation = {
  orgID: string;
  eventSummaryID: string;
  generationID: string;
  recipeRunID: string;

  clusterID?: string;
  modelID?: string;

  startTimestamp: string;
  endTimestamp: string;

  totalWallDuration?: number;
  totalTokensSent?: number;
  totalTokensGenerated?: number;

  cost?: number;

  totalLLMCalls?: number;
  errors: string[];
};

type EvaluationServiceResponse = {
  value: string;
  evidence: string[];
  generation: Partial<Generation>;
};

const retrieveArtifactSnapshot = async ({
  orgID,
  artifactPath,
  eventSummaryID,
  pgClient,
}: {
  orgID: string;
  artifactPath: ArtifactPath;
  eventSummaryID: string;
  pgClient: pg.ClientBase;
}) => {
  const artifactSnapshotResults = await pgClient.query<{
    snapshot: ArtifactSnapshotStrict;
  }>({
    text: `
        SELECT "snapshot"
          FROM public.artifact_snapshots
          WHERE "org_id" = $1
            AND "artifact_path" = $2
            AND "event_summary_id" = $3;
      `,
    values: [orgID, encodeArtifactPathComponents(artifactPath), eventSummaryID],
  });

  return artifactSnapshotResults.rows.at(0)?.snapshot?.content;
};

function createRecipeSteps({
  orgID,
  basePath,
  evaluateChildArtifactPaths,
  metricDefinitionID,
  nowTimestamp,
  recipeCreateResponse,
  userQuestion,
}: {
  orgID: OrganizationID;
  basePath: ArtifactPath;
  evaluateChildArtifactPaths: ArtifactPath[];
  metricDefinitionID: string;
  nowTimestamp: string;
  recipeCreateResponse: RecipeCreateResponse;
  userQuestion: string;
}): RecipeStep[] {
  return evaluateChildArtifactPaths.map((childArtifactPath) => {
    const childArtifactPathLastID = childArtifactPath.at(-1)?.id;
    const artifactName = displayNameForArtifactPath({ orgID, artifactPath: basePath.concat(childArtifactPath) });

    return {
      id: `eval-${childArtifactPathLastID ?? "artifact"}-${metricDefinitionID}`,
      name: `Evaluate ${artifactName.one}`,
      kind: RecipeStepKind.evaluate,
      status: RecipeStepStatus.enabled,
      creationTimestamp: nowTimestamp,
      updateTimestamp: nowTimestamp,
      dependencies: [],
      inputs: [
        {
          kind: RecipeStepInputKind.artifact,
          token: recipeCreateResponse.prompt.inputName,
          input: {
            childArtifactPath,
            keyPath: "",
          },
        },
      ],
      outputs: [
        {
          kind: RecipeStepOutputKind.metric,
          key: "value",
          output: {
            childArtifactPath: [],
            metricID: metricDefinitionID,
            includeEvidence: true,
          },
        },
      ],
      promptTemplate: recipeCreateResponse.prompt.template,
      userPrompt: userQuestion,
      model: recipeEvaluationModelFromEvaluationServiceModel(recipeCreateResponse.model),
    };
  });
}

export const previewRecipe = new RouteGroup();

previewRecipe.put(
  "preview",
  {
    requestSchema: PreviewRecipeRequestSchema,
    responseSchema: PreviewRecipeResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context) => {
    const orgID = request.orgID.toLowerCase();
    if (!context.user?.organizations.has(orgID)) throw new AuthorizationError();
    const evaluationModelOverride = resolveEvaluationModelOverride({
      requestedEvaluationModelID: request.evaluationModelID,
    });
    const overrideModelForEvaluationService = evaluationModelOverride
      ? evaluationServiceModelFromConfiguration(evaluationModelOverride)
      : undefined;

    const nowTimestamp = new Date().toISOString();

    /*** Mock response if explicitly requested ***/

    if (CONFIG.FAKE_EVAL_SERVICE) {
      const metricDefinitionID = randomUUID();
      const generationID = randomUUID();
      const name = request.metricName ?? "Letter A present Recipe";

      const mockRecipeCreateResponse: RecipeCreateResponse = {
        prompt: {
          inputName: "artifact",
          template: "Does __ARTIFACT__ contain the letter 'a'?",
        },
        model: overrideModelForEvaluationService ?? {
          name: "mock-chat-model",
        },
        metric: {
          name: "Letter A present Recipe",
          kind: "boolean",
        },
      };

      const mockSteps = createRecipeSteps({
        orgID,
        basePath: request.artifactSelectors.at(0)?.artifactPath ?? Constants.defaultArtifactPath,
        evaluateChildArtifactPaths: request.evaluateChildArtifactPaths,
        metricDefinitionID,
        nowTimestamp,
        recipeCreateResponse: mockRecipeCreateResponse,
        userQuestion: request.question,
      });

      return {
        status: "success",
        steps: mockSteps,
        metrics: request.artifactSelectors.map((artifactSelector) => [
          artifactSelector.artifactPath,
          {
            id: metricDefinitionID,
            values: [
              {
                eventSummaryID: artifactSelector.eventSummaryIDs?.at(-1) ?? "",
                generationID,
                value: true,
                examples: request.evaluateChildArtifactPaths.map((childArtifactPath) => ({
                  artifactPath: artifactSelector.artifactPath.concat(childArtifactPath),
                  matchingContent: "a",
                })),
              },
            ],
            isMock: true,
          },
        ]),
        metricDefinition: {
          id: metricDefinitionID,
          name,
          description: request.question,
          kind: "boolean",
          displayValues: [
            [true, "✅"],
            [false, "❌"],
          ],
        },
      };
    }

    /*** Actual response ***/

    // Call eval service to create the recipe
    const recipeCreateInput: RecipeCreateRequest = {
      question: request.question,
      parameters: { model: Constants.create_recipe.model },
    };
    let recipeCreateResponse: RecipeCreateResponse;
    try {
      recipeCreateResponse = await fetchService({
        payload: recipeCreateInput,
        endpoint: `${CONFIG.EVAL_HOST}/recipe/create`,
        responseSchema: RecipeCreateResponseSchema,
      });
    } catch (error) {
      context.logger.error({ error }, "Failed to create recipe");
      return { status: "error", message: "Failed to create recipe" };
    }
    if (overrideModelForEvaluationService) {
      recipeCreateResponse = {
        ...recipeCreateResponse,
        model: overrideModelForEvaluationService,
      };
    }

    const name = request.metricName || recipeCreateResponse.metric.name;

    /// Define the recipe, metric definition, and metrics

    const metricDefinitionID = randomUUID();

    const steps = createRecipeSteps({
      orgID,
      basePath: request.artifactSelectors.at(0)?.artifactPath ?? Constants.defaultArtifactPath,
      evaluateChildArtifactPaths: request.evaluateChildArtifactPaths,
      metricDefinitionID,
      nowTimestamp,
      recipeCreateResponse,
      userQuestion: request.question,
    });

    const metricDefinition: MetricDefinition = {
      id: metricDefinitionID,
      name,
      description: request.question,
      kind: "icon",
      unit: "status",
      metricValueAggregationRule: MetricValueAggregationRule.uniformValues,
      displayValues: [
        [true, "check"],
        [false, "dash"],
        ["mixed", "warning"],
      ],
    };

    /// Call eval service to evaluate the artifacts

    const generationID = randomUUID();
    const evaluationPromises: Promise<[ArtifactPath, Metric]>[] = request.artifactSelectors.map(
      async (artifactSelector) => {
        // Create one request per evaluateChildArtifactPath for this artifactSelector
        const requestsPerChild = request.evaluateChildArtifactPaths.map(async (childPath) => {
          const inputValue = await withPGClient(context, async ({ pgClient }) => {
            return await retrieveArtifactSnapshot({
              orgID: request.orgID.toLocaleLowerCase(),
              artifactPath: artifactSelector.artifactPath.concat(childPath),
              eventSummaryID: artifactSelector.eventSummaryIDs?.at(-1) ?? "",
              pgClient,
            });
          });

          const payload = {
            prompt: {
              template: recipeCreateResponse.prompt.template,
              inputName: recipeCreateResponse.prompt.inputName,
              inputValue,
            },
            model: recipeCreateResponse.model,
            timestamp: new Date().toISOString(),
            // Since this is just a preview, these id's don't really matter
            eventSummaryID: artifactSelector.eventSummaryIDs?.at(-1),
            generationID: generationID,
            orgID: request.orgID,
          };

          const response = await fetchService<EvaluationServiceResponse, typeof payload>({
            payload: payload,
            endpoint: `${CONFIG.EVAL_HOST}/recipe/evaluate`,
          });

          const metricRecording: MetricRecording = {
            eventSummaryID: artifactSelector.eventSummaryIDs?.at(-1) ?? "",
            generationID,
            evaluationGroupID: "00000000-0000-0000-0000-000000000000",
            value: response.value,
            examples: response.evidence.map((exampleContent) => ({
              artifactPath: artifactSelector.artifactPath.concat(childPath),
              matchingContent: exampleContent,
            })),
          };

          return metricRecording;
        });

        const settledResults = await Promise.allSettled(requestsPerChild);
        const recordings: MetricRecording[] = settledResults
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value);

        const result: [ArtifactPath, Metric] = [
          artifactSelector.artifactPath,
          {
            id: metricDefinitionID,
            values: recordings,
          },
        ];

        return result;
      },
    );

    const evaluationResults = await Promise.allSettled(evaluationPromises);
    const metrics: [ArtifactPath, Metric][] = evaluationResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    return {
      status: "success",
      steps,
      metricDefinition,
      metrics,
    };
  },
);
