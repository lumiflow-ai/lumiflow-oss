import { z } from "zod";

import { installAPIExtensions } from "@/lib/apiGeneration";

import { FilterSchema } from "@/routes/dashboards/definitions";
import { OrganizationIDSchema } from "@/routes/orgs/definitions";

import { MetricIDSchema, MetricValueAggregationRuleSchema } from "@/definitions/metric";
import { PrimitiveValueSchema } from "@/definitions/primitives";

installAPIExtensions();

// MARK: - Metric Definitions

export const MetricDefinitionSchema = z
  .object({
    id: MetricIDSchema,
    /// The ID of the metric that this one is derived from, but has distinct values from.
    precursorID: MetricIDSchema.optional(),
    /// A flag indicating that the metric has been deleted and shouldn't be shown in the UI.
    isDeleted: z.literal(true).optional(),
    /// The name of the metric to display.
    name: z.string(),
    /// An optional description to display when inspecting the metric.
    description: z.string().optional(),
    /// A key to use when ordering metrics according to one another, otherwise the metric's ID will be used.
    order: z.string().optional(),
    /// The group name to categorize the metric under, if provided.
    group: z.string().optional(),
    /// An optional list of related metrics that can be referenced in the UI.
    relatedMetricsIDs: z.array(MetricIDSchema).optional(),
    /// How values should be merged when multiple exist for a given snapshot.
    metricValueAggregationRule: MetricValueAggregationRuleSchema.optional(),
    /// Replacements to use when values are displayed.
    displayValues: z.tuple([PrimitiveValueSchema, z.string()]).array().optional(),
    /// An optional filter that marks the value as acceptable.
    acceptanceValue: FilterSchema.optional(),
    /// An optional filter that marks the value as rejected.
    rejectionValue: FilterSchema.optional(),
    /// The kind associated with the value, used to inform how to interpret the value.
    kind: z.enum(["string", "number", "boolean", "icon"]).optional(),
    /// The unit to use when displaying the value. Used when no display value matches.
    unit: z.string().optional(),
    /// An optional color to use for the metric. If left out, one will be derived form the ID.
    color: z.string().optional(),
  })
  .api("MetricDefinition");

export const PartialMetricDefinitionSchema = z
  .object({
    id: MetricIDSchema,
    precursorID: MetricIDSchema.nullish(),
    isDeleted: z.literal(true).nullish(),
    name: z.string().optional(),
    description: z.string().nullish(),
    order: z.string().nullish(),
    group: z.string().nullish(),
    relatedMetricsIDs: z.array(MetricIDSchema).nullish(),
    metricValueAggregationRule: MetricValueAggregationRuleSchema.nullish(),
    displayValues: z.tuple([PrimitiveValueSchema, z.string()]).array().nullish(),
    acceptanceValue: FilterSchema.nullish(),
    rejectionValue: FilterSchema.nullish(),
    kind: z.enum(["string", "number", "boolean", "icon"]).nullish(),
    unit: z.string().nullish(),
    color: z.string().nullish(),
  })
  .api("PartialMetricDefinition");

// MARK: - HTTP

export const MetricDefinitionsRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    afterCursor: z.string().optional(),
    beforeCursor: z.string().optional(),
    limit: z.number().optional(),
  })
  .api("MetricDefinitionsRequest");

export const MetricDefinitionsResponseSchema = z
  .object({
    metricDefinitions: z.array(MetricDefinitionSchema),
    startCursor: z.string(),
    endCursor: z.string(),
  })
  .api("MetricDefinitionsResponse");

export const RecordMetricDefinitionRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    metricDefinition: PartialMetricDefinitionSchema,
  })
  .api("RecordMetricDefinitionRequest");

export const RecordMetricDefinitionResponseSchema = z
  .object({
    status: z.literal("success"),
    metricDefinition: MetricDefinitionSchema,
  })
  .api("RecordMetricDefinitionResponse");

export const ExportMetricsRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    metricSetID: z.string().optional(),
  })
  .api("ExportMetricsRequest");
