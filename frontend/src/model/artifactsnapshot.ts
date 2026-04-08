import type {
  Annotation,
  ArtifactSnapshotStrict,
  Metric,
  MetricRecordingStrict,
  MetricStrict,
} from "@/generated/serverTypes";

import type { TypedArtifactSnapshot } from "@/model/artifactNode";

export function toMetricRecordingStrict(metrics: Metric[]): MetricStrict[] {
  const strictMetrics: MetricStrict[] = [];
  for (const metric of metrics) {
    const strictValues: MetricRecordingStrict[] = metric.values
      .filter(({ recipeRunID, generationID }) => !!recipeRunID && !!generationID)
      .map(({ eventSummaryID, recipeRunID, generationID, evaluationGroupID, value, examples }) => ({
        eventSummaryID,
        recipeRunID: recipeRunID ?? "",
        generationID: generationID ?? "",
        evaluationGroupID: evaluationGroupID ?? "00000000-0000-0000-0000-000000000000",
        value,
        examples,
      }));
    if (strictValues.length === 0) continue;
    strictMetrics.push({
      id: metric.id,
      values: strictValues,
      isMock: metric.isMock ? true : undefined,
    });
  }
  return strictMetrics;
}

export function toArtifactSnapshotStrict(
  snapshot:
    | (Omit<TypedArtifactSnapshot, "annotations"> & { annotations?: Record<string, Annotation> })
    | null
    | undefined,
): ArtifactSnapshotStrict | null {
  if (!snapshot || !snapshot.artifactPath || !snapshot.eventSummaryID) return null;
  const annotationsRecord = snapshot.annotations ?? {};
  const dueDatesRecord: Record<string, string> = {};
  for (const [key, value] of Object.entries(snapshot.dueDates ?? {})) {
    dueDatesRecord[key] = value instanceof Date ? value.toISOString() : value;
  }
  return {
    artifactPath: snapshot.artifactPath,
    sourceArtifactSelectors: snapshot.sourceArtifactSelectors ?? [],
    eventSummaryID: snapshot.eventSummaryID,
    tags: snapshot.tags ?? {},
    metadata: snapshot.metadata ?? {},
    content: snapshot.content,
    metrics: toMetricRecordingStrict(snapshot.metrics ?? []),
    timestamp: (snapshot.timestamp ?? new Date()).toISOString(),
    generations: snapshot.generations ?? [],
    annotations: annotationsRecord,
    reviews: snapshot.reviews ?? {},
    dueDates: dueDatesRecord,
  };
}
