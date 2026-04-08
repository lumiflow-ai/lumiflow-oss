import type {
  Artifact,
  ArtifactPath,
  ArtifactSnapshot,
  EventSummaryID,
  KeyPath,
  Metric,
  MetricID,
  MetricReview,
  OrganizationID,
  RenderedContent,
} from "@/generated/serverTypes";

import { encodeArtifactPath } from "@/model/artifactPath";
import {
  ItemNode,
  isPrimitiveValue,
  type KeyPathContext,
  KeyPathValue,
  popFirstKeyPathComponent,
  type SortDescriptor,
  sortItems,
  valueForKeyPath,
} from "@/model/keyPath";
import { valueForMetricKeyPath } from "@/model/metrics";

export type TypedArtifactSnapshot = Omit<ArtifactSnapshot, "timestamp" | "dueDates"> & {
  timestamp?: Date;
  dueDates?: Record<string, Date>;
};

export type TypedArtifact = Omit<Artifact, "snapshots"> & {
  snapshots: TypedArtifactSnapshot[];
};

export function latestSnapshotForArtifact(artifactNode: ArtifactNode): TypedArtifactSnapshot | null {
  return artifactNode.artifact?.snapshots.at(-1) ?? null;
}

export function latestSnapshotReviewsForArtifact(artifactNode: ArtifactNode): Record<string, MetricReview> {
  return latestSnapshotForArtifact(artifactNode)?.reviews ?? {};
}

/** Converts an Artifact (with string timestamps from JSON) to TypedArtifact (with Date objects). */
export function toTypedArtifact(artifact: Artifact): TypedArtifact {
  return {
    ...artifact,
    snapshots: artifact.snapshots.map((snapshot) => ({
      ...snapshot,
      timestamp: typeof snapshot.timestamp === "string" ? new Date(snapshot.timestamp) : snapshot.timestamp,
      dueDates: snapshot.dueDates
        ? Object.fromEntries(
            Object.entries(snapshot.dueDates).map(([key, value]) => [
              key,
              typeof value === "string" ? new Date(value) : value,
            ]),
          )
        : undefined,
    })),
  };
}
/** TODO: more documentation */
export class ArtifactNode extends ItemNode<TypedArtifact | undefined> {
  orgID: OrganizationID | undefined;

  _localID: string;
  _caches: {
    numberOfChildren?: number;
    metricsMap?: Map<MetricID, Metric>;
  } = {};

  constructor({
    parent,
    id,
    artifact,
  }: {
    parent?: ArtifactNode;
    id: ArtifactPath | string;
    artifact?: Artifact | TypedArtifact;
  }) {
    const stringID = typeof id === "string" ? id : encodeArtifactPath(id);
    super({ parent, id: stringID, item: artifact as TypedArtifact });

    if (typeof id === "string") {
      this._localID = id;
    } else {
      this._localID = id.length > 0 ? encodeArtifactPath([id[id.length - 1]]) : "";
    }
  }

  get artifact(): TypedArtifact | undefined {
    return this.item;
  }

  set artifact(newValue: TypedArtifact | undefined) {
    this.item = newValue;
  }

  get childlessCopy(): ArtifactNode {
    const copy = new ArtifactNode({
      parent: this.parent,
      id: this.id,
      artifact: this.artifact,
    });
    copy._localID = this._localID;

    return copy;
  }

  orderChildren({
    sortDescriptors,
    ...context
  }: {
    sortDescriptors: SortDescriptor[];
  } & KeyPathContext) {
    this.orderedChildren = sortItems({
      ...context,
      items: Array.from(this.children.values()),
      sortDescriptors,
    });

    for (const child of this.orderedChildren) {
      child.orderChildren({ ...context, sortDescriptors });
    }
  }

  childArtifactWithPath(artifactPath: ArtifactPath): ArtifactNode | null {
    let currentNode: ArtifactNode = this;
    for (const component of artifactPath) {
      const childNode = currentNode.children.get(encodeArtifactPath([component]));
      if (!childNode) return null;
      currentNode = childNode;
    }
    return currentNode;
  }

  valueForKeyPath({ keyPath, ...keyPathContext }: { keyPath: KeyPath } & KeyPathContext): KeyPathValue {
    const { activeEventSummaryID, metricDefinitionForID, kindConfigurationForPattern, evaluationGroupID } =
      keyPathContext;
    const [component, remainingPath] = popFirstKeyPathComponent(keyPath);

    switch (component) {
      case "id": {
        const artifactPath = this.artifact?.artifactPath;
        return valueForKeyPath(artifactPath?.at(-1)?.id ?? null, remainingPath ? remainingPath : "truncated");
      }
      case "eventSummaryID": {
        return valueForKeyPath(
          activeEventSummaryID ?? this.artifact?.snapshots.at(-1)?.eventSummaryID ?? null,
          remainingPath ? remainingPath : "truncated(7, 0)",
        );
      }
      case "kind": {
        const artifactPath = this.artifact?.artifactPath;
        if (!artifactPath) return KeyPathValue(null);
        const lastComponent = artifactPath?.at(-1);
        const identity = lastComponent?.kind ?? lastComponent?.id;
        if (identity) {
          /// Use the display name for sorting and display, raw value for filtering.
          const formattedValue = valueForKeyPath(
            kindConfigurationForPattern?.(artifactPath, "one").displayName ?? identity,
            remainingPath,
          );
          return KeyPathValue({
            ...valueForKeyPath(identity, remainingPath),
            sort: formattedValue.sort,
            display: formattedValue.display,
          });
        }
        return KeyPathValue(null);
      }
      case "numberOfChildren": {
        if (!this._caches.numberOfChildren) {
          this.updateTotalChildren();
        }
        return valueForKeyPath(this._caches.numberOfChildren ?? null, remainingPath);
      }
      case "numberOfDirectChildren": {
        return valueForKeyPath(this.children.size, remainingPath);
      }
      case "creationTimestamp": {
        const timestamp = this.artifact?.snapshots.findLast((snapshot) => snapshot.timestamp)?.timestamp;
        return valueForKeyPath(timestamp, remainingPath);
      }
      case "modificationTimestamp": {
        const timestamp = this.artifact?.snapshots.find((snapshot) => snapshot.timestamp)?.timestamp;
        return valueForKeyPath(timestamp, remainingPath);
      }
      case "content": {
        let content: RenderedContent = null;
        if (activeEventSummaryID) {
          content =
            this.artifact?.snapshots.findLast(({ eventSummaryID }) => eventSummaryID === activeEventSummaryID)
              ?.content ?? null;
        } else {
          content = this.artifact?.snapshots.at(-1)?.content ?? null;
        }
        let contentKeyPath = remainingPath;

        // Iterate over remaining key path components, updating the content dictionary with each subcomponent.
        while (contentKeyPath) {
          if (isPrimitiveValue(content)) return valueForKeyPath(content, contentKeyPath);
          if (contentKeyPath in content) {
            const value = content[contentKeyPath];
            if (isPrimitiveValue(value)) return KeyPathValue(value);
          }
          const [nextKeyComponent, remainingKeyComponents] = popFirstKeyPathComponent(contentKeyPath);
          content = content[nextKeyComponent];
          contentKeyPath = remainingKeyComponents;
        }

        return KeyPathValue(isPrimitiveValue(content) ? content : null);
      }
      case "metadata": {
        let content: RenderedContent = null;
        if (activeEventSummaryID) {
          content =
            this.artifact?.snapshots.findLast(({ eventSummaryID }) => eventSummaryID === activeEventSummaryID)
              ?.metadata ?? null;
        } else {
          content = this.artifact?.snapshots.at(-1)?.metadata ?? null;
        }
        let contentKeyPath = remainingPath;

        // Iterate over remaining key path components, updating the content dictionary with each subcomponent.
        while (contentKeyPath) {
          if (isPrimitiveValue(content)) return valueForKeyPath(content, contentKeyPath);
          if (contentKeyPath in content) {
            const value = content[contentKeyPath];
            if (isPrimitiveValue(value)) return KeyPathValue(value);
          }
          const [nextKeyComponent, remainingKeyComponents] = popFirstKeyPathComponent(contentKeyPath);
          content = content[nextKeyComponent];
          contentKeyPath = remainingKeyComponents;
        }

        return KeyPathValue(isPrimitiveValue(content) ? content : null);
      }
      case "metrics": {
        const [metricID, metricKeyPath] = popFirstKeyPathComponent(remainingPath);
        const metric = this.metricForID({ id: metricID, activeEventSummaryID });
        return valueForMetricKeyPath({ metric, metricDefinitionForID, keyPath: metricKeyPath, evaluationGroupID });
      }
      case "parent": {
        if (!this.parent) return KeyPathValue(null);
        return this.parent.valueForKeyPath({ ...keyPathContext, keyPath: remainingPath });
      }
      case "rootParent": {
        let current: ArtifactNode = this;
        while (current.parent) current = current.parent;
        return current.valueForKeyPath({ ...keyPathContext, keyPath: remainingPath });
      }
    }

    return KeyPathValue(null);
  }

  isMockedValueForKeyPaths(keyPaths: KeyPath[]): boolean {
    for (const path of keyPaths) {
      const [component, id] = popFirstKeyPathComponent(path);
      if (component !== "metrics") return false;
      return this.metricForID({ id, activeEventSummaryID: null })?.isMock ?? false;
    }
    return false;
  }

  metricForID({
    id,
    activeEventSummaryID,
  }: {
    id: MetricID;
    activeEventSummaryID?: EventSummaryID | null;
  }): Metric | null {
    const rawMetrics = this.artifact?.metrics;
    if (!rawMetrics) return null;
    let metrics = this._caches.metricsMap;
    if (!metrics) {
      metrics = new Map(rawMetrics.map((metric) => [metric.id, metric]));
      this._caches.metricsMap = metrics;
    }

    const metric = metrics.get(id) ?? null;
    if (activeEventSummaryID && metric) {
      return {
        ...metric,
        values: metric.values.filter(({ eventSummaryID }) => eventSummaryID === activeEventSummaryID),
      };
    }
    return metric;
  }

  updateTotalChildren() {
    let totalChildren = 0;
    for (const [_, child] of this.children) {
      totalChildren += child.updateTotalChildren() + 1;
    }
    this._caches.numberOfChildren = totalChildren;
    return totalChildren;
  }

  splitIntoSnapshotNodes() {
    const rootNode = this.childlessCopy;
    if (rootNode.artifact) {
      for (const snapshot of rootNode.artifact.snapshots) {
        if (!snapshot.eventSummaryID) continue;
        const newNode = new ArtifactNode({
          id: snapshot.eventSummaryID,
          parent: rootNode,
          artifact: {
            artifactPath: rootNode.artifact.artifactPath,
            snapshots: [snapshot],
            metrics: rootNode.artifact.metrics?.filter((metric) =>
              metric.values.some((value) => value.eventSummaryID === snapshot.eventSummaryID),
            ),
            generations: rootNode.artifact.generations,
          },
        });
        for (const [id, child] of this.children) {
          newNode.children.set(id, child.splitIntoSnapshotNodes());
        }
        rootNode.children.set(snapshot.eventSummaryID, newNode);
      }
    }
    return rootNode;
  }
}
