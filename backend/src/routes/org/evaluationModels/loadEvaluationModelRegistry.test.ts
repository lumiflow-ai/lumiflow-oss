import { afterEach, describe, expect, it, vi } from "vitest";

import { loadEvaluationModelRegistry } from "./loadEvaluationModelRegistry";

describe("loadEvaluationModelRegistry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a registry with a valid default model", () => {
    const registry = loadEvaluationModelRegistry();
    const modelIDs = new Set(registry.evaluationModels.map((model) => model.id));

    expect(registry.evaluationModels.length).toBeGreaterThan(0);
    expect(modelIDs.has(registry.defaultEvaluationModelID)).toBe(true);
  });

  it("includes fake model in local development", () => {
    vi.stubEnv("NODE_ENV", "development");

    const registry = loadEvaluationModelRegistry();

    expect(registry.evaluationModels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "fake",
        }),
      ]),
    );
  });

  it("does not include fake model outside local development", () => {
    vi.stubEnv("NODE_ENV", "test");

    const registry = loadEvaluationModelRegistry();

    expect(registry.evaluationModels).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "fake",
        }),
      ]),
    );
  });
});
