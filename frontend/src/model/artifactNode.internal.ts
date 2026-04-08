import type { Artifact, ArtifactPathComponent, ArtifactSnapshot, MetricReview } from "@/generated/serverTypes";

import { ArtifactNode } from "./artifactNode";

type CreateTestArtifactNodeOptions = {
  name: string;
  id?: string | ArtifactPathComponent[];
  artifactPath?: ArtifactPathComponent[];
  metrics?: Artifact["metrics"];
  snapshots?: Artifact["snapshots"];
  metadata?: ArtifactSnapshot["metadata"];
  reviews?: Record<string, MetricReview>;
  content?: ArtifactSnapshot["content"];
  eventSummaryID?: ArtifactSnapshot["eventSummaryID"];
  timestamp?: ArtifactSnapshot["timestamp"];
};

export function createTestArtifactNode({
  name,
  id,
  artifactPath,
  metrics,
  snapshots,
  metadata,
  reviews,
  content,
  eventSummaryID,
  timestamp,
}: CreateTestArtifactNodeOptions): ArtifactNode {
  const resolvedArtifactPath =
    artifactPath ?? (Array.isArray(id) ? id : [{ id: typeof id === "string" ? id : "test-artifact-id" }]);
  const resolvedNodeID = id ?? resolvedArtifactPath;
  const defaultSnapshot: ArtifactSnapshot = {
    eventSummaryID: eventSummaryID ?? "event-1",
    timestamp: timestamp ?? "2024-01-01T00:00:00Z",
    metadata: {
      name,
      ...metadata,
    },
    content: content ?? "",
    reviews: reviews ?? {},
  };
  const testArtifact: Artifact = {
    artifactPath: resolvedArtifactPath,
    snapshots: snapshots ?? [defaultSnapshot],
    metrics: metrics ?? [],
  };

  return new ArtifactNode({
    id: resolvedNodeID,
    artifact: testArtifact,
  });
}
