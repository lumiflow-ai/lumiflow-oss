import type { EvaluationGroupID, MetricID } from "@/generated/serverTypes";

import type { ArtifactNode } from "@/model/artifactNode";

/**
 * Finds the next artifact/metric combination that is eligible for review:
 * - Has an AI evaluation result (any recorded value)
 * - Does not already have a human review for this evaluation group
 *
 * Returns null if no eligible questions remain.
 */
export function findNextEligibleQuestion(
  currentArtifactIndex: number,
  currentMetricIndex: number,
  orderedArtifacts: ArtifactNode[],
  orderedMetricIds: MetricID[],
  evaluationGroupId: EvaluationGroupID,
): { artifactNode: ArtifactNode; metricId: MetricID } | null {
  for (let ai = currentArtifactIndex; ai < orderedArtifacts.length; ai++) {
    const artifact = orderedArtifacts[ai];
    const startMetricIndex = ai === currentArtifactIndex ? currentMetricIndex + 1 : 0;

    for (let mi = startMetricIndex; mi < orderedMetricIds.length; mi++) {
      const metricId = orderedMetricIds[mi];

      if (
        hasAIResult(artifact, metricId, evaluationGroupId) &&
        !hasHumanReview(artifact, metricId, evaluationGroupId)
      ) {
        return { artifactNode: artifact, metricId };
      }
    }
  }

  return null;
}

/**
 * Finds the next/previous artifact/metric combination that has an AI evaluation result.
 * Unlike findNextEligibleQuestion, this does not skip reviewed metrics.
 */
export function findAdjacentQuestion(
  direction: "previous" | "next",
  currentArtifactIndex: number,
  currentMetricIndex: number,
  orderedArtifacts: ArtifactNode[],
  orderedMetricIds: MetricID[],
  evaluationGroupId: EvaluationGroupID,
): { artifactNode: ArtifactNode; metricId: MetricID } | null {
  if (direction === "next") {
    for (let ai = currentArtifactIndex; ai < orderedArtifacts.length; ai++) {
      const artifact = orderedArtifacts[ai];
      const startMetricIndex = ai === currentArtifactIndex ? currentMetricIndex + 1 : 0;

      for (let mi = startMetricIndex; mi < orderedMetricIds.length; mi++) {
        const metricId = orderedMetricIds[mi];
        if (hasAIResult(artifact, metricId, evaluationGroupId)) {
          return { artifactNode: artifact, metricId };
        }
      }
    }
  } else {
    for (let ai = currentArtifactIndex; ai >= 0; ai--) {
      const artifact = orderedArtifacts[ai];
      const startMetricIndex = ai === currentArtifactIndex ? currentMetricIndex - 1 : orderedMetricIds.length - 1;

      for (let mi = startMetricIndex; mi >= 0; mi--) {
        const metricId = orderedMetricIds[mi];
        if (hasAIResult(artifact, metricId, evaluationGroupId)) {
          return { artifactNode: artifact, metricId };
        }
      }
    }
  }

  return null;
}

function hasAIResult(artifact: ArtifactNode, metricId: MetricID, evaluationGroupId: EvaluationGroupID): boolean {
  const metric = artifact.metricForID({ id: metricId, activeEventSummaryID: null });
  if (!metric) return false;
  return metric.values.some((value) => value.evaluationGroupID === evaluationGroupId);
}

function hasHumanReview(artifact: ArtifactNode, metricId: MetricID, evaluationGroupId: EvaluationGroupID): boolean {
  const snapshot = artifact.artifact?.snapshots[0];
  if (!snapshot?.reviews) return false;
  return Object.values(snapshot.reviews).some(
    (review) => review.metricId === metricId && review.evaluationGroupId === evaluationGroupId,
  );
}
