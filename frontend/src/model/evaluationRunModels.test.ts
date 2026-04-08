import { describe, expect, it } from "vitest";

import type { Artifact } from "@/generated/serverTypes";

import { modelNamesForEvaluationFromArtifacts } from "./evaluationRunModels";

function makeArtifact({
  metrics,
  generations,
}: {
  metrics?: Artifact["metrics"];
  generations?: Artifact["generations"];
}): Artifact {
  return {
    artifactPath: [],
    snapshots: [],
    metrics,
    generations,
  };
}

describe("modelNamesForEvaluationFromArtifacts", () => {
  it("matches models by generation ID when recipe run ID is missing on metric values", () => {
    const artifacts: Artifact[] = [
      makeArtifact({
        metrics: [
          {
            id: "metric-1",
            values: [
              {
                eventSummaryID: "event-1",
                generationID: "gen-mini",
                evaluationGroupID: "eval-mini",
                value: true,
              },
            ],
          },
        ],
        generations: [
          {
            eventSummaryID: "event-1",
            recipeRunID: "run-mini",
            generationID: "gen-mini",
            modelID: "gpt-5-mini",
            endTimestamp: "2026-03-11T00:00:00.000Z",
            didComplete: true,
          },
        ],
      }),
    ];

    expect(
      modelNamesForEvaluationFromArtifacts({
        evaluationGroupID: "eval-mini",
        artifacts,
      }),
    ).toEqual(["gpt-5-mini"]);
  });

  it("returns models from generations linked to matching evaluation generation IDs", () => {
    const artifacts: Artifact[] = [
      makeArtifact({
        metrics: [
          {
            id: "metric-1",
            values: [
              {
                eventSummaryID: "event-1",
                recipeRunID: "run-mini",
                generationID: "gen-mini",
                evaluationGroupID: "eval-mini",
                value: true,
              },
              {
                eventSummaryID: "event-1",
                recipeRunID: "run-nano",
                generationID: "gen-nano",
                evaluationGroupID: "eval-nano",
                value: true,
              },
            ],
          },
        ],
        generations: [
          {
            eventSummaryID: "event-1",
            recipeRunID: "run-mini",
            generationID: "gen-mini",
            modelID: "gpt-5-mini",
            endTimestamp: "2026-03-11T00:00:00.000Z",
            didComplete: true,
          },
          {
            eventSummaryID: "event-1",
            recipeRunID: "run-nano",
            generationID: "gen-nano",
            modelID: "gpt-5-nano",
            endTimestamp: "2026-03-11T00:00:00.000Z",
            didComplete: true,
          },
        ],
      }),
    ];

    expect(
      modelNamesForEvaluationFromArtifacts({
        evaluationGroupID: "eval-mini",
        artifacts,
      }),
    ).toEqual(["gpt-5-mini"]);
  });

  it("does not over-attribute models when a recipe run has multiple generations", () => {
    const artifacts: Artifact[] = [
      makeArtifact({
        metrics: [
          {
            id: "metric-1",
            values: [
              {
                eventSummaryID: "event-1",
                recipeRunID: "run-1",
                generationID: "gen-keep",
                evaluationGroupID: "eval-1",
                value: true,
              },
            ],
          },
        ],
        generations: [
          {
            eventSummaryID: "event-1",
            recipeRunID: "run-1",
            generationID: "gen-keep",
            modelID: "gpt-5-mini",
            endTimestamp: "2026-03-11T00:00:00.000Z",
            didComplete: true,
          },
          {
            eventSummaryID: "event-1",
            recipeRunID: "run-1",
            generationID: "gen-ignore",
            modelID: "gpt-5-pro",
            endTimestamp: "2026-03-11T00:00:00.000Z",
            didComplete: true,
          },
        ],
      }),
    ];

    expect(
      modelNamesForEvaluationFromArtifacts({
        evaluationGroupID: "eval-1",
        artifacts,
      }),
    ).toEqual(["gpt-5-mini"]);
  });

  it("deduplicates and sorts model names across artifacts", () => {
    const artifacts: Artifact[] = [
      makeArtifact({
        metrics: [
          {
            id: "metric-1",
            values: [
              {
                eventSummaryID: "event-1",
                recipeRunID: "run-1",
                generationID: "gen-1",
                evaluationGroupID: "eval-1",
                value: true,
              },
            ],
          },
        ],
        generations: [
          {
            eventSummaryID: "event-1",
            recipeRunID: "run-1",
            generationID: "gen-1",
            modelID: "gpt-5-nano",
            endTimestamp: "2026-03-11T00:00:00.000Z",
            didComplete: true,
          },
        ],
      }),
      makeArtifact({
        metrics: [
          {
            id: "metric-2",
            values: [
              {
                eventSummaryID: "event-2",
                recipeRunID: "run-2",
                generationID: "gen-2",
                evaluationGroupID: "eval-1",
                value: false,
              },
              {
                eventSummaryID: "event-2",
                recipeRunID: "run-3",
                generationID: "gen-3",
                evaluationGroupID: "eval-1",
                value: true,
              },
            ],
          },
        ],
        generations: [
          {
            eventSummaryID: "event-2",
            recipeRunID: "run-2",
            generationID: "gen-2",
            modelID: "gpt-5-mini",
            endTimestamp: "2026-03-11T00:00:00.000Z",
            didComplete: true,
          },
          {
            eventSummaryID: "event-2",
            recipeRunID: "run-3",
            generationID: "gen-3",
            modelID: "gpt-5-mini",
            endTimestamp: "2026-03-11T00:00:00.000Z",
            didComplete: true,
          },
        ],
      }),
    ];

    expect(
      modelNamesForEvaluationFromArtifacts({
        evaluationGroupID: "eval-1",
        artifacts,
      }),
    ).toEqual(["gpt-5-mini", "gpt-5-nano"]);
  });

  it("ignores generations that do not belong to evaluation run IDs", () => {
    const artifacts: Artifact[] = [
      makeArtifact({
        metrics: [
          {
            id: "metric-1",
            values: [
              {
                eventSummaryID: "event-1",
                recipeRunID: "run-1",
                generationID: "gen-1",
                evaluationGroupID: "eval-1",
                value: true,
              },
            ],
          },
        ],
        generations: [
          {
            eventSummaryID: "event-1",
            recipeRunID: "run-2",
            generationID: "gen-2",
            modelID: "gpt-5-nano",
            endTimestamp: "2026-03-11T00:00:00.000Z",
            didComplete: true,
          },
        ],
      }),
    ];

    expect(
      modelNamesForEvaluationFromArtifacts({
        evaluationGroupID: "eval-1",
        artifacts,
      }),
    ).toEqual([]);
  });

  it("falls back to recipe run IDs when generation IDs are unavailable", () => {
    const artifacts: Artifact[] = [
      makeArtifact({
        metrics: [
          {
            id: "metric-1",
            values: [
              {
                eventSummaryID: "event-1",
                recipeRunID: "run-1",
                evaluationGroupID: "eval-1",
                value: true,
              },
            ],
          },
        ],
        generations: [
          {
            eventSummaryID: "event-1",
            recipeRunID: "run-1",
            generationID: "gen-1",
            modelID: "gpt-5-nano",
            endTimestamp: "2026-03-11T00:00:00.000Z",
            didComplete: true,
          },
        ],
      }),
    ];

    expect(
      modelNamesForEvaluationFromArtifacts({
        evaluationGroupID: "eval-1",
        artifacts,
      }),
    ).toEqual(["gpt-5-nano"]);
  });

  it("uses model display names when available and falls back to model IDs", () => {
    const artifacts: Artifact[] = [
      makeArtifact({
        metrics: [
          {
            id: "metric-1",
            values: [
              {
                eventSummaryID: "event-1",
                recipeRunID: "run-1",
                generationID: "gen-1",
                evaluationGroupID: "eval-1",
                value: true,
              },
              {
                eventSummaryID: "event-1",
                recipeRunID: "run-2",
                generationID: "gen-2",
                evaluationGroupID: "eval-1",
                value: true,
              },
            ],
          },
        ],
        generations: [
          {
            eventSummaryID: "event-1",
            recipeRunID: "run-1",
            generationID: "gen-1",
            modelID: "gpt-5-mini",
            endTimestamp: "2026-03-11T00:00:00.000Z",
            didComplete: true,
          },
          {
            eventSummaryID: "event-1",
            recipeRunID: "run-2",
            generationID: "gen-2",
            modelID: "gpt-5-nano",
            endTimestamp: "2026-03-11T00:00:00.000Z",
            didComplete: true,
          },
        ],
      }),
    ];

    expect(
      modelNamesForEvaluationFromArtifacts({
        evaluationGroupID: "eval-1",
        artifacts,
        modelDisplayNameForID: new Map([["gpt-5-mini", "GPT-5 Mini"]]),
      }),
    ).toEqual(["GPT-5 Mini", "gpt-5-nano"]);
  });
});
