import { z } from "zod";

import { installAPIExtensions } from "@/lib/apiGeneration";

import { ArtifactPathPatternSchema, ArtifactPathSchema } from "@/definitions/artifactPath";
import { MetricIDSchema } from "@/definitions/metric";
import { PrimitiveValueSchema, UUIDSchema } from "@/definitions/primitives";

import { ColumnDescriptorSchema } from "../configuration/definitions";
import { OrganizationIDSchema } from "../orgs/definitions";

installAPIExtensions();

// MARK: - Identifiers

export const WidgetIDSchema = UUIDSchema.api("WidgetID");

export const DashboardIDSchema = UUIDSchema.api("DashboardID");

// MARK: - Types

export const KeyPathSchema = z.string().api("KeyPath");
export const CSSColorSchema = z.string().api("CSSColor");

export const ValueFilterOperatorSchema = z
  .enum(["equal", "notEqual", "greaterThan", "lessThan", "greaterThanOrEqual", "lessThanOrEqual"])
  .api("ValueFilterOperator");
export const GroupFilterOperatorSchema = z.enum(["all", "any", "none"]).api("GroupFilterOperator");

/// This represents a fully recursive content structure.
type Filter =
  | {
      operator: z.infer<typeof ValueFilterOperatorSchema>;
      value: z.infer<typeof PrimitiveValueSchema>;
    }
  | {
      operator: z.infer<typeof ValueFilterOperatorSchema>;
      keyPath: z.infer<typeof KeyPathSchema>;
      value: z.infer<typeof PrimitiveValueSchema>;
    }
  | {
      operator: z.infer<typeof GroupFilterOperatorSchema>;
      filters: Filter[];
    };
const FilterReferenceSchema: z.ZodType<Filter> = z.lazy(() => FilterSchema).api("Filter");

export const PrimitiveValueFilterSchema = z
  .object({
    operator: ValueFilterOperatorSchema,
    value: PrimitiveValueSchema,
  })
  .api("PrimitiveValueFilter");
export const KeyPathFilterSchema = z
  .object({
    operator: ValueFilterOperatorSchema,
    keyPath: KeyPathSchema,
    value: PrimitiveValueSchema,
  })
  .api("KeyPathFilter");
export const GroupFilterSchema = z
  .object({
    operator: GroupFilterOperatorSchema,
    filters: z.array(FilterReferenceSchema),
  })
  .api("GroupFilter");
export const FilterSchema = z.union([PrimitiveValueFilterSchema, KeyPathFilterSchema, GroupFilterSchema]).api("Filter");

export const ChartKindSchema = z.enum(["bar", "stackedBar"]).api("ChartKind");
export const ChartDirectionSchema = z.enum(["horizontal", "vertical"]).api("ChartDirection");
export const ChartValueAccumulationStrategySchema = z
  .enum(["count", "average", "sum"])
  .api("ChartValueAccumulationStrategy");
export const ChartValueNormalizationStrategySchema = z.enum(["none", "ratio"]).api("ChartValueNormalizationStrategy");

export const ChartSeriesSchema = z
  .object({
    /// The optional title for the series.
    title: z.string().optional(),
    /// The KeyPath set to use when loading values for a segment.
    keyPaths: z.array(KeyPathSchema),
    /// The filter value to match against for displaying this series.
    filter: FilterSchema.optional(),
    /// The minimum size along the primary axis for bars.
    minSize: z.number().gt(0).optional(),
    /// The set of colors to use for each value the series represents, if counting them, or the color to use for all members of the series.
    colors: z.union([CSSColorSchema, z.tuple([PrimitiveValueSchema, CSSColorSchema]).array()]).optional(),
    /// The map of custom legends for each value the series represents, if counting them, or the legend to use for all members of the series.
    legends: z.union([z.string(), z.tuple([PrimitiveValueSchema, z.string()]).array()]).optional(),
    /// How values within a segment are accumulated for the series.
    valueAccumulationStrategy: ChartValueAccumulationStrategySchema,
    /// How values for each segment should be normalized.
    valueNormalization: ChartValueNormalizationStrategySchema.optional(),
    /// The minimum value for the series.
    minValue: z.number().optional(),
    /// The maximum value for the series.
    maxValue: z.number().optional(),
  })
  .api("ChartSeries");

export const MetricDisplaySchema = z
  .object({
    /// The metric ID to display.
    metricID: MetricIDSchema,
    /// An optional title.
    title: z.string().optional(),
    /// An optional set of values to match against.
    matchingValues: z.array(PrimitiveValueSchema).optional(),
  })
  .api("MetricDisplay");

export const MetricValuesDisplayKindSchema = z.enum(["value", "examples"]).api("MetricValuesDisplayKind");

export const MetricValuesDisplaySchema = z
  .object({
    /// An optional title.
    title: z.string().optional(),
    /// The path to a child artifact, or empty if the current artifact should be shown.
    childArtifactPath: ArtifactPathSchema,
    /// What should be displayed for a given metric.
    displayKind: MetricValuesDisplayKindSchema,
    /// The width of the column,
    width: z.union([z.number(), z.literal("auto")]),
    /// Replacements to use when values are displayed
    displayValues: z.tuple([PrimitiveValueSchema, z.string()]).array().optional(),
  })
  .api("MetricValuesDisplay");

// MARK: - Objects

export const WidgetKindSchema = z.enum(["chart", "content", "metrics", "metricsList", "table"]).api("WidgetKind");

export const BaseWidgetSchema = z
  .object({
    id: WidgetIDSchema,
    kind: WidgetKindSchema,
    x: z.number().nonnegative(),
    y: z.number().nonnegative(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
    maxHeight: z.number().nonnegative().optional(),
  })
  .api("BaseWidget");

export const ChartWidgetSchema = z
  .object({
    ...BaseWidgetSchema.shape,
    kind: WidgetKindSchema.constants().chart,
    title: z.string(),
    chartKind: ChartKindSchema,
    /// The direction of the primary axis.
    direction: ChartDirectionSchema,
    /// The KeyPath set to use for batching entries along the primary axis.
    segmentationKeyPaths: z.array(KeyPathSchema),
    /// The list of series to chart.
    series: z.array(ChartSeriesSchema),
    /// The optional title for the segments.
    segmentsTitle: z.string().optional(),
  })
  .api("ChartWidget");

export const ContentWidgetSchema = z
  .object({
    ...BaseWidgetSchema.shape,
    kind: WidgetKindSchema.constants().content,
    /// The path to a child artifact, or empty if the current artifact should be shown.
    childArtifactPath: ArtifactPathSchema,
    /// Whether the source artifact should be used to provide surrounding context.
    showsContext: z.boolean(),
  })
  .api("ContentWidget");

export const MetricsWidgetSchema = z
  .object({
    ...BaseWidgetSchema.shape,
    kind: WidgetKindSchema.constants().metrics,
    // The list of metrics to show.
    metrics: z.array(MetricDisplaySchema),
  })
  .api("MetricsWidget");

export const MetricsListWidgetSchema = z
  .object({
    ...BaseWidgetSchema.shape,
    kind: WidgetKindSchema.constants().metricsList,
    // The list of metrics to show.
    metrics: z.array(MetricDisplaySchema),
    // The list of groups to automatically select metrics from.
    groups: z.array(z.string()).optional(),
    /// The list of columns to display.
    valueColumns: z.array(MetricValuesDisplaySchema).nonempty(),
  })
  .api("MetricsListWidget");

export const TableContentsSchema = z.enum(["artifact", "type", "snapshot", "generation"]).api("TableContents");

export const TableWidgetSchema = z
  .object({
    ...BaseWidgetSchema.shape,
    kind: WidgetKindSchema.constants().table,
    contents: TableContentsSchema,
    /// The filter value to match against for filtering down the top-level artifacts to display.
    filter: FilterSchema.optional(),
    columns: z.array(ColumnDescriptorSchema),
    showsNestedArtifacts: z.boolean(),
  })
  .api("TableWidget");

export const WidgetSchema = z
  .intersection(
    BaseWidgetSchema,
    z.discriminatedUnion("kind", [
      ChartWidgetSchema,
      ContentWidgetSchema,
      MetricsWidgetSchema,
      MetricsListWidgetSchema,
      TableWidgetSchema,
    ]),
  )
  .api("Widget");

export const DashboardSchema = z
  .object({
    id: DashboardIDSchema,
    widgets: z.array(WidgetSchema),
  })
  .api("Dashboard");

export const DashboardContextSchema = z.enum(["list", "detail"]).api("DashboardContext");

// MARK: - HTTP

export const DefaultDashboardRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    patterns: z.array(z.union([ArtifactPathPatternSchema, ArtifactPathSchema])),
    context: DashboardContextSchema,
  })
  .api("DefaultDashboardRequest");

export const DefaultDashboardResponseSchema = z
  .object({
    dashboard: DashboardSchema,
  })
  .api("DefaultDashboardResponse");
