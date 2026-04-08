import { describe, expect, it } from "vitest";

import type { Recipe } from "@/types";
import { RecipeStepKind, RecipeStepStatus } from "@/types";

import { HTTPError } from "@/lib/routeGroup";

import { __visibleForTesting } from "./runRecipes";

const { buildRecipeForRun, resolveEvaluationModelOverride } = __visibleForTesting;

function makeRecipe(): Recipe {
  return {
    id: "recipe-1",
    steps: [
      {
        id: "step-eval-enabled",
        kind: RecipeStepKind.evaluate,
        status: RecipeStepStatus.enabled,
        model: {
          name: "recipe-model",
          parameters: {
            temperature: 0.2,
          },
        },
      },
      {
        id: "step-copy-enabled",
        kind: RecipeStepKind.copy,
        status: RecipeStepStatus.enabled,
      },
      {
        id: "step-eval-disabled",
        kind: RecipeStepKind.evaluate,
        status: RecipeStepStatus.disabled,
        model: {
          name: "disabled-model",
          parameters: {
            topP: 0.8,
          },
        },
      },
    ],
  } as unknown as Recipe;
}

describe("resolveEvaluationModelOverride", () => {
  it("returns undefined when no model override is requested", () => {
    expect(resolveEvaluationModelOverride({ requestedEvaluationModelID: undefined })).toBeUndefined();
  });

  it("resolves a known model override from the registry", () => {
    const model = resolveEvaluationModelOverride({ requestedEvaluationModelID: "llama-3-1-70b" });
    expect(model?.id).toEqual("llama-3-1-70b");
    expect(model?.defaultParameters).toEqual({ maxNewTokens: 2048 });
  });

  it("throws HTTP 400 for an unknown model override", () => {
    expect(() => resolveEvaluationModelOverride({ requestedEvaluationModelID: "does-not-exist" })).toThrowError(
      HTTPError,
    );
    try {
      resolveEvaluationModelOverride({ requestedEvaluationModelID: "does-not-exist" });
    } catch (error) {
      expect((error as HTTPError).status).toEqual(400);
    }
  });
});

describe("buildRecipeForRun", () => {
  it("keeps recipe model configuration when no override is requested", () => {
    const recipe = makeRecipe();
    const builtRecipe = buildRecipeForRun({
      recipe,
      evaluationModelOverride: undefined,
    });

    expect(builtRecipe.steps).toHaveLength(2);
    const evalStep = builtRecipe.steps.find((step) => step.id === "step-eval-enabled");
    expect(evalStep?.kind).toEqual(RecipeStepKind.evaluate);
    if (evalStep?.kind === RecipeStepKind.evaluate) {
      expect(evalStep.model).toEqual({
        name: "recipe-model",
        parameters: {
          temperature: 0.2,
        },
      });
    }
  });

  it("overrides enabled evaluate steps with the selected registry model", () => {
    const recipe = makeRecipe();
    const modelOverride = resolveEvaluationModelOverride({ requestedEvaluationModelID: "llama-3-1-70b" });
    const builtRecipe = buildRecipeForRun({
      recipe,
      evaluationModelOverride: modelOverride,
    });

    expect(builtRecipe.steps).toHaveLength(2);
    expect(builtRecipe.steps.some((step) => step.id === "step-eval-disabled")).toBe(false);

    const evalStep = builtRecipe.steps.find((step) => step.id === "step-eval-enabled");
    expect(evalStep?.kind).toEqual(RecipeStepKind.evaluate);
    if (evalStep?.kind === RecipeStepKind.evaluate) {
      expect(evalStep.model).toEqual({
        name: "llama-3-1-70b",
        parameters: {
          maxNewTokens: 2048,
        },
      });
    }

    const originalEvalStep = recipe.steps.find((step) => step.id === "step-eval-enabled");
    expect(originalEvalStep?.kind).toEqual(RecipeStepKind.evaluate);
    if (originalEvalStep?.kind === RecipeStepKind.evaluate) {
      expect(originalEvalStep.model).toEqual({
        name: "recipe-model",
        parameters: {
          temperature: 0.2,
        },
      });
    }
  });
});
