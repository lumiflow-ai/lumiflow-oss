import { z } from "zod";

import { installOpenAPIExtensions } from "@/server/zodExtensions";

import { JobKinds } from "@/jobQueue/globals";

installOpenAPIExtensions();

export const CreateJobRequestSchema = z
  .object({
    kind: z.enum([JobKinds.evaluateRecipeStep, JobKinds.scheduleRecipeEvaluation]),
    priority: z.number().optional(),
    generationID: z.string().optional(),
    orgID: z.string(),
    recipeRunID: z.string().optional(),
    eventSummaryID: z.string().optional(),
    callbackURL: z.string().nullable(),
    inputs: z.record(z.string(), z.unknown()),
  })
  .api("CreateJobRequest");

export const CancelEvaluationRequestSchema = z
  .object({
    orgID: z.string(),
    evaluationGroupID: z.string(),
  })
  .api("CancelEvaluationRequest");

// MARK: - Responses

export const ResponseTypeSchema = z.enum(["success", "error"]).api("ResponseType");

export const CreateJobSuccessResponseSchema = z
  .object({
    type: z.literal(ResponseTypeSchema.enum.success),
    generationID: z.string(),
  })
  .api("CreateJobSuccessResponse");

export const ErrorResponseSchema = z
  .object({
    type: z.literal(ResponseTypeSchema.enum.error),
    reason: z.string(),
  })
  .api("ErrorResponse");

export const JobResponseSchema = z.union([CreateJobSuccessResponseSchema, ErrorResponseSchema]).api("JobResponse");

export const CancelEvaluationSuccessResponseSchema = z
  .object({
    type: z.literal(ResponseTypeSchema.enum.success),
    cancelledJobCount: z.number().int().nonnegative(),
  })
  .api("CancelEvaluationSuccessResponse");

export const CancelEvaluationResponseSchema = z
  .union([CancelEvaluationSuccessResponseSchema, ErrorResponseSchema])
  .api("CancelEvaluationResponse");
