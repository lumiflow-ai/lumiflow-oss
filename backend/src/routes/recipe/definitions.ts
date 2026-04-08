import { z } from "zod";

import { installAPIExtensions } from "@/lib/apiGeneration";

import { ArtifactSelectorSchema, MetricSchema } from "@/routes/artifacts/definitions";
import { KeyPathSchema } from "@/routes/dashboards/definitions";
import { MetricDefinitionSchema } from "@/routes/org/metrics/definitions";
import { OrganizationIDSchema } from "@/routes/orgs/definitions";

import { ArtifactPathPatternSchema, ArtifactPathSchema } from "@/definitions/artifactPath";
import { MetricIDSchema, MetricValueAggregationRuleSchema } from "@/definitions/metric";
import { EvaluationGroupIDSchema, ISO8601PreciseTimestampSchema } from "@/definitions/primitives";

installAPIExtensions();

// MARK: - General IDs

export const RecipeIDSchema = z.string().api("RecipeID");
export const RecipeStepIDSchema = z.string().api("RecipeStepID");
export const RecipeTriggerIDSchema = z.string().api("RecipeTriggerID");

// MARK: - Evaluation Model

export const RecipeEvaluationModelSchema = z
  .object({
    /// The identifier of a model to use when performing the evaluation.
    name: z.string(),
    /// Any hyper-parameters to pass to the model
    parameters: z.object({
      temperature: z.number().optional(),
      topP: z.number().optional(),
      maxNewTokens: z.number().int().optional(),
    }),
  })
  .api("RecipeEvaluationModel");

// MARK: - Recipe Step Input

export const RecipeStepInputKindSchema = z.enum(["constant", "artifact", "metric"]).api("RecipeStepInputKind");

export const BaseRecipeStepInputSchema = z
  .object({
    /// The kind of input.
    kind: RecipeStepInputKindSchema,
    /// The token string to replace with the input in the prompt template.
    token: z.string(),
  })
  .api("BaseRecipeStepInput");

/// A recipe step input that describes a constant value.
export const RecipeStepConstantInputSchema = z
  .object({
    ...BaseRecipeStepInputSchema.shape,
    kind: RecipeStepInputKindSchema.constants().constant,
    /// The constant string to use as input for evaluation.
    input: z.string(),
  })
  .api("RecipeStepConstantInput");

/// A recipe step input that describes content or other key path from an artifact.
export const RecipeStepArtifactInputSchema = z
  .object({
    ...BaseRecipeStepInputSchema.shape,
    kind: RecipeStepInputKindSchema.constants().artifact,
    input: z.object({
      /// The relative path to the child artifact from the base artifact that triggered the recipe.
      childArtifactPath: ArtifactPathSchema,
      /// A key path to evaluate on the artifact to determine what to send as an input.
      keyPath: KeyPathSchema,
    }),
  })
  .api("RecipeStepArtifactInput");

/// A recipe step input that describes a specific metric and its evidence from an artifact.
export const RecipeStepMetricInputSchema = z
  .object({
    ...BaseRecipeStepInputSchema.shape,
    kind: RecipeStepInputKindSchema.constants().metric,
    input: z.object({
      /// The relative path to the child artifact from the base artifact that triggered the recipe.
      childArtifactPath: ArtifactPathSchema,
      /// The metric ID to use as an input.
      metricID: MetricIDSchema,
    }),
  })
  .api("RecipeStepMetricInput");

/// A union type of any recipe step input.
export const AnyRecipeStepInputSchema = z
  .intersection(
    BaseRecipeStepInputSchema,
    z.discriminatedUnion("kind", [
      RecipeStepConstantInputSchema,
      RecipeStepArtifactInputSchema,
      RecipeStepMetricInputSchema,
    ]),
  )
  .api("AnyRecipeStepInput");

// MARK: - Recipe Step Output

export const RecipeStepOutputKindSchema = z.enum(["artifact", "snapshot", "metric"]).api("RecipeStepOutputKind");

export const BaseRecipeStepOutputSchema = z
  .object({
    /// The kind of output.
    kind: RecipeStepOutputKindSchema,
    /// The key to associate with this output.
    key: z.string(),
  })
  .api("BaseRecipeStepOutput");

/// A recipe step output that describes an artifact as a destination, ie. for a metric to be copied to.
export const RecipeStepArtifactOutputSchema = z
  .object({
    ...BaseRecipeStepOutputSchema.shape,
    kind: RecipeStepOutputKindSchema.constants().artifact,
    output: z.object({
      /// The relative path to the child artifact from the base artifact that triggered the recipe where data should be saved.
      childArtifactPath: ArtifactPathSchema,
      /// How metrics should be merged when they are bound for an artifact.
      metricValueAggregationRule: MetricValueAggregationRuleSchema,
    }),
  })
  .api("RecipeStepArtifactOutput");

/// A recipe step output that describes an snapshot as a destination to place new content into.
export const RecipeStepSnapshotOutputSchema = z
  .object({
    ...BaseRecipeStepOutputSchema.shape,
    kind: RecipeStepOutputKindSchema.constants().snapshot,
    output: z.object({
      /// The relative path to the child artifact from the base artifact that triggered the recipe where the snapshot should be saved.
      childArtifactPath: ArtifactPathSchema,
    }),
  })
  .api("RecipeStepSnapshotOutput");

/// A recipe step output that describes a metric on an artifact as a destination.
export const RecipeStepMetricOutputSchema = z
  .object({
    ...BaseRecipeStepOutputSchema.shape,
    kind: RecipeStepOutputKindSchema.constants().metric,
    output: z.object({
      /// The relative path to the child artifact from the base artifact that triggered the recipe where the snapshot should be saved.
      childArtifactPath: ArtifactPathSchema,
      /// The metric ID to save the value to.
      metricID: MetricIDSchema,
      /// A flag indicating if evidence should be collected for this metric.
      includeEvidence: z.boolean(),
    }),
  })
  .api("RecipeStepMetricOutput");

/// A union type of any recipe step output.
export const AnyRecipeStepOutputSchema = z
  .intersection(
    BaseRecipeStepOutputSchema,
    z.discriminatedUnion("kind", [
      RecipeStepArtifactOutputSchema,
      RecipeStepSnapshotOutputSchema,
      RecipeStepMetricOutputSchema,
    ]),
  )
  .api("AnyRecipeStepOutput");

// MARK: - Recipe Step Status

export const RecipeStepStatusSchema = z
  .enum(["enabled", "disabled", "migrated", "hidden"])
  .describe(
    "The status of the recipe step: 'enabled' - step runs normally, 'disabled' - step is skipped, 'migrated' - step moved to another recipe and hidden from some UIs, 'hidden' - step deleted and hidden everywhere",
  )
  .api("RecipeStepStatus");

// MARK: - Recipe Kinds

export const RecipeStepKindSchema = z.enum(["evaluate", "copy"]).api("RecipeStepKind");

export const BaseRecipeStepSchema = z
  .object({
    /// An identifier for linking steps together.
    id: RecipeStepIDSchema,
    /// A display name for the step.
    name: z.string(),
    /// The kind of step.
    kind: RecipeStepKindSchema,
    /// The status of the step.
    status: RecipeStepStatusSchema,
    /// The timestamp marking when the step was created.
    creationTimestamp: ISO8601PreciseTimestampSchema,
    /// The timestamp marking when the step was last updated.
    updateTimestamp: ISO8601PreciseTimestampSchema,
    /// Dependencies that must complete successfully for the step to run.
    dependencies: z.array(RecipeStepIDSchema),
  })
  .api("BaseRecipeStep");

/// A recipe step that enqueues an evaluation job, ie. to generate metrics.
export const EvaluateRecipeStepSchema = z
  .object({
    ...BaseRecipeStepSchema.shape,
    kind: RecipeStepKindSchema.constants().evaluate,
    /// The list of inputs that should be passed to the evaluation job.
    inputs: z.array(AnyRecipeStepInputSchema),
    /// The list of outputs we expect to collect from the evaluation job.
    outputs: z.array(
      z.intersection(
        BaseRecipeStepOutputSchema,
        z.discriminatedUnion("kind", [RecipeStepSnapshotOutputSchema, RecipeStepMetricOutputSchema]),
      ),
    ),
    /// The prompt template string to pass to the evaluation job.
    promptTemplate: z.string(),
    /// The user prompt for this evaluation step.
    userPrompt: z.string(),
    /// The model to use when performing the evaluation.
    model: RecipeEvaluationModelSchema,
  })
  .api("EvaluateRecipeStep");

/// A recipe step that enqueues a copy job, ie. to aggregate metrics onto a parent artifact.
export const CopyRecipeStepSchema = z
  .object({
    ...BaseRecipeStepSchema.shape,
    kind: RecipeStepKindSchema.constants().copy,
    /// The list of inputs that should be copied to each output.
    inputs: z.array(RecipeStepMetricInputSchema),
    /// The list of outputs we expect to collect from the evaluation job.
    outputs: z.array(RecipeStepArtifactOutputSchema),
  })
  .api("CopyRecipeStep");

export const RecipeStepSchema = z
  .intersection(BaseRecipeStepSchema, z.discriminatedUnion("kind", [EvaluateRecipeStepSchema, CopyRecipeStepSchema]))
  .api("RecipeStep");

// MARK: - Recipe Triggers

export const RecipeTriggerKindSchema = z.enum(["artifactPath"]).api("RecipeTriggerKind");

export const BaseRecipeTriggerSchema = z
  .object({
    /// An identifier used for updating individual triggers.
    id: RecipeTriggerIDSchema,
    /// The evaluation group this trigger is associated with.
    evaluationGroupID: EvaluationGroupIDSchema,
    /// A display name for the trigger.
    name: z.string(),
    /// The kind of trigger.
    kind: RecipeTriggerKindSchema,
    /// The timestamp marking when the trigger was created.
    creationTimestamp: ISO8601PreciseTimestampSchema,
    /// The timestamp marking when the trigger was last updated.
    updateTimestamp: ISO8601PreciseTimestampSchema,
  })
  .api("BaseRecipeTrigger");

export const ArtifactPathRecipeTriggerSchema = z
  .object({
    ...BaseRecipeTriggerSchema.shape,
    kind: RecipeTriggerKindSchema.constants().artifactPath,
    /// The pattern artifacts must match against to trigger the recipe.
    artifactPathPattern: ArtifactPathPatternSchema,
  })
  .api("ArtifactPathRecipeTrigger");

export const RecipeTriggerSchema = z
  .intersection(BaseRecipeTriggerSchema, z.discriminatedUnion("kind", [ArtifactPathRecipeTriggerSchema]))
  .api("RecipeTrigger");

export const PartialBaseRecipeTriggerSchema = z
  .object({
    /// An identifier used for updating individual triggers.
    id: RecipeTriggerIDSchema,
    /// The evaluation group this trigger is associated with.
    evaluationGroupID: EvaluationGroupIDSchema.optional(),
    /// A display name for the trigger.
    name: z.string().optional(),
    /// The kind of trigger. Cannot be optional -- breaks zod parsing at runtime when omitted
    kind: RecipeTriggerKindSchema,
    /// The timestamp marking when the trigger was created.
    creationTimestamp: ISO8601PreciseTimestampSchema.optional(),
    /// The timestamp marking when the trigger was last updated.
    updateTimestamp: ISO8601PreciseTimestampSchema.optional(),
  })
  .api("PartialBaseRecipeTrigger");

export const PartialArtifactPathRecipeTriggerSchema = z
  .object({
    ...PartialBaseRecipeTriggerSchema.shape,
    kind: RecipeTriggerKindSchema.constants().artifactPath,
    /// The pattern artifacts must match against to trigger the recipe.
    artifactPathPattern: ArtifactPathPatternSchema.optional(),
  })
  .api("PartialArtifactPathRecipeTrigger");

export const PartialRecipeTriggerSchema = z
  .intersection(PartialBaseRecipeTriggerSchema, z.discriminatedUnion("kind", [PartialArtifactPathRecipeTriggerSchema]))
  .api("PartialRecipeTrigger");

export const RecipeSchema = z
  .object({
    id: RecipeIDSchema,
    /// The name of the recipe to display.
    name: z.string(),
    /// An optional description to display when inspecting the recipe.
    description: z.string().optional(),
    /// A flag marking the recipe as deleted, ie. it shouldn't be listed, and it shouldn't trigger.
    isDeleted: z.literal(true).optional(),
    /// The timestamp marking when the recipe was created.
    creationTimestamp: ISO8601PreciseTimestampSchema,
    /// The timestamp marking when the recipe was last updated.
    updateTimestamp: ISO8601PreciseTimestampSchema,
    /// The list of triggers that will cause the recipe to evaluate.
    triggers: z.array(RecipeTriggerSchema),
    /// The sequence of steps that will be dispatched under the same recipe run ID.
    steps: z.array(RecipeStepSchema),
  })
  .api("Recipe");

export const PartialRecipeSchema = z
  .object({
    id: RecipeIDSchema,
    /// The name of the recipe to display.
    name: z.string().optional(),
    /// An optional description to display when inspecting the recipe.
    description: z.string().nullish(),
    /// A flag marking the recipe as deleted, ie. it shouldn't be listed, and it shouldn't trigger.
    isDeleted: z.literal(true).nullish(),
    /// Independent updates for steps.
    stepUpdates: z.array(z.union([z.string(), RecipeStepSchema])).optional(),
    /// Independent updates for triggers.
    triggerUpdates: z.array(z.union([z.string(), RecipeTriggerSchema])).optional(),
    /// The timestamp marking when the recipe was created.
    creationTimestamp: ISO8601PreciseTimestampSchema.optional(),
    /// The timestamp marking when the recipe was last updated.
    updateTimestamp: ISO8601PreciseTimestampSchema.optional(),
  })
  .api("PartialRecipe");

/// Load Recipes
export const LoadRecipesRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
  })
  .api("LoadRecipesRequest");

export const LoadRecipesResponseSchema = z
  .object({
    recipes: z.array(RecipeSchema),
    cancelledEvaluationGroupIDs: z.array(EvaluationGroupIDSchema),
  })
  .api("LoadRecipesResponse");

export const RecordRecipeRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    recipe: PartialRecipeSchema,
  })
  .api("RecordRecipeRequest");

export const RecordRecipeResponseSchema = z
  .object({
    status: z.literal("success"),
    recipe: RecipeSchema,
  })
  .api("RecordRecipeResponse");

/// Preview Recipe
export const PreviewRecipeRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    metricName: z.string().optional(),
    question: z.string(),
    artifactSelectors: z.array(ArtifactSelectorSchema),
    evaluateChildArtifactPaths: z.array(ArtifactPathSchema),
    /// Optional evaluation model override. Must match a model ID from the org evaluation model registry.
    evaluationModelID: z.string().optional(),
  })
  .api("PreviewRecipeRequest");

export const PreviewRecipeResponseSchema = z
  .object({
    status: z.literal("success"),
    steps: z.array(RecipeStepSchema),
    metrics: z.array(z.tuple([ArtifactPathSchema, MetricSchema])),
    metricDefinition: MetricDefinitionSchema,
  })
  .api("PreviewRecipeResponse");

/// Run Recipes
export const RunRecipesRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    recipeIDs: z.array(RecipeIDSchema),
    evaluationGroupIDs: z.array(EvaluationGroupIDSchema),
    /// Optional evaluation model override. Must match a model ID from the org evaluation model registry.
    evaluationModelID: z.string().optional(),
  })
  .api("RunRecipesRequest");

export const RunRecipesResponseSchema = z
  .object({
    status: z.enum(["success", "error"]),
    message: z.string().optional(),
  })
  .api("RunRecipesResponse");

export const CancelEvaluationRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
    evaluationGroupID: EvaluationGroupIDSchema,
  })
  .api("CancelEvaluationRequest");

export const CancelEvaluationResponseSchema = z
  .object({
    status: z.literal("success"),
    cancelledJobCount: z.number().int().nonnegative(),
  })
  .api("CancelEvaluationResponse");
