import type { Artifact, ArtifactMetricGeneration, ArtifactPath, ArtifactSnapshot, Metric } from "@/types";

import { encodeArtifactPath } from "./artifactPath";

/**
 * Reconstructs a finalized Artifact from its snapshots.
 * Deduplicates sourceArtifactPaths, metrics, and generations, and sorts snapshots by timestamp.
 */
export function reconstructArtifact(artifactPath: ArtifactPath, snapshots: ArtifactSnapshot[]): Artifact {
  // Collect all data from snapshots
  const allSourceArtifactPaths: ArtifactPath[] = [];
  const allMetrics: Metric[] = [];
  const allGenerations: ArtifactMetricGeneration[] = [];

  for (const snapshot of snapshots) {
    if (snapshot.sourceArtifactSelectors) {
      allSourceArtifactPaths.push(...snapshot.sourceArtifactSelectors.map(({ artifactPath }) => artifactPath));
    }
    if (snapshot.metrics) {
      allMetrics.push(...snapshot.metrics);
    }
    if (snapshot.generations) {
      allGenerations.push(...snapshot.generations);
    }
  }

  // Deduplicate source artifact paths by identity
  const sourceArtifactPathsSet = new Set<string>();
  let sourceArtifactPaths: ArtifactPath[] | undefined;
  for (const path of allSourceArtifactPaths) {
    const encodedPath = encodeArtifactPath(path);
    if (sourceArtifactPathsSet.has(encodedPath)) continue;
    sourceArtifactPathsSet.add(encodedPath);
    if (!sourceArtifactPaths) sourceArtifactPaths = [];
    sourceArtifactPaths.push(path);
  }

  // Deduplicate metrics by ID, merging values
  const metricsMap = new Map<string, Metric>();
  for (const metric of allMetrics) {
    const existingMetric = metricsMap.get(metric.id);
    if (!existingMetric) {
      metricsMap.set(metric.id, { ...metric });
    } else {
      existingMetric.values.push(...metric.values);
    }
  }

  // Deduplicate generations by ID
  const generationsMap = new Map<string, ArtifactMetricGeneration>();
  for (const generation of allGenerations) {
    if (!generationsMap.has(generation.generationID)) {
      generationsMap.set(generation.generationID, generation);
    }
  }

  // Sort snapshots by timestamp
  const sortedSnapshots = [...snapshots].sort(
    (lhs, rhs) => new Date(lhs.timestamp ?? "").getTime() - new Date(rhs.timestamp ?? "").getTime(),
  );

  return {
    artifactPath,
    sourceArtifactPaths,
    snapshots: sortedSnapshots,
    metrics: Array.from(metricsMap.values()),
    generations: Array.from(generationsMap.values()),
  };
}
