import type pino from "pino";

import { withIdempotentTransaction, withPGClient } from "@/server/persistence";

import type { EvaluationQueueJobSQLSchema, NotifyCallbackInputs } from "@/jobQueue/types";

/**
 * Process a Notify Callback job.
 *
 * Sends the callback payload to the provided callback URL. Throws on repeated failure so the job can be retried up to the max attempts configured at the queue level.
 */
export async function processNotifyCallbackJob({
  pgPool,
  logger,
  jobRecord,
}: {
  pgPool: Parameters<typeof withPGClient>[0]["pgPool"];
  logger: pino.Logger;
  jobRecord: EvaluationQueueJobSQLSchema<NotifyCallbackInputs>;
}): Promise<{ status: "notified" }> {
  const callbackURL = jobRecord.callback_url;
  if (!callbackURL) {
    logger.warn("No callback URL provided for notification job.");
    return { status: "notified" };
  }

  /// Send the webhook with up to 10 attempts and linear backoff. Errors cause the job to be retried by the queue up to MAX_JOB_ATTEMPTS.
  for (let attempt = 0; ; attempt += 1) {
    try {
      const timestamp = new Date().toISOString();
      logger.info({ callbackURL, attempt }, "Calling evaluation webhook…");
      await new Promise((resolve) => setTimeout(resolve, attempt * 10 * 1000));
      const response = await fetch(callbackURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Callback-Timestamp": timestamp,
        },
        body: JSON.stringify({
          ...jobRecord.inputs.body,
          timestamp,
        }),
        signal: AbortSignal.timeout(2 * 60 * 1000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} Error`);
      logger.info("Webhook called successfully.");
      break;
    } catch (error) {
      logger.warn({ error, callbackURL, attempt }, "HTTP error calling evaluation webhook.");
      if (attempt >= 10) {
        throw new Error("HTTP error calling evaluation webhook.");
      }
    }
  }

  /// No DB updates are needed, but keep the signature consistent.
  await withPGClient({ pgPool, logger }, async ({ pgClient, logger }) => {
    await withIdempotentTransaction({ pgClient, logger, mode: "readOnly" }, async () => {});
  });

  return { status: "notified" };
}
