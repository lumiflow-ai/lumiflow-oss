import type { MetricDefinition } from "@/types";

import { withPGClient } from "@/server/persistence";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { MetricDefinitionsRequestSchema, MetricDefinitionsResponseSchema } from "./definitions";

export const loadMetrics = new RouteGroup();
loadMetrics.get(
  null,
  {
    requestSchema: MetricDefinitionsRequestSchema,
    responseSchema: MetricDefinitionsResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context) => {
    const orgID = request.orgID.toLowerCase();
    if (!context.user?.organizations.has(orgID)) {
      throw new AuthorizationError();
    }

    context.logger.info("Starting metric definitions query.");
    const metricDefinitionQueryResults = await withPGClient(context, async ({ pgClient }) => {
      return await pgClient.query<{
        org_id: string;
        metric_id: string;
        updated_at: Date;
        definition: MetricDefinition;
      }>({
        text: `
          SELECT *
            FROM public.metric_definitions
            WHERE "org_id" = $1
            ORDER BY "updated_at" ASC, "metric_id" ASC
            LIMIT 5000;
        `,
        values: [orgID],
      });
    });
    context.logger.info("Finished metric definitions query.");

    return {
      metricDefinitions: metricDefinitionQueryResults.rows.map(({ definition }) => definition),
      startCursor: "",
      endCursor: "",
    };
  },
);
