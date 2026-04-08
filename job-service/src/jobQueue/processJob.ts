import { randomUUID } from "node:crypto";

import type { Logger } from "pino";

import { withIdempotentTransaction, withPGClient } from "@/server/persistence";

import { canRunAttempt, getFailureOutcome } from "@/jobQueue/attempts";
import { JobCancelledError } from "@/jobQueue/cancellation";
import { JobDeferredError } from "@/jobQueue/deferred";
import { submitJob } from "@/jobQueue/submitJob";
import { processEvaluateRecipeStepJob } from "@/jobs/evaluateRecipeStep";
import { processNotifyCallbackJob } from "@/jobs/notifyCallback";
import { processScheduleRecipeEvaluation } from "@/jobs/scheduleRecipeEvaluation";

import { activeJobs, Constants, type JobKind, JobKinds, jobClientPool, jobLogger } from "./globals";
import { recordJobFairnessSelection } from "./scheduler/fairnessState";
import { checkCanProcessJob, signalJobProcessor } from "./signaling";
import type { EvaluationQueueJobSQLSchema, NotifyCallbackInputs } from "./types";

export function attemptToStartJob({
  kind,
  generationID,
  logger,
}: {
  kind: JobKind;
  generationID: string;
  logger: Logger;
}) {
  const childLogger = logger.child({
    kind,
    generationID,
    numberOfActiveJobs: activeJobs.get(kind)?.size ?? 0,
  });

  if (checkCanProcessJob(kind)) {
    childLogger.info("Job queue has room, attempting to start job now.");
    let jobsPerKind = activeJobs.get(kind);
    if (!jobsPerKind) {
      jobsPerKind = new Map();
      activeJobs.set(kind, jobsPerKind);
    }
    jobsPerKind.set(generationID, processJob({ generationID, kind }));
  } else {
    childLogger.info("Job queue is full, dropping job for now.");
  }
}

export async function processJob({
  generationID,
  kind,
  logger = jobLogger,
}: {
  generationID: string;
  kind: JobKind;
  logger?: Logger;
}) {
  const pgPool = await jobClientPool;
  const jobLogger = logger.child({ generationID, jobInstanceID: randomUUID() });
  jobLogger.info("Attempting to claim job.");

  // biome-ignore lint/suspicious/noExplicitAny: We want to match to any kind of job
  let jobRecord: EvaluationQueueJobSQLSchema<any> | undefined;
  try {
    jobRecord = await withPGClient({ pgPool, logger: jobLogger }, async ({ pgClient, logger }) => {
      return await withIdempotentTransaction({ pgClient, logger }, async ({ pgClient, logger }) => {
        /// Grab a Job for the given generation ID, but only if it is either waiting or if it was last processing more than 15 seconds ago.
        // biome-ignore lint/suspicious/noExplicitAny: We want to match to any kind of job
        const jobQueryResults = await pgClient.query<EvaluationQueueJobSQLSchema<any>>({
          text: `
            SELECT *
              FROM public.evaluation_queue
              WHERE
                "generation_id" = $1
                AND "kind" = $2
                AND (
                  (
                    "status" = 'waiting'
                    AND "available_at" <= now()
                  )
                  OR (
                    "status" = 'processing'
                    AND "updated_at" < (now() - INTERVAL '${Constants.jobAbandonedIntervalS} seconds')
                  )
                )
              FOR UPDATE;
          `,
          values: [generationID, kind],
        });

        /// Make sure we got a result.
        const jobRecord = jobQueryResults.rows.at(0);
        if (!jobRecord) {
          logger.warn("The job is not available for processing.");
          throw new Error("The job is not available for processing.");
        }

        const attemptCount = jobRecord.attempt_count ?? 0;
        if (!canRunAttempt({ attemptCount, maxAttempts: Constants.maxJobAttempts })) {
          logger.warn(
            { attemptCount, maxAttempts: Constants.maxJobAttempts },
            "Job already exceeded maximum attempts. Marking as failed.",
          );
          await pgClient.query({
            text: `
              UPDATE public.evaluation_queue
                SET
                  "runner_id" = $1,
                  "status" = 'failed',
                  "updated_at" = now()
                WHERE "generation_id" = $2;
            `,
            values: [Constants.runnerID, generationID],
          });
          throw new Error("The job has exceeded the maximum number of attempts.");
        }

        logger.info({ jobRecord }, "Claiming job…");

        /// Update the state of the job in the DB to be 'processing'
        await pgClient.query({
          text: `
            UPDATE public.evaluation_queue
              SET
              "runner_id" = $1,
              "status" = 'processing',
              "updated_at" = now()
              WHERE "generation_id" = $2;
          `,
          values: [Constants.runnerID, generationID],
        });

        await recordJobFairnessSelection({
          pgClient,
          jobRecord,
        });

        logger.info("Claimed job, processing started.");

        return jobRecord;
      });
    });

    let isProcessing = true;
    let finishedProcessingSignal: (() => void) | undefined;
    const heartbeatPromise = (async () => {
      jobLogger.info("Starting heartbeat.");
      while (isProcessing) {
        try {
          /// Update the state of the job in the DB to be 'processing', but only if we are still within a 10s window of last updating it.
          jobLogger.info("Attempting heartbeat.");
          const updateResults = await withPGClient({ pgPool, logger: jobLogger }, async ({ pgClient, logger }) => {
            return await withIdempotentTransaction({ pgClient, logger }, async ({ pgClient }) => {
              return await pgClient.query({
                text: `
                  UPDATE public.evaluation_queue
                    SET
                      "updated_at" = now()
                    WHERE
                      "runner_id" = $1
                      AND "generation_id" = $2
                      AND "status" = 'processing'
                      AND "updated_at" >= (now() - INTERVAL '${Constants.jobValidityIntervalS} seconds');
                `,
                values: [Constants.runnerID, generationID],
              });
            });
          });

          if (updateResults.rowCount !== 1) {
            jobLogger.warn({ updateResultCount: updateResults.rowCount }, "Heartbeat update failed.");
            throw new Error("Heartbeat failed to update");
          }
          jobLogger.info("Heartbeat successful.");
        } catch (error) {
          jobLogger.warn(
            { error },
            "Heartbeat update failed, will retry though. Debug why this is happening, as it really shouldn't, and may indicate two things are processing the same job!",
          );
        }
        /// Wait up to 5 seconds
        await Promise.any([
          new Promise((resolve) => {
            setTimeout(resolve, Constants.jobHeartbeatIntervalS * 1000);
          }),
          new Promise<void>((resolve) => {
            finishedProcessingSignal = resolve;
          }),
        ]);
        finishedProcessingSignal = undefined;
      }
      jobLogger.info("Heartbeat stopped.");
    })();

    let results: object | undefined;
    try {
      /// Switch against the job type and route it to the job processor for that type.
      switch (jobRecord.kind) {
        case JobKinds.evaluateRecipeStep: {
          results = await processEvaluateRecipeStepJob({
            pgPool,
            logger: jobLogger,
            jobRecord,
          });
          break;
        }
        case JobKinds.scheduleRecipeEvaluation: {
          results = await processScheduleRecipeEvaluation({
            pgPool,
            logger: jobLogger,
            jobRecord,
          });
          break;
        }
        case JobKinds.notifyCallback: {
          results = await processNotifyCallbackJob({
            pgPool,
            logger: jobLogger,
            jobRecord: jobRecord as EvaluationQueueJobSQLSchema<NotifyCallbackInputs>,
          });
          break;
        }
        default:
          throw new Error("Unknown Job Kind");
      }
    } catch (error) {
      /// End processing and throw to the outer context.
      jobLogger.warn({ error }, "Evaluation failed.");
      throw error;
    } finally {
      /// Cancel and wait for the heartbeat to stop before moving on, in either the success or failure conditions.
      jobLogger.info("Stopping heartbeat…");
      isProcessing = false;
      finishedProcessingSignal?.();
      await heartbeatPromise;
    }

    jobLogger.info("Completing job…");
    await withPGClient({ pgPool, logger: jobLogger }, async ({ pgClient, logger }) => {
      await withIdempotentTransaction({ pgClient, logger }, async ({ pgClient }) => {
        /// Update the state of the job in the DB to be 'complete'
        await pgClient.query({
          text: `
            UPDATE public.evaluation_queue
              SET
                "runner_id" = $1,
                "status" = 'complete',
                "updated_at" = now()
              WHERE
                "generation_id" = $2
                AND "status" = 'processing';
          `,
          values: [Constants.runnerID, generationID],
        });
      });
      logger.info("Attempted to mark job as complete.");

      /// Enqueue a dedicated notification job so eval completion is decoupled from webhook delivery.
      if (jobRecord) {
        const completionStatus = await pgClient.query<{ status: string }>({
          text: `
            SELECT "status"
              FROM public.evaluation_queue
              WHERE "generation_id" = $1;
          `,
          values: [generationID],
        });
        if (completionStatus.rows.at(0)?.status !== "complete") {
          logger.info("Job completion skipped because the job was cancelled.");
          return;
        }

        const callbackURL = jobRecord.callback_url as string;
        if (callbackURL) {
          await submitJob({
            pgClient,
            logger,
            kind: JobKinds.notifyCallback,
            priority: jobRecord.priority,
            generationID: randomUUID(),
            orgID: jobRecord.org_id,
            recipeRunID: jobRecord.recipe_run_id,
            eventSummaryID: jobRecord.event_summary_id,
            callbackURL,
            inputs: {
              body: {
                ...results,
                eventSummaryID: jobRecord.event_summary_id,
                generationID: jobRecord.generation_id,
              },
            },
          });
        }
      }
    });
  } catch (error) {
    jobLogger.error({ error }, "Job processing failed.");

    if (jobRecord) {
      if (error instanceof JobDeferredError) {
        await withPGClient({ pgPool, logger: jobLogger }, async ({ pgClient, logger }) => {
          await withIdempotentTransaction({ pgClient, logger }, async ({ pgClient }) => {
            await pgClient.query({
              text: `
                UPDATE public.evaluation_queue
                  SET
                    "runner_id" = $1,
                    "status" = 'waiting',
                    "defer_count" = "defer_count" + 1,
                    "available_at" = $3,
                    "updated_at" = now()
                  WHERE
                    "generation_id" = $2
                    AND "status" = 'processing';
              `,
              values: [Constants.runnerID, generationID, error.deferUntil],
            });
          });
        });
        jobLogger.info(
          {
            retryAfterSeconds: error.retryAfterSeconds,
            deferUntil: error.deferUntil.toISOString(),
            code: error.code,
          },
          "Deferred job after downstream throttling.",
        );
      } else if (error instanceof JobCancelledError) {
        jobLogger.info("Job was cancelled while processing.");
        jobLogger.info("Cancelled job preserved without retry.");
      } else {
        const { nextAttemptCount, status } = getFailureOutcome({
          attemptCount: jobRecord.attempt_count ?? 0,
          maxAttempts: Constants.maxJobAttempts,
        });

        await withPGClient({ pgPool, logger: jobLogger }, async ({ pgClient, logger }) => {
          await withIdempotentTransaction({ pgClient, logger }, async ({ pgClient }) => {
            await pgClient.query({
              text: `
                UPDATE public.evaluation_queue
                  SET
                    "runner_id" = $1,
                    "status" = $2,
                    "attempt_count" = $3,
                    "available_at" = now(),
                    "updated_at" = now()
                  WHERE
                    "generation_id" = $4
                    AND "status" = 'processing';
              `,
              values: [Constants.runnerID, status, nextAttemptCount, generationID],
            });
          });
        });

        if (status === "failed") {
          jobLogger.warn(
            { attemptsUsed: nextAttemptCount, maxAttempts: Constants.maxJobAttempts },
            "Job marked as failed after reaching maximum attempts.",
          );
        }
      }
    }
  } finally {
    jobLogger.info("Job processing concluded.");
    activeJobs.get(kind)?.delete(generationID);
    signalJobProcessor();
  }
}
