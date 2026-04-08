import type { EvaluationModelConfiguration, OrgEvaluationModelsResponse } from "@/types";

type EvaluationModelRegistryEntry = EvaluationModelConfiguration & { hidden?: boolean };

/**
 * Backend evaluation model registry.
 *
 * NOTE:
 * - Keep this base list in sync with models actually supported by the inference service.
 * - Every model in BaseEvaluationModelRegistry must be runnable by inference.
 * - This list is intentionally the user-facing allowlist (it may be a strict subset of inference capabilities).
 * - Additional dev-only models (e.g. LocalDevFakeEvaluationModel) may be appended in development and are not backed by the inference service.
 */
const BaseEvaluationModelRegistry: {
  evaluationModels: EvaluationModelRegistryEntry[];
  defaultEvaluationModelID: string;
} = {
  evaluationModels: [
    {
      id: "nova-micro",
      displayName: "Nova Micro",
      description: "A micro model for lightweight evaluations.",
      provider: "Amazon",
      costMultiplier: "$",
    },
    {
      id: "gpt-oss-20b",
      displayName: "GPT-OSS 20B",
      description: "20B parameter open-source model",
      provider: "OpenAI",
      costMultiplier: "$$",
    },
    {
      id: "llama-3-1-70b",
      displayName: "LLaMA 3.1 70B",
      description: "LLaMA 3.1 with 70B parameters, a strong open-source model.",
      provider: "Meta",
      costMultiplier: "$$$",
      defaultParameters: {
        maxNewTokens: 2048,
      },
    },
    {
      id: "deepseek-r1",
      displayName: "DeepSeek R1",
      description: "A versatile model for a wide range of evaluation tasks.",
      provider: "DeepSeek",
      costMultiplier: "$$$$",
    },
    {
      id: "claude-sonnet-4-6",
      displayName: "Claude Sonnet 4.6",
      description: "A model for complex evaluations.",
      provider: "Anthropic",
      costMultiplier: "$$$$$",
    },
    {
      id: "gpt-5-mini",
      displayName: "GPT-5 mini",
      description: "Fast and cost-efficient default model.",
      provider: "OpenAI",
      costMultiplier: "$$$",
      hidden: true,
    },
    {
      id: "gpt-5-nano",
      displayName: "GPT-5 nano",
      description: "A cost-efficient model.",
      provider: "OpenAI",
      costMultiplier: "$$",
      hidden: true,
    },
  ],
  defaultEvaluationModelID: "gpt-oss-20b",
};

const LocalDevFakeEvaluationModel: OrgEvaluationModelsResponse["evaluationModels"][number] = {
  id: "fake",
  displayName: "Fake model",
  description: "Local development model that returns synthetic responses.",
  provider: "Internal",
  costMultiplier: "$",
};

function visibleModels(models: EvaluationModelRegistryEntry[]): EvaluationModelConfiguration[] {
  return models.filter((m) => !m.hidden).map(({ hidden: _hidden, ...rest }) => rest);
}

export function loadEvaluationModelRegistry(): OrgEvaluationModelsResponse {
  if (process.env.NODE_ENV === "development") {
    const allModels = [...BaseEvaluationModelRegistry.evaluationModels, LocalDevFakeEvaluationModel];
    return {
      ...BaseEvaluationModelRegistry,
      evaluationModels: visibleModels(allModels),
    };
  }

  return {
    ...BaseEvaluationModelRegistry,
    evaluationModels: visibleModels(BaseEvaluationModelRegistry.evaluationModels),
  };
}
