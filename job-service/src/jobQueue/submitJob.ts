import type pg from "pg";
import type { Logger } from "pino";

import { Constants, type JobKind, jobLogger } from "./globals";
import { signalJobProcessor } from "./signaling";

export async function submitJob({
  pgClient,
  logger = jobLogger,
  kind,
  priority,
  generationID,
  orgID,
  recipeRunID,
  eventSummaryID,
  callbackURL,
  inputs,
}: {
  pgClient: pg.ClientBase;
  logger?: Logger;
  kind: JobKind;
  priority: number;
  generationID: string;
  orgID: string;
  recipeRunID: string | undefined;
  eventSummaryID: string | undefined;
  callbackURL: string | null;
  inputs: Record<string, unknown>;
}) {
  const jobStatus = "waiting";

  const childLogger = logger.child({ generationID, orgID, eventSummaryID, recipeRunID, inputs });
  childLogger.info("Received new job.");

  await pgClient.query({
    text: `
      INSERT INTO public.evaluation_queue (
        "created_at",
        "updated_at",
        "available_at",
        "kind",
        "status",
        "priority",
        "generation_id",
        "recipe_run_id",
        "event_summary_id",
        "runner_id",
        "org_id",
        "callback_url",
        "inputs",
        "attempt_count",
        "defer_count"
      ) VALUES (
        now(),
        now(),
        now(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12
      );
    `,
    values: [
      kind,
      jobStatus,
      priority,
      generationID,
      recipeRunID,
      eventSummaryID,
      Constants.runnerID,
      orgID,
      callbackURL,
      inputs,
      0,
      0,
    ],
  });

  signalJobProcessor();
}
