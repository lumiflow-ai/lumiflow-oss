import { describe, expect, it } from "vitest";

import type { ArtifactMetricGeneration, ArtifactPath, ArtifactSnapshot, Metric } from "@/types";

import { reconstructArtifact } from "./artifact";

const ARTIFACT_PATH: ArtifactPath = [{ id: "test-artifact" }];

function makeSnapshot(overrides: Partial<ArtifactSnapshot> = {}): ArtifactSnapshot {
  return {
    artifactPath: ARTIFACT_PATH,
    sourceArtifactSelectors: [],
    eventSummaryID: "event-1",
    tags: {},
    metadata: {},
    timestamp: "2024-01-01T00:00:00.000Z",
    content: null,
    metrics: [],
    generations: [],
    ...overrides,
  };
}

function makeMetric(id: string, values: number[]): Metric {
  return {
    id,
    values: values.map((v) => ({
      eventSummaryID: "event-1",
      evaluationGroupID: "00000000-0000-0000-0000-000000000000",
      value: v,
    })),
  };
}

function makeGeneration(
  generationID: string,
  overrides: Partial<ArtifactMetricGeneration> = {},
): ArtifactMetricGeneration {
  return {
    eventSummaryID: "event-1",
    recipeRunID: "run-1",
    generationID,
    modelID: "model-1",
    endTimestamp: "2024-01-01T00:00:00.000Z",
    didComplete: true,
    ...overrides,
  };
}

describe("reconstructArtifact", () => {
  it("returns empty artifact for empty snapshots array", () => {
    const result = reconstructArtifact(ARTIFACT_PATH, []);

    expect(result).toEqual({
      artifactPath: ARTIFACT_PATH,
      sourceArtifactPaths: undefined,
      snapshots: [],
      metrics: [],
      generations: [],
    });
  });

  it("passes through single snapshot unchanged", () => {
    const metric = makeMetric("m1", [1, 2]);
    const generation = makeGeneration("g1");
    const snapshot = makeSnapshot({ metrics: [metric], generations: [generation] });

    const result = reconstructArtifact(ARTIFACT_PATH, [snapshot]);

    expect(result.snapshots).toEqual([snapshot]);
    expect(result.metrics).toEqual([metric]);
    expect(result.generations).toEqual([generation]);
  });

  it("deduplicates source artifact paths by identity", () => {
    const sourcePath1: ArtifactPath = [{ id: "source-1" }];
    const sourcePath2: ArtifactPath = [{ id: "source-2" }];

    const snapshot1 = makeSnapshot({
      sourceArtifactSelectors: [{ artifactPath: sourcePath1 }, { artifactPath: sourcePath2 }],
    });
    const snapshot2 = makeSnapshot({
      sourceArtifactSelectors: [{ artifactPath: sourcePath1 }], // duplicate
    });

    const result = reconstructArtifact(ARTIFACT_PATH, [snapshot1, snapshot2]);

    expect(result.sourceArtifactPaths).toEqual([sourcePath1, sourcePath2]);
  });

  it("keeps sourceArtifactPaths undefined when no source paths exist", () => {
    const snapshot = makeSnapshot({ sourceArtifactSelectors: [] });

    const result = reconstructArtifact(ARTIFACT_PATH, [snapshot]);

    expect(result.sourceArtifactPaths).toBeUndefined();
  });

  it("merges metric values when metrics have the same ID", () => {
    const snapshot1 = makeSnapshot({ metrics: [makeMetric("m1", [1, 2])] });
    const snapshot2 = makeSnapshot({ metrics: [makeMetric("m1", [3, 4])] });

    const result = reconstructArtifact(ARTIFACT_PATH, [snapshot1, snapshot2]);

    expect(result.metrics).toEqual([makeMetric("m1", [1, 2, 3, 4])]);
  });

  it("keeps metrics with different IDs separate", () => {
    const metric1 = makeMetric("m1", [1]);
    const metric2 = makeMetric("m2", [2]);
    const snapshot1 = makeSnapshot({ metrics: [metric1] });
    const snapshot2 = makeSnapshot({ metrics: [metric2] });

    const result = reconstructArtifact(ARTIFACT_PATH, [snapshot1, snapshot2]);

    expect(result.metrics).toEqual([metric1, metric2]);
  });

  it("deduplicates generations by ID, keeping first occurrence", () => {
    const gen1 = makeGeneration("g1", { modelID: "first-model" });
    const gen1Duplicate = makeGeneration("g1", { modelID: "different-model" });
    const gen2 = makeGeneration("g2");

    const snapshot1 = makeSnapshot({ generations: [gen1, gen2] });
    const snapshot2 = makeSnapshot({ generations: [gen1Duplicate] });

    const result = reconstructArtifact(ARTIFACT_PATH, [snapshot1, snapshot2]);

    expect(result.generations).toEqual([gen1, gen2]);
  });

  it("sorts snapshots by timestamp ascending", () => {
    const early = makeSnapshot({ timestamp: "2024-01-01T00:00:00.000Z", eventSummaryID: "early" });
    const middle = makeSnapshot({ timestamp: "2024-06-15T00:00:00.000Z", eventSummaryID: "middle" });
    const late = makeSnapshot({ timestamp: "2024-12-31T00:00:00.000Z", eventSummaryID: "late" });

    const result = reconstructArtifact(ARTIFACT_PATH, [late, early, middle]);

    expect(result.snapshots).toEqual([early, middle, late]);
  });

  it("preserves relative order of snapshots with undefined timestamp", () => {
    // undefined timestamps result in NaN comparisons, preserving original order
    const withTimestamp = makeSnapshot({ timestamp: "2024-06-15T00:00:00.000Z", eventSummaryID: "with" });
    const withoutTimestamp = makeSnapshot({ timestamp: undefined, eventSummaryID: "without" });

    const result = reconstructArtifact(ARTIFACT_PATH, [withTimestamp, withoutTimestamp]);

    expect(result.snapshots).toEqual([withTimestamp, withoutTimestamp]);
  });

  it("does not mutate the original snapshots array", () => {
    const early = makeSnapshot({ timestamp: "2024-01-01T00:00:00.000Z" });
    const late = makeSnapshot({ timestamp: "2024-12-31T00:00:00.000Z" });
    const original = [late, early];

    reconstructArtifact(ARTIFACT_PATH, original);

    expect(original).toEqual([late, early]);
  });
});
