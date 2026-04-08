import type { Logger } from "pino";

import { CONFIG } from "@/serverInitSetup/config";

/**
 * Submits a job to the job service with retry logic and timeout handling.
 * Returns success with generationID or error with details. Never throws.
 */
export async function submitJob({
  orgID,
  kind,
  inputs,
  eventSummaryID,
  generationID,
  recipeRunID,
  callbackURL,
  priority,
  logger,
}: {
  orgID: string;
  kind: string;
  inputs: Record<string, unknown>;
  eventSummaryID?: string;
  generationID?: string;
  recipeRunID?: string;
  callbackURL: string | null;
  priority?: number;
  logger: Logger;
}): Promise<{ kind: "success"; generationID: string } | { kind: "error"; error: string; status: number }> {
  const childLogger = logger.child({
    kind,
    priority,
    generationID,
    recipeRunID,
    orgID,
    eventSummaryID,
  });
  const payload = JSON.stringify({
    kind,
    priority,
    generationID,
    recipeRunID,
    orgID,
    eventSummaryID,
    callbackURL,
    inputs,
  });

  let response: Response;
  for (let attempt = 0; ; attempt += 1) {
    try {
      childLogger.info({ attempt }, "Preparing to submit job…");
      // Delay the attempt by 10s per existing attempt. The first attempt will trigger immediately
      await new Promise((resolve) => setTimeout(resolve, attempt * 10 * 1000));

      response = await fetch(`${CONFIG.JOB_HOST}/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: payload,
        signal: AbortSignal.timeout(4 * 60 * 1000 * (attempt + 1)),
      });
      break;
    } catch (error) {
      childLogger.error({ error, attempt }, "HTTP error submitting job.");
      if (attempt >= 3) {
        return {
          kind: "error",
          error: "Failed to submit job.",
          status: 500,
        };
      }
    }
  }

  if (!response.ok) {
    childLogger.error({ responseStatus: response.status }, "Failed to submit job.");
    return {
      kind: "error",
      error: "Failed to submit job.",
      status: response.status,
    };
  }

  try {
    const jobResponse = (await response.json()) as
      | { kind: "success"; generationID: string }
      | { kind: "error"; error: string; status: number };
    childLogger.info("Job submission was successful.");
    return jobResponse;
  } catch (error) {
    childLogger.error({ error }, "Failed to parse job response JSON.");
    return {
      kind: "error",
      error: "Failed to parse job response.",
      status: 500,
    };
  }
}
