import type pg from "pg";
import type pino from "pino";

import { Configuration } from "@/server/config";
import { withIdempotentTransaction, withPGClient } from "@/server/persistence";

import { encodeArtifactPathComponents } from "@/model/artifactPath";

import type { ArtifactSelector, ArtifactSnapshotStrict, MetricID, MetricStrict } from "@/generated/backendTypes";
import { throwIfJobCancelled } from "@/jobQueue/cancellation";
import { getJobDeferralFromResponse } from "@/jobQueue/deferred";
import type { EvaluationQueueJobSQLSchema } from "@/jobQueue/types";

type Generation = {
  orgID: string;
  eventSummaryID: string;
  generationID: string;
  recipeRunID: string;

  clusterID?: string;
  modelID: string;
  modelParams?: {
    temperature?: number;
    topP?: number;
    maxNewTokens?: number;
  };

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

export type RecipeStepEvalInputs = {
  input: {
    key: string;
    selector: ArtifactSelector;
  };
  prompt: string;
  model: {
    name: string;
    temperature?: number;
    topP?: number;
    maxNewTokens?: number;
  };
  output: {
    selector: ArtifactSelector;
    metricID: MetricID;
  };
  evaluationGroupID: string;
};

function normalizeModelParams({
  temperature,
  topP,
  maxNewTokens,
}: {
  temperature: number | undefined;
  topP: number | undefined;
  maxNewTokens: number | undefined;
}) {
  const modelParams: NonNullable<Generation["modelParams"]> = {};
  if (typeof temperature === "number" && Number.isFinite(temperature)) modelParams.temperature = temperature;
  if (typeof topP === "number" && Number.isFinite(topP)) modelParams.topP = topP;
  if (typeof maxNewTokens === "number" && Number.isFinite(maxNewTokens)) modelParams.maxNewTokens = maxNewTokens;
  return Object.keys(modelParams).length > 0 ? modelParams : undefined;
}

/**
 * Process an Evaluate Recipe Step job.
 *
 * This job first loads an input, sends it to the eval service, then records the results back to the persistence. If it encounters any non-recoverable issues, it saves an error to the generations table, then returns a suitable object to be returned to the callback URL. If the error is intermittent and the job may be retried, an error is thrown.
 */
export async function processEvaluateRecipeStepJob({
  pgPool,
  logger,
  jobRecord,
}: {
  pgPool: pg.Pool;
  logger: pino.Logger;
  jobRecord: EvaluationQueueJobSQLSchema<RecipeStepEvalInputs>;
}): Promise<{ status: "success" | "failed"; selector: ArtifactSelector; metric: MetricStrict }> {
  const eventSummaryID = jobRecord.event_summary_id;
  const recipeRunID = jobRecord.recipe_run_id;
  const attemptedModelID = jobRecord.inputs.model.name;
  const attemptedModelParams = normalizeModelParams({
    temperature: jobRecord.inputs.model.temperature,
    topP: jobRecord.inputs.model.topP,
    maxNewTokens: jobRecord.inputs.model.maxNewTokens,
  });

  if (!eventSummaryID || !recipeRunID) {
    return {
      status: "failed",
      selector: jobRecord.inputs.input.selector,
      metric: {
        id: jobRecord.inputs.output.metricID,
        values: [],
      },
    };
  }
  const startTimestamp = new Date();
  await throwIfJobCancelled({ pgPool, logger, generationID: jobRecord.generation_id });
  /// Load the input from the persistence.
  const inputValue = await withPGClient({ pgPool, logger }, async ({ pgClient, logger }) => {
    return await withIdempotentTransaction({ pgClient, logger, mode: "readOnly" }, async ({ pgClient, logger }) => {
      const inputLogger = logger.child({
        inputs: jobRecord.inputs,
      });
      inputLogger.info("Loading job input.");

      const artifactSnapshotResults = await pgClient.query<{ snapshot: ArtifactSnapshotStrict }>({
        text: `
          SELECT "snapshot"
            FROM public.artifact_snapshots
            WHERE "org_id" = $1
              AND "artifact_path" = $2
              AND "event_summary_id" = $3;
        `,
        values: [
          jobRecord.org_id,
          encodeArtifactPathComponents(jobRecord.inputs.input.selector.artifactPath),
          eventSummaryID,
        ],
      });

      return artifactSnapshotResults.rows.at(0)?.snapshot?.content;
    });
  });

  /// Make sure we could load a valid string to use as an input.
  if (typeof inputValue !== "string") {
    logger.warn({ inputType: typeof inputValue }, "No valid content found.");
    await recordGeneration({
      pgPool,
      logger,
      startTimestamp,
      generation: {
        orgID: jobRecord.org_id,
        eventSummaryID,
        generationID: jobRecord.generation_id,
        recipeRunID,
        modelID: attemptedModelID,
        modelParams: attemptedModelParams,
        startTimestamp: startTimestamp.toISOString(),
        endTimestamp: new Date().toISOString(),
        errors: ["String-input not found for artifact ID."],
      },
    });
    return {
      status: "failed",
      selector: jobRecord.inputs.input.selector,
      metric: {
        id: jobRecord.inputs.output.metricID,
        values: [],
      },
    };
  }

  /// Ask the eval service to perform the evaluation work.
  const payload = JSON.stringify({
    prompt: {
      template: jobRecord.inputs.prompt,
      inputName: jobRecord.inputs.input.key,
      inputValue,
    },
    model: jobRecord.inputs.model,
    timestamp: new Date().toISOString(),
    eventSummaryID,
    generationID: jobRecord.generation_id,
    orgID: jobRecord.org_id,
  });

  let response: Response;
  for (let attempt = 0; ; attempt += 1) {
    try {
      await throwIfJobCancelled({ pgPool, logger, generationID: jobRecord.generation_id });
      logger.info({ attempt }, "Eval preparing to start…");
      /// Delay the attempt by 10s per attempt. The first attempt will trigger immediately
      await new Promise((resolve) => setTimeout(resolve, attempt * 10 * 1000));
      logger.info({ attempt }, "Eval attempt starting now.");

      response = await fetch(`${Configuration.EVAL_HOST}/recipe/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: payload,
        signal: AbortSignal.timeout(4 * 60 * 1000 * (attempt + 1)),
      });
      break;
    } catch (error) {
      await throwIfJobCancelled({ pgPool, logger, generationID: jobRecord.generation_id });
      logger.error({ error, attempt }, "HTTP error making evaluation.");
      if (attempt >= 3) {
        await recordGeneration({
          pgPool,
          logger,
          startTimestamp,
          generation: {
            orgID: jobRecord.org_id,
            eventSummaryID,
            generationID: jobRecord.generation_id,
            recipeRunID,
            modelID: attemptedModelID,
            modelParams: attemptedModelParams,
            startTimestamp: startTimestamp.toISOString(),
            endTimestamp: new Date().toISOString(),
            errors: ["Failed to evaluate: Reached max attempts."],
          },
        });
        throw new Error("Failed to evaluate: Reached max attempts.");
      }
    }
  }

  /// Make sure we got a valid response back from the eval service.
  await throwIfJobCancelled({ pgPool, logger, generationID: jobRecord.generation_id });
  if (!response.ok) {
    const deferredJob = await getJobDeferralFromResponse(response);
    if (deferredJob) {
      logger.warn(
        {
          retryAfterSeconds: deferredJob.retryAfterSeconds,
          deferUntil: deferredJob.deferUntil.toISOString(),
          code: deferredJob.code,
        },
        "Eval service requested a retryable deferral.",
      );
      throw deferredJob;
    }

    logger.error({ responseStatus: response.status }, "Failed to run eval.");
    await recordGeneration({
      pgPool,
      logger,
      startTimestamp,
      generation: {
        orgID: jobRecord.org_id,
        eventSummaryID,
        generationID: jobRecord.generation_id,
        recipeRunID,
        modelID: attemptedModelID,
        modelParams: attemptedModelParams,
        startTimestamp: startTimestamp.toISOString(),
        endTimestamp: new Date().toISOString(),
        errors: ["Failed to evaluate: Invalid Response."],
      },
    });
    throw new Error("Failed to evaluate: Invalid Response.");
  }
  const evaluationResponse = (await response.json()) as EvaluationServiceResponse;
  const endTimestamp = new Date();
  logger.info("Eval was successful.");
  await throwIfJobCancelled({ pgPool, logger, generationID: jobRecord.generation_id });

  /// Assemble and save the generation data for later access.
  const generation: Generation = {
    errors: [],
    ...evaluationResponse.generation,
    orgID: jobRecord.org_id,
    eventSummaryID,
    generationID: jobRecord.generation_id,
    recipeRunID,
    modelID: evaluationResponse.generation.modelID ?? attemptedModelID,
    modelParams: normalizeModelParams({
      temperature: evaluationResponse.generation.modelParams?.temperature ?? jobRecord.inputs.model.temperature,
      topP: evaluationResponse.generation.modelParams?.topP ?? jobRecord.inputs.model.topP,
      maxNewTokens: evaluationResponse.generation.modelParams?.maxNewTokens ?? jobRecord.inputs.model.maxNewTokens,
    }),
    startTimestamp: startTimestamp.toISOString(),
    endTimestamp: endTimestamp.toISOString(),
  };
  await recordGeneration({ pgPool, logger, startTimestamp, generation });

  /// Update the snapshot with the new metric and generation.
  return await withPGClient({ pgPool, logger }, async ({ pgClient, logger }) => {
    return await withIdempotentTransaction({ pgClient, logger }, async ({ pgClient, logger }) => {
      /// Load the snapshot we are updating, or bail if it no longer exists.
      const encodededArtifactPath = encodeArtifactPathComponents(jobRecord.inputs.output.selector.artifactPath);
      const existingArtifactSnapshotResults = await pgClient.query<{ snapshot: ArtifactSnapshotStrict }>({
        text: `
          SELECT "snapshot"
            FROM public.artifact_snapshots
            WHERE
              "org_id" = $1
              AND "artifact_path" = $2
              AND "event_summary_id" = $3
            FOR UPDATE;
        `,
        values: [jobRecord.org_id, encodededArtifactPath, eventSummaryID],
      });

      const existingArtifactSnapshot = existingArtifactSnapshotResults.rows.at(0)?.snapshot;
      if (!existingArtifactSnapshot) {
        logger.error("Snapshot no longer exists.");
        await recordGeneration({
          pgPool,
          logger,
          startTimestamp,
          generation: {
            ...generation,
            errors: [...generation.errors, "Snapshot no longer exists."],
          },
        });
        return {
          status: "failed",
          selector: jobRecord.inputs.input.selector,
          metric: {
            id: jobRecord.inputs.output.metricID,
            values: [],
          },
        };
      }

      /// Merge generations by GenerationID, then re-order them by date.
      const generationsMap = new Map(
        existingArtifactSnapshot.generations.map((generation) => [generation.generationID, generation]),
      );
      generationsMap.set(jobRecord.generation_id, {
        eventSummaryID: generation.eventSummaryID,
        generationID: generation.generationID,
        recipeRunID: generation.recipeRunID,
        modelID: generation.modelID,
        modelParams: generation.modelParams,
        endTimestamp: generation.endTimestamp,
        didComplete: generation.errors?.length === 0,
      });

      /// Sort generations by when they completed.
      const generations = Array.from(generationsMap.values()).sort((lhs, rhs) => {
        const generationIDSort = new Date(lhs.endTimestamp).getTime() - new Date(rhs.endTimestamp).getTime();
        if (generationIDSort !== 0) return generationIDSort;
        return (lhs.generationID ?? "").localeCompare(rhs.generationID ?? "", "en");
      });
      existingArtifactSnapshot.generations = generations;

      /// Get a stable order we can use for ordering metric values chronologically.
      const generationIDOrdering = new Map(generations.map((generation, index) => [generation.generationID, index]));

      /// Merge metrics first by MetricID, then by GenerationID
      const metricsMap = new Map(existingArtifactSnapshot.metrics.map((metric) => [metric.id, metric]));
      let existingMetric = metricsMap.get(jobRecord.inputs.output.metricID);
      if (!existingMetric) {
        existingMetric = {
          id: jobRecord.inputs.output.metricID,
          values: [],
        };
        metricsMap.set(jobRecord.inputs.output.metricID, existingMetric);
      }
      const metricValuesMap = new Map((existingMetric.values ?? []).map((value) => [value.generationID, value]));
      metricValuesMap.set(jobRecord.generation_id, {
        eventSummaryID,
        generationID: jobRecord.generation_id,
        recipeRunID,
        evaluationGroupID: jobRecord.inputs.evaluationGroupID,
        value: evaluationResponse.value,
        examples:
          evaluationResponse.evidence.length > 0
            ? evaluationResponse.evidence.map((evidence) => ({
                artifactPath: jobRecord.inputs.input.selector.artifactPath,
                matchingContent: evidence,
              }))
            : [{ artifactPath: jobRecord.inputs.input.selector.artifactPath }],
      });

      /// Sort metric values by generation date, then metrics by MetricID.
      existingMetric.values = Array.from(metricValuesMap.values()).sort((lhs, rhs) => {
        return (
          (generationIDOrdering.get(lhs.generationID ?? "") ?? 0) -
          (generationIDOrdering.get(rhs.generationID ?? "") ?? 0)
        );
      });
      existingArtifactSnapshot.metrics = Array.from(metricsMap.values()).sort((lhs, rhs) =>
        lhs.id.localeCompare(rhs.id, "en"),
      );

      /// Update the record in the persistence
      await pgClient.query({
        text: `
          UPDATE public.artifact_snapshots
            SET
              "timestamp" = $1,
              "updated_at" = now(),
              "snapshot" = $2
            WHERE
              "org_id" = $3
              AND "artifact_path" = $4
              AND "event_summary_id" = $5;
        `,
        values: [
          new Date(existingArtifactSnapshot.timestamp),
          existingArtifactSnapshot,
          jobRecord.org_id,
          encodededArtifactPath,
          eventSummaryID,
        ],
      });

      /// Return a value suitable for the callback URL.
      return {
        status: "success",
        selector: jobRecord.inputs.input.selector,
        metric: {
          id: jobRecord.inputs.output.metricID,
          values: [
            {
              eventSummaryID,
              generationID: jobRecord.generation_id,
              recipeRunID,
              evaluationGroupID: jobRecord.inputs.evaluationGroupID,
              value: evaluationResponse.value,
              examples:
                evaluationResponse.evidence.length > 0
                  ? evaluationResponse.evidence.map((evidence) => ({
                      artifactPath: jobRecord.inputs.input.selector.artifactPath,
                      matchingContent: evidence,
                    }))
                  : [{ artifactPath: jobRecord.inputs.input.selector.artifactPath }],
            },
          ],
        },
      };
    });
  });
}

async function recordGeneration({
  pgPool,
  logger,
  generation,
  startTimestamp,
}: {
  pgPool: pg.Pool;
  logger: pino.Logger;
  generation: Generation;
  startTimestamp: Date;
}) {
  await withPGClient({ pgPool, logger }, async ({ pgClient }) => {
    await pgClient.query({
      text: `
        INSERT INTO public.generations (
          "org_id",
          "generation_id",
          "event_summary_id",
          "created_at",
          "contents"
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5
        )
        ON CONFLICT ("generation_id")
        DO UPDATE SET
          "contents" = EXCLUDED."contents";
      `,
      values: [generation.orgID, generation.generationID, generation.eventSummaryID, startTimestamp, generation],
    });
  });
}
