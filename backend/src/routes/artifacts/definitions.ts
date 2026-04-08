import { z } from "zod";

import { installAPIExtensions } from "@/lib/apiGeneration";

import { ArtifactPathSchema } from "@/definitions/artifactPath";
import { MetricIDSchema } from "@/definitions/metric";
import {
  EvaluationGroupIDSchema,
  ISO8601PreciseTimestampSchema,
  PrimitiveValueSchema,
  URLSchema,
  UUIDSchema,
} from "@/definitions/primitives";

import { UserIDSchema } from "../account/definitions";
import { EvaluationModelParametersSchema } from "../org/evaluationModels/definitions";
import { OrganizationIDSchema } from "../orgs/definitions";

installAPIExtensions();

// MARK: - Identifiers

export const EventSummaryIDSchema = UUIDSchema.api("EventSummaryID");

/** The ID of the job that generated a metric. */
export const GenerationIDSchema = z.string().api("GenerationID");

/** The shared ID between generations pertaining to the same recipe run. */
export const RecipeRunIDSchema = z.string().api("RecipeRunID");

export const AnnotationIDSchema = UUIDSchema.api("AnnotationID");

export const MetricReviewIDSchema = UUIDSchema.api("MetricReviewID");

// MARK: - Artifacts

export const TagValueSchema = z
  .object({
    tag: z.string(),
    value: z.string(),
  })
  .api("TagValue");

export const ArtifactSelectorSchema = z
  .object({
    tags: z.array(TagValueSchema).optional(),
    artifactPath: ArtifactPathSchema,
    eventSummaryIDs: z.array(EventSummaryIDSchema).optional(),
    recipeRunIDs: z.array(RecipeRunIDSchema).optional(),
    generationIDs: z.array(GenerationIDSchema).optional(),
  })
  .api("ArtifactSelector");

/// This represents a fully recursive content structure.
type RenderedContent = z.infer<typeof PrimitiveValueSchema> | { [key: string]: RenderedContent };
const RenderedContentReferenceSchema: z.ZodType<RenderedContent> = z
  .lazy(() => RenderedContentSchema)
  .api("RenderedContent");
export const RenderedContentSchema = z
  .union([PrimitiveValueSchema, z.record(z.string(), RenderedContentReferenceSchema)])
  .api("RenderedContent");

export const MetricExampleSchema = z
  .object({
    artifactPath: ArtifactPathSchema,
    matchingContent: PrimitiveValueSchema.optional(),
    relation: z.string().optional(),
    // matchingRange: // TODO: For the future, we should add a range-representation here.
  })
  .api("MetricExample");

export const MetricRecordingSchema = z
  .object({
    eventSummaryID: EventSummaryIDSchema,
    recipeRunID: RecipeRunIDSchema.optional(),
    generationID: GenerationIDSchema.optional(),
    evaluationGroupID: EvaluationGroupIDSchema,
    value: PrimitiveValueSchema,
    examples: z.array(MetricExampleSchema).optional(),
  })
  .api("MetricRecording");

export const MetricRecordingStrictSchema = z
  .object({
    eventSummaryID: EventSummaryIDSchema,
    recipeRunID: RecipeRunIDSchema,
    generationID: GenerationIDSchema,
    evaluationGroupID: EvaluationGroupIDSchema,
    value: PrimitiveValueSchema,
    examples: z.array(MetricExampleSchema).optional(),
  })
  .api("MetricRecordingStrict");

export const MetricSchema = z
  .object({
    id: MetricIDSchema,
    values: z.array(MetricRecordingSchema),
    isMock: z.boolean().optional(),
  })
  .api("Metric");

export const MetricStrictSchema = z
  .object({
    id: MetricIDSchema,
    values: z.array(MetricRecordingStrictSchema),
    isMock: z.literal(true).optional(),
  })
  .api("MetricStrict");

export const ArtifactMetricGenerationSchema = z
  .object({
    eventSummaryID: EventSummaryIDSchema,
    recipeRunID: RecipeRunIDSchema,
    generationID: GenerationIDSchema,
    modelID: z.string(),
    modelParams: EvaluationModelParametersSchema.optional(),
    endTimestamp: ISO8601PreciseTimestampSchema,
    didComplete: z.boolean(),
  })
  .api("ArtifactMetricGeneration");

const NonNegativeInteger = z.number().int("must be an integer").nonnegative("must be a non-negative integer");

export const AnnotationLocationSchema = z
  .object({
    start: NonNegativeInteger,
    end: NonNegativeInteger,
  })
  .refine((arg: { start: number; end: number }) => arg.end > arg.start, "end must be greater than start")
  .api("AnnotationLocation");

export const AnnotationSchema = z
  .object({
    id: AnnotationIDSchema,
    location: AnnotationLocationSchema,
    content: z.string().min(1, "annotation content cannot be empty"),
    author: UserIDSchema,
    createdTimestamp: ISO8601PreciseTimestampSchema,
    modifiedTimestamp: ISO8601PreciseTimestampSchema,
    isDeleted: z.boolean(),
  })
  .api("Annotation");

const AnnotationRecordSchema = z
  .record(z.string(), AnnotationSchema)
  .describe("Mapping from annotation ID to annotation");

export const MetricReviewValueSchema = z.enum(["approved", "denied", "not_applicable"]).api("MetricReviewValue");

export const MetricReviewSchema = z
  .object({
    id: MetricReviewIDSchema,
    metricId: MetricIDSchema,
    recipeRunId: RecipeRunIDSchema,
    evaluationGroupId: EvaluationGroupIDSchema,
    value: MetricReviewValueSchema,
    author: UserIDSchema,
    createdTimestamp: ISO8601PreciseTimestampSchema,
    modifiedTimestamp: ISO8601PreciseTimestampSchema,
  })
  .api("MetricReview");

const MetricReviewRecordSchema = z
  .record(MetricReviewIDSchema, MetricReviewSchema)
  .describe("Mapping from MetricReviewID to MetricReview");

const MetricReviewDueDateSchema = z
  .record(EvaluationGroupIDSchema, ISO8601PreciseTimestampSchema)
  .describe("Mapping from an evaluation (identified by EvalutionGroupID) to a due date");

export const ArtifactSnapshotSchema = z
  .object({
    artifactPath: ArtifactPathSchema.optional(), // TODO: Make non-optional
    sourceArtifactSelectors: z.array(ArtifactSelectorSchema).optional(),
    eventSummaryID: EventSummaryIDSchema.optional(), // TODO: Make non-optional
    tags: z.record(z.string(), z.string()).optional(), // TODO: Make non-optional
    metadata: z.record(z.string(), z.string()).optional(), // TODO: Make non-optional
    timestamp: ISO8601PreciseTimestampSchema.optional(), // TODO: Make non-optional
    content: RenderedContentSchema,
    metrics: z.array(MetricSchema).optional(), // TODO: Make non-optional
    generations: z.array(ArtifactMetricGenerationSchema).optional(), // TODO: Make non-optional
    annotations: AnnotationRecordSchema.optional(), // TODO: Make non-optional
    reviews: MetricReviewRecordSchema.optional(), // TODO: Make non-optional
    dueDates: MetricReviewDueDateSchema.optional(), // TODO: Make non-optional
  })
  .api("ArtifactSnapshot");

export const ArtifactSnapshotStrictSchema = z
  .object({
    artifactPath: ArtifactPathSchema,
    sourceArtifactSelectors: z.array(ArtifactSelectorSchema),
    eventSummaryID: EventSummaryIDSchema,
    tags: z.record(z.string(), z.string()),
    metadata: z.record(z.string(), z.string()),
    timestamp: ISO8601PreciseTimestampSchema,
    content: RenderedContentSchema,
    metrics: z.array(MetricStrictSchema),
    generations: z.array(ArtifactMetricGenerationSchema),
    annotations: AnnotationRecordSchema,
    reviews: MetricReviewRecordSchema,
    dueDates: MetricReviewDueDateSchema,
  })
  .api("ArtifactSnapshotStrict");

export const ArtifactSchema = z
  .object({
    artifactPath: ArtifactPathSchema,
    sourceArtifactPaths: z.array(ArtifactPathSchema).optional(),
    snapshots: z.array(ArtifactSnapshotSchema),
    metrics: z.array(MetricSchema).optional(),
    generations: z.array(ArtifactMetricGenerationSchema).optional(),
  })
  .api("Artifact");

export const ArtifactStrictSchema = z
  .object({
    artifactPath: ArtifactPathSchema,
    snapshots: z.array(ArtifactSnapshotStrictSchema),
    metrics: z.array(MetricStrictSchema),
    generations: z.array(ArtifactMetricGenerationSchema),
  })
  .api("ArtifactStrict");

// MARK: - HTTP

export const ArtifactContentsRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    afterCursor: z.string().optional(),
    beforeCursor: z.string().optional(),
    limit: z.number().optional(),
  })
  .api("ArtifactContentsRequest");

export const ArtifactContentsResponseSchema = z
  .object({
    artifacts: z.array(ArtifactSchema),
    startCursor: z.string(),
    endCursor: z.string(),
  })
  .api("ArtifactContentsResponse");

export const RecordArtifactContentsRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    artifactPath: ArtifactPathSchema,
    snapshots: z.array(ArtifactSnapshotStrictSchema),
  })
  .api("RecordArtifactContentsRequest");

export const RecordArtifactContentsResponseSchema = z
  .intersection(
    z.object({ message: z.string() }),
    z.discriminatedUnion("status", [
      z.object({ status: z.literal("success"), artifact: ArtifactSchema }),
      z.object({ status: z.literal("error") }),
    ]),
  )
  .api("RecordArtifactContentsResponse");

export const ArtifactSnapshotDeltaSchema = z
  .object({
    annotations: AnnotationRecordSchema.optional(),
    reviews: MetricReviewRecordSchema.optional(),
    dueDates: MetricReviewDueDateSchema.optional(),
  })
  .refine(
    ({ annotations, reviews, dueDates }) =>
      annotations !== undefined || reviews !== undefined || dueDates !== undefined,
    "snapshot update must include at least one of annotations, reviews, or dueDates",
  )
  .api("ArtifactSnapshotDelta");

export const UpdateArtifactSnapshotRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    artifactPath: ArtifactPathSchema,
    eventSummaryID: EventSummaryIDSchema,
    snapshotDelta: ArtifactSnapshotDeltaSchema,
  })
  .api("UpdateArtifactSnapshotRequest");

export const UpdateArtifactSnapshotResponseSchema = z
  .object({
    status: z.enum(["success", "error"]),
    message: z.string(),
  })
  .api("UpdateArtifactSnapshotResponse");

export const DeleteArtifactContentsRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    artifactPath: ArtifactPathSchema,
    eventSummaryID: EventSummaryIDSchema.optional(),
    deleteSubartifacts: z
      .boolean()
      .optional()
      .describe("Delete all sub-artifacts with paths that start with this artifact's path (default: false)"),
  })
  .api("DeleteArtifactContentsRequest");

export const DeleteArtifactContentsResponseSchema = z
  .object({
    status: z.enum(["success", "error"]),
    message: z.string(),
  })
  .api("DeleteArtifactContentsResponse");

// Create Artifact HTTP Types

export const CreateArtifactRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    parentArtifactPath: ArtifactPathSchema.optional(),
    id: z.string(),
    timestamp: ISO8601PreciseTimestampSchema,
    input: z.string(),
    output: z.string(),
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .api("CreateArtifactRequest");

export const CreateArtifactResponseSchema = z
  .object({
    url: URLSchema,
    artifactPath: ArtifactPathSchema,
    eventSummaryID: EventSummaryIDSchema,
  })
  .api("CreateArtifactResponse");

export const CreateSnapshotsRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    snapshots: z.array(ArtifactSnapshotStrictSchema),
  })
  .api("CreateSnapshotsRequest");

export const CreateSnapshotsResponseSchema = z
  .array(
    z.object({
      url: URLSchema,
      artifactPath: ArtifactPathSchema,
      eventSummaryID: EventSummaryIDSchema,
    }),
  )
  .api("CreateSnapshotsResponse");
