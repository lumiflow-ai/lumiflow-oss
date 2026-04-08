import { z } from "zod";

import { withIdempotentTransaction, withPGClient } from "@/server/persistence";
import { CONFIG } from "@/serverInitSetup/config";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { CancelEvaluationRequestSchema, CancelEvaluationResponseSchema } from "./definitions";

const cancellationEvaluationRunIDPrefix = "cancel:";
const JobServiceCancelEvaluationResponseSchema = z.object({
  type: z.literal("success"),
  cancelledJobCount: z.number().int().nonnegative(),
});

function cancellationEvaluationRunID(evaluationGroupID: string): string {
  return `${cancellationEvaluationRunIDPrefix}${evaluationGroupID}`;
}

function cancelledEvaluationRun(evaluationGroupID: string): { evaluationGroupID: string; status: "cancelled" } {
  return {
    evaluationGroupID,
    status: "cancelled",
  };
}

function shouldPersistCancellationRecord(cancelledJobCount: number): boolean {
  return cancelledJobCount > 0;
}

export const cancelEvaluation = new RouteGroup();
cancelEvaluation.post(
  "cancel",
  {
    requestSchema: CancelEvaluationRequestSchema,
    responseSchema: CancelEvaluationResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context) => {
    if (!context.user?.organizations.has(request.orgID.toLowerCase())) {
      throw new AuthorizationError();
    }

    const response = await fetch(`${CONFIG.JOB_HOST}/cancel-evaluation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orgID: request.orgID,
        evaluationGroupID: request.evaluationGroupID,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      context.logger.error(
        {
          status: response.status,
          responseText: responseText.slice(0, 500),
          evaluationGroupID: request.evaluationGroupID,
        },
        "Failed to cancel evaluation jobs in job-service.",
      );
      throw new Error("Failed to cancel evaluation jobs.");
    }

    const parsedBody = JobServiceCancelEvaluationResponseSchema.safeParse(await response.json());
    if (!parsedBody.success) {
      context.logger.error(
        { issues: parsedBody.error.issues, evaluationGroupID: request.evaluationGroupID },
        "Invalid cancel-evaluation response from job-service.",
      );
      throw new Error("Invalid response when cancelling evaluation jobs.");
    }

    const body = {
      status: "success" as const,
      cancelledJobCount: parsedBody.data.cancelledJobCount,
    };

    if (shouldPersistCancellationRecord(body.cancelledJobCount)) {
      await withPGClient(context, async ({ pgClient, logger }) => {
        await withIdempotentTransaction({ pgClient, logger }, async ({ pgClient }) => {
          await pgClient.query({
            text: `
              INSERT INTO public.evaluation_runs (
                "org_id",
                "evaluation_run_id",
                "updated_at",
                "run"
              )
              VALUES ($1, $2, now(), $3::jsonb)
              ON CONFLICT ("org_id", "evaluation_run_id") DO UPDATE
                SET
                  "updated_at" = excluded."updated_at",
                  "run" = excluded."run";
            `,
            values: [
              request.orgID.toLowerCase(),
              cancellationEvaluationRunID(request.evaluationGroupID),
              JSON.stringify(cancelledEvaluationRun(request.evaluationGroupID)),
            ],
          });
        });
      });
    }

    return body;
  },
);

export const __visibleForTesting = {
  cancelledEvaluationRun,
  cancellationEvaluationRunID,
  cancellationEvaluationRunIDPrefix,
  shouldPersistCancellationRecord,
};
