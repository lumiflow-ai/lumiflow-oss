import { afterEach, describe, expect, it, vi } from "vitest";

import type { EvaluationGroupID, MetricID, RecipeID } from "@/generated/serverTypes";

import type { ArtifactNode } from "@/model/artifactNode";
import type { Evaluation } from "@/model/evaluation";
import { deriveEvaluationStatus } from "@/model/evaluationStatus";
import type { ItemNode } from "@/model/keyPath";

import type { RecipeMetric, RecipeMetricSet, RecipeMetricSetNodeLookup } from "@/components/contexts/RecipeContext";

type MockRecipeMetric = Pick<RecipeMetric, "metricID" | "isAccessible" | "isDeleted">;

function createEvaluation({
  id = "evaluation-1",
  creationTimestamp = new Date("2026-01-01T00:00:00.000Z"),
  recipeIDs = ["recipe-1"],
  isCancelled = false,
}: {
  id?: EvaluationGroupID;
  creationTimestamp?: Date;
  recipeIDs?: RecipeID[];
  isCancelled?: boolean;
} = {}): Evaluation {
  return {
    id,
    name: "Evaluation",
    creationTimestamp,
    artifactPathPatterns: [],
    recipeIDs,
    isCancelled,
  };
}

function createArtifactNode(metricsByID: Partial<Record<MetricID, EvaluationGroupID[]>>): ArtifactNode {
  const metricForID: ArtifactNode["metricForID"] = ({ id }) => {
    const evaluationGroupIDs = metricsByID[id];
    if (!evaluationGroupIDs) return null;

    return {
      id,
      values: evaluationGroupIDs.map((evaluationGroupID, index) => ({
        eventSummaryID: `event-${index}`,
        evaluationGroupID,
        value: true,
      })),
    };
  };

  const artifactNode: Pick<ArtifactNode, "children" | "metricForID"> = {
    children: new Map(),
    metricForID,
  };
  return artifactNode as unknown as ArtifactNode;
}

function createDatasetNode(artifacts: ArtifactNode[]): ArtifactNode {
  const datasetNode: Pick<ArtifactNode, "children"> = {
    children: new Map(artifacts.map((artifact, index) => [`artifact-${index}`, artifact])),
  };
  return datasetNode as unknown as ArtifactNode;
}

function createRecipeMetricSetNodeLookup({
  recipeID,
  metrics,
}: {
  recipeID: RecipeID;
  metrics: MockRecipeMetric[];
}): RecipeMetricSetNodeLookup {
  const recipeMetricSetNode = {
    allChildren: () =>
      metrics.map((metric) => ({
        item: metric,
      })),
  } as unknown as ItemNode<RecipeMetricSet>;

  return ({ recipeID: lookupRecipeID }) => (lookupRecipeID === recipeID ? recipeMetricSetNode : null);
}

describe("deriveEvaluationStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns Done when there are no datasets", () => {
    const evaluation = createEvaluation();

    const status = deriveEvaluationStatus({
      datasetNodes: [],
      evaluation,
      recipeMetricSetNodeForID: () => null,
    });

    expect(status).toBe("Done");
  });

  it("returns Cancelled when the evaluation has been cancelled", () => {
    const evaluation = createEvaluation({ isCancelled: true });

    const status = deriveEvaluationStatus({
      datasetNodes: [createDatasetNode([createArtifactNode({})])],
      evaluation,
      recipeMetricSetNodeForID: () => null,
    });

    expect(status).toBe("Cancelled");
  });

  it("returns Done when no accessible metrics are available", () => {
    const evaluation = createEvaluation();
    const recipeMetricSetNodeForID = createRecipeMetricSetNodeLookup({
      recipeID: "recipe-1",
      metrics: [
        { metricID: "metric-deleted", isDeleted: true, isAccessible: true },
        { metricID: "metric-inaccessible", isDeleted: false, isAccessible: false },
      ],
    });
    const datasetNodes = [createDatasetNode([createArtifactNode({})])];

    const status = deriveEvaluationStatus({
      datasetNodes,
      evaluation,
      recipeMetricSetNodeForID,
    });

    expect(status).toBe("Done");
  });

  it("returns Done when all required metrics are present for all artifacts", () => {
    const evaluation = createEvaluation();
    const recipeMetricSetNodeForID = createRecipeMetricSetNodeLookup({
      recipeID: "recipe-1",
      metrics: [
        { metricID: "metric-a", isDeleted: false, isAccessible: true },
        { metricID: "metric-b", isDeleted: false, isAccessible: true },
      ],
    });
    const datasetNodes = [
      createDatasetNode([
        createArtifactNode({
          "metric-a": [evaluation.id],
          "metric-b": [evaluation.id, "another-evaluation"],
        }),
        createArtifactNode({
          "metric-a": [evaluation.id],
          "metric-b": [evaluation.id],
        }),
      ]),
    ];

    const status = deriveEvaluationStatus({
      datasetNodes,
      evaluation,
      recipeMetricSetNodeForID,
    });

    expect(status).toBe("Done");
  });

  it("returns Evaluating when a required metric is missing and the evaluation is recent", () => {
    const now = new Date("2026-01-01T02:00:00.000Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const evaluation = createEvaluation({
      creationTimestamp: new Date(now - 30 * 60 * 1000),
    });
    const recipeMetricSetNodeForID = createRecipeMetricSetNodeLookup({
      recipeID: "recipe-1",
      metrics: [{ metricID: "metric-a", isDeleted: false, isAccessible: true }],
    });
    const datasetNodes = [createDatasetNode([createArtifactNode({ "metric-a": [] })])];

    const status = deriveEvaluationStatus({
      datasetNodes,
      evaluation,
      recipeMetricSetNodeForID,
    });

    expect(status).toBe("Evaluating");
  });

  it("returns Failed when a required metric is missing and the evaluation is stale", () => {
    const now = new Date("2026-01-01T02:00:00.000Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const evaluation = createEvaluation({
      creationTimestamp: new Date(now - 2 * 60 * 60 * 1000),
    });
    const recipeMetricSetNodeForID = createRecipeMetricSetNodeLookup({
      recipeID: "recipe-1",
      metrics: [{ metricID: "metric-a", isDeleted: false, isAccessible: true }],
    });
    const datasetNodes = [createDatasetNode([createArtifactNode({ "metric-a": [] })])];

    const status = deriveEvaluationStatus({
      datasetNodes,
      evaluation,
      recipeMetricSetNodeForID,
    });

    expect(status).toBe("Failed");
  });
});
