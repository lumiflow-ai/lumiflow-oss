import { randomUUID } from "node:crypto";

import type pg from "pg";
import type pino from "pino";

import { withIdempotentTransaction, withPGClient } from "@/server/persistence";

import { decodeArtifactPathComponents } from "@/model/artifactPath";

import {
  type ArtifactSnapshotStrict,
  type EvaluationGroupID,
  type Recipe,
  RecipeStepInputKind,
  RecipeStepKind,
  RecipeStepOutputKind,
  RecipeTriggerKind,
} from "@/generated/backendTypes";
import { throwIfJobCancelled } from "@/jobQueue/cancellation";
import { JobKinds } from "@/jobQueue/globals";
import { submitJob } from "@/jobQueue/submitJob";
import type { EvaluationQueueJobSQLSchema } from "@/jobQueue/types";
import type { RecipeStepEvalInputs } from "@/jobs/evaluateRecipeStep";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export type ScheduleRecipeEvaluationInputs = {
  recipe: Recipe;
  evaluationGroupIDs: EvaluationGroupID[];
};

/**
 * Process a Schedule Recipe Evaluation job.
 *
 * This job filters through all artifacts to find those that match a given recipe trigger, then schedules EvaluateRecipeStep jobs for each of them.
 */
export async function processScheduleRecipeEvaluation({
  pgPool,
  logger,
  jobRecord,
}: {
  pgPool: pg.Pool;
  logger: pino.Logger;
  jobRecord: EvaluationQueueJobSQLSchema<ScheduleRecipeEvaluationInputs>;
}): Promise<{ status: "success" | "failed" }> {
  if (!jobRecord.recipe_run_id) {
    logger.warn({ generationID: jobRecord.generation_id }, "Missing recipeRunID on scheduleRecipeEvaluation job.");
  }

  const evaluationGroupIDs = new Set(jobRecord.inputs.evaluationGroupIDs);
  for (const trigger of jobRecord.inputs.recipe.triggers) {
    await throwIfJobCancelled({ pgPool, logger, generationID: jobRecord.generation_id });
    const childLogger = logger.child({ trigger });
    if (evaluationGroupIDs.size > 0 && !evaluationGroupIDs.has(trigger.evaluationGroupID)) continue;
    if (trigger.kind !== RecipeTriggerKind.artifactPath) {
      childLogger.warn({ triggerKind: trigger.kind }, "Unsupported trigger kind encountered. Skipping.");
      continue;
    }

    /// Build range cursors based on a prefix with no partial patterns.
    let artifactPathStartCursor: string[][] = [];
    let eventSummaryIDStartCursor = "";
    const artifactPathEndCursor: string[][] = [];

    for (const component of trigger.artifactPathPattern) {
      if ("kind" in component) {
        if (component.id) {
          artifactPathStartCursor.push([component.kind, component.id]);
          artifactPathEndCursor.push([component.kind, component.id]);
        } else {
          /// We've encountered a partial pattern, so stop here and scan the whole lexicographic range:
          artifactPathStartCursor.push([component.kind, ""]);
          artifactPathEndCursor.push([component.kind, "\xff"]);
          break;
        }
      } else {
        artifactPathStartCursor.push(["", component.id]);
        artifactPathEndCursor.push(["", component.id]);
      }
    }

    if (artifactPathStartCursor.length === 0 || artifactPathEndCursor.length === 0) {
      childLogger.warn(
        { artifactPathPattern: trigger.artifactPathPattern },
        "Unsupported artifactPathPattern encountered. Skipping.",
      );
      continue;
    }

    /// Append an end byte to the end cursor to force it to be ordered after any child artifacts we may be interested in, otherwise the scan will stop at the parent. \x01 is the first valid code-point we can scan from.
    artifactPathEndCursor[artifactPathEndCursor.length - 1][1] += "\x01";

    /// Load artifacts in batches, crawling forward after each of the snapshots are submitted for evaluation.
    while (true) {
      await throwIfJobCancelled({ pgPool, logger: childLogger, generationID: jobRecord.generation_id });
      const snapshots = await withPGClient({ pgPool, logger: childLogger }, async ({ pgClient, logger }) => {
        return await withIdempotentTransaction({ pgClient, logger, mode: "readOnly" }, async ({ pgClient }) => {
          logger.info(
            { artifactPathStartCursor, eventSummaryIDStartCursor, artifactPathEndCursor },
            "Scanning for artifact snapshots.",
          );

          /// If there is an eventSummaryID, limit the lookup to one that matches the current artifact path.
          if (eventSummaryIDStartCursor) {
            const artifactPathCursor = artifactPathStartCursor;

            logger.info(
              { parameters: [jobRecord.org_id, artifactPathCursor, eventSummaryIDStartCursor] },
              "Performing ranged EventSummaryID scan.",
            );

            const snapshotResults = await pgClient.query<{
              artifact_path: string[][];
              event_summary_id: string;
            }>({
              text: `
                SELECT "artifact_path", "event_summary_id"
                  FROM public.artifact_snapshots
                  WHERE
                    "org_id" = $1
                    AND "artifact_path" = $2
                    AND "event_summary_id" > $3
                  ORDER BY
                    "artifact_path" ASC,
                    "event_summary_id" ASC
                  LIMIT 20;
              `,
              values: [
                jobRecord.org_id, /// Everything in Org ID
                artifactPathCursor, /// Only check this artifact path
                eventSummaryIDStartCursor, /// Starting from this Event Summary ID.
              ],
            });

            return snapshotResults.rows;
          }

          /// Otherwise scan until the end:
          const artifactPathGreaterThanOrEquals = artifactPathStartCursor;
          const artifactPathLessThanOrEquals = artifactPathEndCursor;

          /// Constrain lookups to artifacts that are at least as long as the prefix we were able to extract, up to the maximum length of the full pattern.
          const artifactPathLengthGreaterThanOrEquals = artifactPathEndCursor.length;
          const artifactPathLengthLessThanOrEquals = trigger.artifactPathPattern.length;

          logger.info(
            {
              parameters: [
                jobRecord.org_id,
                artifactPathGreaterThanOrEquals,
                artifactPathLessThanOrEquals,
                artifactPathLengthGreaterThanOrEquals,
                artifactPathLengthLessThanOrEquals,
                eventSummaryIDStartCursor,
              ],
            },
            "Performing ranged ArtifactPath scan.",
          );

          const snapshotResults = await pgClient.query<{
            artifact_path: string[][];
            event_summary_id: string;
          }>({
            text: `
              SELECT "artifact_path", "event_summary_id"
                FROM public.artifact_snapshots
                WHERE
                  "org_id" = $1
                  AND "artifact_path" >= $2
                  AND "artifact_path" <= $3
                  AND array_length("artifact_path", 1) >= $4
                  AND array_length("artifact_path", 1) <= $5
                ORDER BY
                  "artifact_path" ASC,
                  "event_summary_id" ASC
                LIMIT 20;
            `,
            values: [
              jobRecord.org_id, /// Everything in Org ID
              artifactPathGreaterThanOrEquals, /// Starting from this path prefix
              artifactPathLessThanOrEquals, /// Up to this path prefix
              artifactPathLengthGreaterThanOrEquals, /// Artifacts of at least this length
              artifactPathLengthLessThanOrEquals, /// Up this this path length
            ],
          });

          return snapshotResults.rows;
        });
      });

      const recipeRunID = jobRecord.recipe_run_id ?? randomUUID();

      /// Create jobs for every snapshot:
      await withPGClient({ pgPool, logger: childLogger }, async ({ pgClient, logger }) => {
        logger.info({ snapshotCount: snapshots.length }, "Checking Snapshots.");
        for (const { artifact_path, event_summary_id } of snapshots) {
          await throwIfJobCancelled({ pgPool, logger, generationID: jobRecord.generation_id });
          /// Verify that the snapshot matches the pattern
          // TODO: Do the verification
          logger.info({ snapshot: { artifact_path, event_summary_id } }, "Applying steps to snapshot.");

          // Set due date for this recipe run on the artifact snapshot
          const dueDate = new Date(Date.now() + TWO_WEEKS_MS).toISOString();
          await withIdempotentTransaction({ pgClient, logger }, async ({ pgClient }) => {
            const snapshotResult = await pgClient.query<{ snapshot: ArtifactSnapshotStrict }>({
              text: `
                SELECT snapshot
                FROM public.artifact_snapshots
                WHERE org_id = $1 AND artifact_path = $2 AND event_summary_id = $3
              `,
              values: [jobRecord.org_id, artifact_path, event_summary_id],
            });
            const snapshot = snapshotResult.rows[0]?.snapshot;
            if (snapshot) {
              snapshot.dueDates[trigger.evaluationGroupID] = dueDate;
              await pgClient.query({
                text: `
                UPDATE public.artifact_snapshots 
                SET snapshot = $1 
                WHERE org_id = $2 AND artifact_path = $3 AND event_summary_id = $4
              `,
                values: [snapshot, jobRecord.org_id, artifact_path, event_summary_id],
              });
            }
          });

          for (const step of jobRecord.inputs.recipe.steps) {
            await throwIfJobCancelled({ pgPool, logger, generationID: jobRecord.generation_id });
            /// Skip any non-evaluation recipe steps.
            if (step.kind !== RecipeStepKind.evaluate) continue;
            /// Skip any steps that have more than one inputs, or otherwise incompatible inputs.
            const stepInput = step.inputs.at(0);
            if (
              step.inputs.length !== 1 ||
              !stepInput ||
              stepInput.kind !== RecipeStepInputKind.artifact ||
              stepInput.input.keyPath !== ""
            ) {
              logger.warn(
                { stepInputs: step.inputs },
                "Unexpected step inputs encountered. Only one artifact input with no keypath is currently allowed.",
              );
              continue;
            }
            /// Skip any steps that have more than one outputs, or otherwise incompatible outputs.
            const stepOutput = step.outputs.at(0);
            if (
              step.outputs.length !== 1 ||
              !stepOutput ||
              stepOutput.kind !== RecipeStepOutputKind.metric ||
              !stepOutput.output.includeEvidence
            ) {
              logger.warn(
                { stepInputs: step.inputs },
                "Unexpected step inputs encountered. Only one metric output with evidence included is currently allowed.",
              );
              continue;
            }

            /// Submit the job.
            // TODO: Pass the step, artifact path, and event summary ID (likely a selector) here instead, once the job is upgraded to handle them.
            const inputs: RecipeStepEvalInputs = {
              input: {
                key: stepInput.token,
                selector: {
                  artifactPath: decodeArtifactPathComponents(artifact_path).concat(stepInput.input.childArtifactPath),
                  eventSummaryIDs: [event_summary_id],
                },
              },
              prompt: step.promptTemplate,
              model: {
                name: step.model.name,
                ...step.model.parameters,
              },
              output: {
                selector: {
                  artifactPath: decodeArtifactPathComponents(artifact_path).concat(stepOutput.output.childArtifactPath),
                  eventSummaryIDs: [event_summary_id],
                },
                metricID: stepOutput.output.metricID,
              },
              evaluationGroupID: trigger.evaluationGroupID,
            };
            await submitJob({
              pgClient,
              logger,
              kind: JobKinds.evaluateRecipeStep,
              priority: jobRecord.priority,
              generationID: randomUUID(),
              orgID: jobRecord.org_id,
              recipeRunID,
              eventSummaryID: event_summary_id,
              callbackURL: null,
              inputs,
            });
          }
        }
      });

      /// Modify the cursors so we continue the scan or stop if we've really found nothing:
      if (eventSummaryIDStartCursor) {
        /// If we were previously scanning from an event summary ID, clear it and continue scanning
        eventSummaryIDStartCursor = "";

        /// Append a start byte to the start cursor to force it to progress to the next artifact. \x01 is the first valid code-point we can scan from.
        artifactPathStartCursor[artifactPathStartCursor.length - 1][1] += "\x01";
      } else {
        /// If we are scanning for artifacts and find nothing, stop here.
        const lastSnapshot = snapshots.at(-1);
        if (!lastSnapshot) break;

        /// Otherwise keep scanning from the current artifact path and event summary ID.
        artifactPathStartCursor = lastSnapshot.artifact_path;
        eventSummaryIDStartCursor = lastSnapshot.event_summary_id;
      }
    }
  }

  return {
    status: "success",
  };
}
