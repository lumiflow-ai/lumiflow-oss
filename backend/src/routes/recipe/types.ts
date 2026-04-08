import { z } from "zod";

import type { ArtifactSelector, EvaluationGroupID, MetricID } from "@/types";

export type RecipeCreateRequest = {
  question: string; // min_length=1, example: "Are any medications mentioned?"
  parameters?: Record<string, string>; // example: {"model": "llama-3-1-70b"}
};

const MetricKindSchema = z.enum(["string", "number", "boolean"]);

const PromptOutSchema = z.object({
  /** @example "Does the artifact mention any medications? Artifact: {input}" */
  template: z.string(),
  /** @example "input" */
  inputName: z.string(),
});

const ModelOutSchema = z.object({
  /** @example "llama-3-1-70b" */
  name: z.string(),
  /** @example 0.9 */
  temperature: z.number().optional(),
  /** @example 0.5 */
  topP: z.number().optional(),
  /** @example 2048 */
  maxNewTokens: z.number().int().optional(),
});

const MetricOutSchema = z.object({
  /** @example "Medication mentioned" */
  name: z.string(),
  /** @example "boolean" */
  kind: MetricKindSchema,
});

export const RecipeCreateResponseSchema = z.object({
  prompt: PromptOutSchema,
  model: ModelOutSchema,
  metric: MetricOutSchema,
});

export type RecipeCreateResponse = z.infer<typeof RecipeCreateResponseSchema>;

// This must match the same type defined in job-service
export type RecipeStepEvalInputs = {
  input: {
    key: string;
    selector: ArtifactSelector;
  };
  prompt: string;
  model: {
    name: string;
    temperature?: number;
    topP?: number;
    maxNewTokens?: number;
  };
  output: {
    selector: ArtifactSelector;
    metricID: MetricID;
  };
  evaluationGroupID: EvaluationGroupID;
};

export type EvaluateRecipeJobRequest = {
  kind: string;
  priority?: number;
  generationID?: string;
  recipeRunID: string;
  orgID: string;
  eventSummaryID: string;
  callbackURL: string | null;
  inputs: Record<string, unknown>;
};

const CreateJobSuccessResponseSchema = z.object({
  type: z.literal("success"),
  generationID: z.string(),
});

const ErrorResponseSchema = z.object({
  type: z.literal("error"),
  reason: z.string(),
});

export const JobResponseSchema = z.union([CreateJobSuccessResponseSchema, ErrorResponseSchema]);

export type JobResponse = z.infer<typeof JobResponseSchema>;
