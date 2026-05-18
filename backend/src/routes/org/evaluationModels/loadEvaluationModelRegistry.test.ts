import { afterEach, describe, expect, it, vi } from "vitest";

describe("loadEvaluationModelRegistry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function importLoadEvaluationModelRegistry() {
    return (await import("./loadEvaluationModelRegistry")).loadEvaluationModelRegistry;
  }

  it("returns a registry with a valid default model", async () => {
    const loadEvaluationModelRegistry = await importLoadEvaluationModelRegistry();
    const registry = loadEvaluationModelRegistry();
    const modelIDs = new Set(registry.evaluationModels.map((model) => model.id));

    expect(registry.evaluationModels.length).toBeGreaterThan(0);
    expect(modelIDs.has(registry.defaultEvaluationModelID)).toBe(true);
  });

  it("includes fake model in local development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const loadEvaluationModelRegistry = await importLoadEvaluationModelRegistry();
    const registry = loadEvaluationModelRegistry();

    expect(registry.defaultEvaluationModelID).toBe("fake");
    expect(registry.evaluationModels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "fake",
        }),
      ]),
    );
  });

  it("does not include fake model outside local development", async () => {
    vi.stubEnv("NODE_ENV", "test");

    const loadEvaluationModelRegistry = await importLoadEvaluationModelRegistry();
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
