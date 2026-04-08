import { describe, expect, it } from "vitest";

import type { Artifact, EvaluationGroupID, MetricID, MetricReview } from "@/generated/serverTypes";

import { ArtifactNode } from "@/model/artifactNode";

import { findAdjacentQuestion, findNextEligibleQuestion } from "./approvalNavigation.internal";

const testEvalGroupId: EvaluationGroupID = "eval-group-1";
const otherEvalGroupId: EvaluationGroupID = "eval-group-other";

function createArtifact(
  id: string,
  metricIds: MetricID[] = [],
  reviewedMetricIds: MetricID[] = [],
  metricValuesEvaluationGroupID: EvaluationGroupID = testEvalGroupId,
  reviewsEvaluationGroupID: EvaluationGroupID = metricValuesEvaluationGroupID,
): ArtifactNode {
  const metrics = metricIds.map((metricId) => ({
    id: metricId,
    values: [{ eventSummaryID: "event-1", value: true, evaluationGroupID: metricValuesEvaluationGroupID }],
  }));

  const reviews: Record<string, MetricReview> = {};
  for (const metricId of reviewedMetricIds) {
    reviews[`review-${metricId}`] = {
      id: `review-${metricId}`,
      metricId,
      recipeRunId: "run-1",
      evaluationGroupId: reviewsEvaluationGroupID,
      value: "approved",
      author: "user-1",
      createdTimestamp: "2024-01-01T00:00:00Z",
      modifiedTimestamp: "2024-01-01T00:00:00Z",
    };
  }

  const artifact: Artifact = {
    artifactPath: [{ kind: "artifact", id }],
    snapshots: [{ content: { kind: "text", text: "test" }, reviews }],
    metrics,
  };

  return new ArtifactNode({ id, artifact });
}

describe("findNextEligibleQuestion", () => {
  const metric1 = "metric-1";
  const metric2 = "metric-2";
  const metric3 = "metric-3";
  const allMetrics: MetricID[] = [metric1, metric2, metric3];

  const artifact1 = "a1";
  const artifact2 = "a2";

  it("returns next metric in same artifact when eligible", () => {
    const artifacts = [createArtifact(artifact1, allMetrics)];

    const result = findNextEligibleQuestion(0, 0, artifacts, allMetrics, testEvalGroupId);

    expect(result).not.toBeNull();
    expect(result?.artifactNode.id).toBe(artifact1);
    expect(result?.metricId).toBe(metric2);
  });

  it("skips metric with existing human review", () => {
    const artifacts = [createArtifact(artifact1, allMetrics, [metric2])];

    const result = findNextEligibleQuestion(0, 0, artifacts, allMetrics, testEvalGroupId);

    expect(result?.metricId).toBe(metric3);
  });

  it("moves to next artifact when current has no more eligible metrics", () => {
    const artifacts = [createArtifact(artifact1, allMetrics), createArtifact(artifact2, allMetrics)];

    const result = findNextEligibleQuestion(0, 2, artifacts, allMetrics, testEvalGroupId);

    expect(result?.artifactNode.id).toBe(artifact2);
    expect(result?.metricId).toBe(metric1);
  });

  it("finds first eligible in next artifact", () => {
    const artifacts = [createArtifact(artifact1, allMetrics, allMetrics), createArtifact(artifact2, allMetrics)];

    const result = findNextEligibleQuestion(0, 0, artifacts, allMetrics, testEvalGroupId);

    expect(result?.artifactNode.id).toBe(artifact2);
    expect(result?.metricId).toBe(metric1);
  });

  it("returns null when no more eligible questions remain", () => {
    const artifacts = [createArtifact(artifact1, allMetrics)];

    const result = findNextEligibleQuestion(0, 2, artifacts, allMetrics, testEvalGroupId);

    expect(result).toBeNull();
  });

  it("handles being at first artifact and first metric", () => {
    const artifacts = [createArtifact(artifact1, allMetrics, [metric1])];

    const result = findNextEligibleQuestion(0, 0, artifacts, allMetrics, testEvalGroupId);

    expect(result?.metricId).toBe(metric2);
  });

  it("returns null when at last artifact and last metric", () => {
    const artifacts = [createArtifact(artifact1, allMetrics)];

    const result = findNextEligibleQuestion(0, 2, artifacts, allMetrics, testEvalGroupId);

    expect(result).toBeNull();
  });

  it("skips metrics without AI results", () => {
    const artifacts = [createArtifact(artifact1, [metric1, metric3])];

    const result = findNextEligibleQuestion(0, 0, artifacts, allMetrics, testEvalGroupId);

    expect(result?.metricId).toBe(metric3);
  });

  it("returns null when artifacts array is empty", () => {
    const result = findNextEligibleQuestion(0, 0, [], allMetrics, testEvalGroupId);

    expect(result).toBeNull();
  });

  it("returns null when all metrics in all artifacts are reviewed", () => {
    const artifacts = [
      createArtifact(artifact1, allMetrics, allMetrics),
      createArtifact(artifact2, allMetrics, allMetrics),
    ];

    const result = findNextEligibleQuestion(0, 0, artifacts, allMetrics, testEvalGroupId);

    expect(result).toBeNull();
  });

  it("ignores reviews from different evaluation groups", () => {
    const artifacts = [createArtifact(artifact1, allMetrics, allMetrics, testEvalGroupId, otherEvalGroupId)];

    const result = findNextEligibleQuestion(0, 0, artifacts, allMetrics, testEvalGroupId);

    // All metrics are reviewed for otherEvalGroupId, but not for testEvalGroupId
    // so the next eligible metric (after index 0) should be metric2
    expect(result?.metricId).toBe(metric2);
  });

  it("skips metrics with AI results from different evaluation group", () => {
    const artifacts = [createArtifact(artifact1, allMetrics, [], otherEvalGroupId)];

    const result = findNextEligibleQuestion(0, 0, artifacts, allMetrics, testEvalGroupId);

    // AI results exist for otherEvalGroupId, but not for testEvalGroupId
    expect(result).toBeNull();
  });
});

describe("findAdjacentQuestion", () => {
  const metric1 = "metric-1";
  const metric2 = "metric-2";
  const metric3 = "metric-3";
  const allMetrics: MetricID[] = [metric1, metric2, metric3];

  const artifact1 = "a1";
  const artifact2 = "a2";

  it("returns next metric in same artifact even if reviewed", () => {
    const artifacts = [createArtifact(artifact1, allMetrics, [metric2])];

    const result = findAdjacentQuestion("next", 0, 0, artifacts, allMetrics, testEvalGroupId);

    expect(result).not.toBeNull();
    expect(result?.artifactNode.id).toBe(artifact1);
    expect(result?.metricId).toBe(metric2);
  });

  it("returns previous metric in same artifact", () => {
    const artifacts = [createArtifact(artifact1, allMetrics)];

    const result = findAdjacentQuestion("previous", 0, 2, artifacts, allMetrics, testEvalGroupId);

    expect(result?.artifactNode.id).toBe(artifact1);
    expect(result?.metricId).toBe(metric2);
  });

  it("moves to next artifact when current has no more metrics", () => {
    const artifacts = [createArtifact(artifact1, allMetrics), createArtifact(artifact2, allMetrics)];

    const result = findAdjacentQuestion("next", 0, 2, artifacts, allMetrics, testEvalGroupId);

    expect(result?.artifactNode.id).toBe(artifact2);
    expect(result?.metricId).toBe(metric1);
  });

  it("moves to previous artifact when current has no earlier metrics", () => {
    const artifacts = [createArtifact(artifact1, allMetrics), createArtifact(artifact2, allMetrics)];

    const result = findAdjacentQuestion("previous", 1, 0, artifacts, allMetrics, testEvalGroupId);

    expect(result?.artifactNode.id).toBe(artifact1);
    expect(result?.metricId).toBe(metric3);
  });

  it("skips metrics without AI results", () => {
    const artifacts = [createArtifact(artifact1, [metric1, metric3])];

    const result = findAdjacentQuestion("next", 0, 0, artifacts, allMetrics, testEvalGroupId);

    expect(result?.metricId).toBe(metric3);
  });

  it("returns null when no metrics remain in direction", () => {
    const artifacts = [createArtifact(artifact1, allMetrics)];

    const result = findAdjacentQuestion("previous", 0, 0, artifacts, allMetrics, testEvalGroupId);

    expect(result).toBeNull();
  });
});
