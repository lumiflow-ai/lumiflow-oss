import { describe, expect, it } from "vitest";

import type { EvaluationModelConfiguration } from "@/types";

import { HTTPError } from "@/lib/routeGroup";

import {
  evaluationServiceModelFromConfiguration,
  recipeEvaluationModelFromConfiguration,
  recipeEvaluationModelFromEvaluationServiceModel,
  resolveEvaluationModelOverride,
} from "./evaluationModelOverride";

const testModelConfiguration: EvaluationModelConfiguration = {
  id: "gpt-5-mini",
  displayName: "GPT-5 mini",
  description: "Fast and cost-efficient default model.",
  provider: "OpenAI",
  costMultiplier: "$$$",
  defaultParameters: {
    maxNewTokens: 2048,
  },
};

describe("resolveEvaluationModelOverride", () => {
  it("returns undefined when no model override is requested", () => {
    expect(resolveEvaluationModelOverride({ requestedEvaluationModelID: undefined })).toBeUndefined();
  });

  it("resolves a known model override from the registry", () => {
    const model = resolveEvaluationModelOverride({ requestedEvaluationModelID: "nova-micro" });
    expect(model?.id).toEqual("nova-micro");
  });

  it("resolves llama model override with default parameters from the registry", () => {
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

describe("recipeEvaluationModelFromConfiguration", () => {
  it("maps registry config to recipe step model shape", () => {
    expect(recipeEvaluationModelFromConfiguration(testModelConfiguration)).toEqual({
      name: "gpt-5-mini",
      parameters: {
        maxNewTokens: 2048,
      },
    });
  });
});

describe("evaluationServiceModelFromConfiguration", () => {
  it("maps registry config to eval-service model shape", () => {
    expect(evaluationServiceModelFromConfiguration(testModelConfiguration)).toEqual({
      name: "gpt-5-mini",
      maxNewTokens: 2048,
    });
  });
});

describe("recipeEvaluationModelFromEvaluationServiceModel", () => {
  it("maps eval-service model to recipe step model shape", () => {
    expect(
      recipeEvaluationModelFromEvaluationServiceModel({
        name: "gpt-5-mini",
        temperature: 0.4,
        topP: 0.9,
        maxNewTokens: 1024,
      }),
    ).toEqual({
      name: "gpt-5-mini",
      parameters: {
        temperature: 0.4,
        topP: 0.9,
        maxNewTokens: 1024,
      },
    });
  });

  it("omits unknown fields and does not nest model name in parameters", () => {
    const evalServiceModel = {
      name: "gpt-5-mini",
      temperature: 0.2,
    } as unknown as Parameters<typeof recipeEvaluationModelFromEvaluationServiceModel>[0];

    expect(recipeEvaluationModelFromEvaluationServiceModel(evalServiceModel)).toEqual({
      name: "gpt-5-mini",
      parameters: {
        temperature: 0.2,
      },
    });
  });
});
