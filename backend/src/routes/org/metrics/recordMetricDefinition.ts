import type { MetricDefinition } from "@/types";

import { withIdempotentTransaction, withPGClient } from "@/server/persistence";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { HTTPError, RouteGroup } from "@/lib/routeGroup";
import { pickIfPresent, updateNullish, updateOptional } from "@/lib/validation";

import { RecordMetricDefinitionRequestSchema, RecordMetricDefinitionResponseSchema } from "./definitions";

export const recordMetricDefinition = new RouteGroup();

recordMetricDefinition.put(
  null,
  {
    requestSchema: RecordMetricDefinitionRequestSchema,
    responseSchema: RecordMetricDefinitionResponseSchema,
    auth: [AuthorizationRequirement.apiKey, AuthorizationRequirement.session],
  },
  async ({ orgID, metricDefinition }, context) => {
    if (context.auth === AuthorizationRequirement.session && !context.user?.organizations.has(orgID)) {
      throw new AuthorizationError();
    }

    return await withPGClient(context, async (context) => {
      return await withIdempotentTransaction(context, async ({ pgClient, logger }) => {
        const existingMetricDefinitionResults = await pgClient.query<{ definition: MetricDefinition }>({
          text: `
            SELECT "definition"
              FROM public.metric_definitions
              WHERE
                "org_id" = $1
                AND "metric_id" = $2
              FOR UPDATE;
          `,
          values: [orgID, metricDefinition.id],
        });

        const existingMetricDefinition = existingMetricDefinitionResults.rows.at(0)?.definition;
        if (!existingMetricDefinition) {
          if (metricDefinition.name === undefined) {
            throw new HTTPError(400, "The metric was not found, so it must specify a name.");
          }

          const newDefinition: MetricDefinition = {
            id: metricDefinition.id,
            ...pickIfPresent(metricDefinition, "precursorID"),
            ...pickIfPresent(metricDefinition, "isDeleted"),
            name: metricDefinition.name,
            ...pickIfPresent(metricDefinition, "description"),
            ...pickIfPresent(metricDefinition, "order"),
            ...pickIfPresent(metricDefinition, "group"),
            ...pickIfPresent(metricDefinition, "relatedMetricsIDs"),
            ...pickIfPresent(metricDefinition, "metricValueAggregationRule"),
            ...pickIfPresent(metricDefinition, "displayValues"),
            ...pickIfPresent(metricDefinition, "acceptanceValue"),
            ...pickIfPresent(metricDefinition, "rejectionValue"),
            ...pickIfPresent(metricDefinition, "kind"),
            ...pickIfPresent(metricDefinition, "unit"),
            ...pickIfPresent(metricDefinition, "color"),
          };

          logger.info("Creating metric definition.");
          /// If no artifact exists, insert new one
          await pgClient.query({
            text: `
              INSERT INTO public.metric_definitions (
                "org_id",
                "metric_id",
                "updated_at",
                "definition"
              ) VALUES (
                $1,
                $2,
                now(),
                $3
              );
            `,
            values: [orgID, newDefinition.id, newDefinition],
          });

          return {
            status: "success",
            metricDefinition: newDefinition,
          };
        }
        /// Otherwise, update props that are present (ie. not undefined), transforming null values to deleted ones.
        logger.info("Updating metric definition.");

        updateNullish(existingMetricDefinition, "precursorID", metricDefinition);
        updateNullish(existingMetricDefinition, "isDeleted", metricDefinition);
        updateOptional(existingMetricDefinition, "name", metricDefinition);
        updateNullish(existingMetricDefinition, "description", metricDefinition);
        updateNullish(existingMetricDefinition, "order", metricDefinition);
        updateNullish(existingMetricDefinition, "group", metricDefinition);
        updateNullish(existingMetricDefinition, "relatedMetricsIDs", metricDefinition);
        updateNullish(existingMetricDefinition, "metricValueAggregationRule", metricDefinition);
        updateNullish(existingMetricDefinition, "displayValues", metricDefinition);
        updateNullish(existingMetricDefinition, "acceptanceValue", metricDefinition);
        updateNullish(existingMetricDefinition, "rejectionValue", metricDefinition);
        updateNullish(existingMetricDefinition, "kind", metricDefinition);
        updateNullish(existingMetricDefinition, "unit", metricDefinition);
        updateNullish(existingMetricDefinition, "color", metricDefinition);

        await pgClient.query({
          text: `
            UPDATE public.metric_definitions
              SET
                "updated_at" = now(),
                "definition" = $1
              WHERE
                "org_id" = $2
                AND "metric_id" = $3;
          `,
          values: [existingMetricDefinition, orgID, existingMetricDefinition.id],
        });

        return {
          status: "success",
          metricDefinition: existingMetricDefinition,
        };
      });
    });
  },
);
