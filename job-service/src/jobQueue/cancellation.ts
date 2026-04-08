import type pg from "pg";
import type { Logger } from "pino";

import { withIdempotentTransaction, withPGClient } from "@/server/persistence";

export class JobCancelledError extends Error {
  constructor(message = "Job was cancelled.") {
    super(message);
    this.name = "JobCancelledError";
  }
}

export async function isJobCancelled({
  pgPool,
  logger,
  generationID,
}: {
  pgPool: pg.Pool;
  logger: Logger;
  generationID: string;
}) {
  const result = await withPGClient({ pgPool, logger }, async ({ pgClient, logger }) => {
    return await withIdempotentTransaction({ pgClient, logger, mode: "readOnly" }, async ({ pgClient }) => {
      return await pgClient.query<{ status: string }>({
        text: `
          SELECT "status"
            FROM public.evaluation_queue
            WHERE "generation_id" = $1;
        `,
        values: [generationID],
      });
    });
  });

  return result.rows.at(0)?.status === "cancelled";
}

export async function throwIfJobCancelled({
  pgPool,
  logger,
  generationID,
}: {
  pgPool: pg.Pool;
  logger: Logger;
  generationID: string;
}) {
  if (await isJobCancelled({ pgPool, logger, generationID })) {
    logger.info({ generationID }, "Job cancellation detected.");
    throw new JobCancelledError();
  }
}
