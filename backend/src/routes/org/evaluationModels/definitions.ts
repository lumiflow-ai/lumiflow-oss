import { z } from "zod";

import { installAPIExtensions } from "@/lib/apiGeneration";

import { OrganizationIDSchema } from "@/routes/orgs/definitions";

installAPIExtensions();

// MARK: - Models

export const EvaluationModelParametersSchema = z
  .object({
    temperature: z.number().optional(),
    topP: z.number().optional(),
    maxNewTokens: z.number().int().optional(),
  })
  .api("EvaluationModelParameters");

export const EvaluationModelConfigurationSchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
    description: z.string(),
    provider: z.string(),
    costMultiplier: z.string(),
    defaultParameters: EvaluationModelParametersSchema.optional(),
  })
  .api("EvaluationModelConfiguration");

// MARK: - HTTP

export const OrgEvaluationModelsRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
  })
  .api("OrgEvaluationModelsRequest");

export const OrgEvaluationModelsResponseSchema = z
  .object({
    evaluationModels: z.array(EvaluationModelConfigurationSchema),
    defaultEvaluationModelID: z.string(),
  })
  .api("OrgEvaluationModelsResponse");
