import type { ArtifactNode } from "@/model/artifactNode";
import type { Evaluation } from "@/model/evaluation";

import type { RecipeMetric, RecipeMetricSetNodeLookup } from "@/components/contexts/RecipeContext";

export type EvaluationStatus = "Evaluating" | "Done" | "Failed" | "Cancelled";

const ONE_HOUR_IN_MS = 60 * 60 * 1000;

export function deriveEvaluationStatus({
  datasetNodes,
  evaluation,
  recipeMetricSetNodeForID,
}: {
  datasetNodes: ArtifactNode[];
  evaluation: Evaluation;
  recipeMetricSetNodeForID: RecipeMetricSetNodeLookup;
}): EvaluationStatus {
  if (evaluation.isCancelled) return "Cancelled";
  if (datasetNodes.length === 0) return "Done";

  const artifactNodes = datasetNodes.flatMap(
    (datasetNode) => Array.from(datasetNode.children.values()) as ArtifactNode[],
  );
  if (artifactNodes.length === 0) return "Done";

  const metricIDs = new Set<string>();
  for (const recipeID of evaluation.recipeIDs) {
    const metricSetNode = recipeMetricSetNodeForID({ recipeID });
    if (!metricSetNode) continue;

    for (const metricNode of metricSetNode.allChildren<RecipeMetric>()) {
      const metric = metricNode.item;
      if (!metric || metric.isDeleted || !metric.isAccessible) continue;
      metricIDs.add(metric.metricID);
    }
  }

  if (metricIDs.size === 0) return "Done";

  const now = Date.now();
  const creationTime = evaluation.creationTimestamp.getTime();
  const isRecentEvaluation = now - creationTime < ONE_HOUR_IN_MS;

  for (const artifact of artifactNodes) {
    for (const metricID of metricIDs) {
      const artifactMetric = artifact.metricForID({ id: metricID });
      const hasValuesForEvaluation = artifactMetric?.values.some((v) => v.evaluationGroupID === evaluation.id) ?? false;
      if (hasValuesForEvaluation) continue;

      return isRecentEvaluation ? "Evaluating" : "Failed";
    }
  }

  return "Done";
}
