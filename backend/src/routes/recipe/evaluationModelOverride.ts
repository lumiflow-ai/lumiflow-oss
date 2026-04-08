import type { EvaluationModelConfiguration, RecipeEvaluationModel } from "@/types";

import { HTTPError } from "@/lib/routeGroup";

import { loadEvaluationModelRegistry } from "@/routes/org/evaluationModels/loadEvaluationModelRegistry";

import type { RecipeStepEvalInputs } from "./types";

export function resolveEvaluationModelOverride({
  requestedEvaluationModelID,
}: {
  requestedEvaluationModelID: string | undefined;
}): EvaluationModelConfiguration | undefined {
  if (!requestedEvaluationModelID) return undefined;

  const registry = loadEvaluationModelRegistry();
  const model = registry.evaluationModels.find((candidate) => candidate.id === requestedEvaluationModelID);
  if (!model) {
    throw new HTTPError(
      400,
      `Evaluation model "${requestedEvaluationModelID}" is not valid. Choose a model ID from /v0.1/org/evaluation-models.`,
    );
  }

  return model;
}

export function recipeEvaluationModelFromConfiguration(
  modelConfiguration: EvaluationModelConfiguration,
): RecipeEvaluationModel {
  return {
    name: modelConfiguration.id,
    parameters: modelConfiguration.defaultParameters ?? {},
  };
}

export function recipeEvaluationModelFromEvaluationServiceModel(
  model: RecipeStepEvalInputs["model"],
): RecipeEvaluationModel {
  return {
    name: model.name,
    parameters: {
      ...(model.temperature !== undefined ? { temperature: model.temperature } : {}),
      ...(model.topP !== undefined ? { topP: model.topP } : {}),
      ...(model.maxNewTokens !== undefined ? { maxNewTokens: model.maxNewTokens } : {}),
    },
  };
}

export function evaluationServiceModelFromConfiguration(
  modelConfiguration: EvaluationModelConfiguration,
): RecipeStepEvalInputs["model"] {
  const model = recipeEvaluationModelFromConfiguration(modelConfiguration);
  return {
    name: model.name,
    ...model.parameters,
  };
}
