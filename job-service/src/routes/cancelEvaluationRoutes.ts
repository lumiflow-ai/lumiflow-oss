import { withPGClient } from "@/server/persistence";

import { RouteGroup } from "@/lib/routeGroup";

import { signalJobProcessor } from "@/jobQueue/signaling";

import { CancelEvaluationRequestSchema, CancelEvaluationResponseSchema, ResponseTypeSchema } from "./definitions";

export const cancelEvaluationRoutes = new RouteGroup();
cancelEvaluationRoutes.post(
  "cancel-evaluation",
  {
    requestType: CancelEvaluationRequestSchema,
    responseType: CancelEvaluationResponseSchema,
  },
  async (request, context) => {
    const cancelledJobCount = await withPGClient(context, async ({ pgClient }) => {
      const results = await pgClient.query({
        text: `
          UPDATE public.evaluation_queue
            SET
              "status" = 'cancelled',
              "updated_at" = now()
            WHERE
              "org_id" = $1
              AND "status" IN ('waiting', 'processing')
              AND (
                (
                  "kind" = 'scheduleRecipeEvaluation'
                  AND EXISTS (
                    SELECT 1
                      FROM jsonb_array_elements_text(COALESCE("inputs"->'evaluationGroupIDs', '[]'::jsonb)) AS evaluation_group_id(value)
                      WHERE evaluation_group_id.value = $2
                  )
                )
                OR (
                  "kind" = 'evaluateRecipeStep'
                  AND "inputs"->>'evaluationGroupID' = $2
                )
              )
        `,
        values: [request.orgID, request.evaluationGroupID],
      });

      return results.rowCount ?? 0;
    });

    signalJobProcessor();

    return {
      type: ResponseTypeSchema.enum.success,
      cancelledJobCount,
    };
  },
);
