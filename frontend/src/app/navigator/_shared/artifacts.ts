/**
 * Client data layer for artifacts.
 *
 * Manages synchronization between client and server, maintaining an in-memory
 * cache via SWR. Provides hooks for reading artifacts and functions for writing
 * that automatically keep the cache consistent with server state.
 */

import { useMemo } from "react";
import useSWR, { mutate } from "swr";

import { fetchGET as backendFetchGET, fetchRecordArtifactContents, getBackendURL } from "@/generated/serverEndpoints";
import type {
  Artifact,
  ArtifactPath,
  ArtifactSnapshotDelta,
  EventSummaryID,
  MetricDefinition,
  MetricID,
  RecordArtifactContentsRequest,
  UpdateArtifactSnapshotRequest,
  UpdateArtifactSnapshotResponse,
} from "@/generated/serverTypes";

import { ArtifactNode, type TypedArtifact, toTypedArtifact } from "@/model/artifactNode";
import { encodeArtifactPath, encodeArtifactPathPattern, matchingPatternsForArtifactPath } from "@/model/artifactPath";
import { type SortDescriptor, sortItems } from "@/model/keyPath";

import type { KindConfigurationLookup } from "@/components/contexts/OrganizationContext";

import type { SWRResponse } from "./types";

async function fetchArtifacts(
  orgID: string | undefined,
  signal: AbortSignal | null = null,
): Promise<{ artifacts: Artifact[] }> {
  if (!orgID) return { artifacts: [] };
  return await backendFetchGET("/v0.1/artifacts", { orgID }, signal);
}

// MARK: - Hooks

export const useContentArtifactTree = (artifacts: TypedArtifact[] | undefined) => {
  return useMemo(() => {
    const tree = new Map<string, ArtifactNode>();
    const nodesByID = new Map<string, ArtifactNode[]>();
    const nodesByKindLookup = new Map<string, Set<string>>();
    const nodesByKind = new Map<string, ArtifactNode[]>();

    for (const artifact of artifacts ?? []) {
      const key = encodeArtifactPath(artifact.artifactPath);

      let parent: ArtifactNode | undefined;
      const fullID: ArtifactPath = [];
      for (const localID of artifact.artifactPath) {
        fullID.push(localID);
        const _localID = encodeArtifactPath([localID]);
        const children: Map<string, ArtifactNode> = parent?.children ?? tree;
        let existingNode = children.get(_localID);
        if (!existingNode) {
          existingNode = new ArtifactNode({
            id: fullID,
            parent,
          });
          children.set(_localID, existingNode);
        }
        parent = existingNode;
      }
      if (parent) {
        parent.artifact = artifact;
        const oldNodesByID = nodesByID.get(key) ?? [];
        nodesByID.set(key, [...oldNodesByID, parent]);

        const kindPatterns = matchingPatternsForArtifactPath(artifact.artifactPath);
        for (const pattern of kindPatterns) {
          const encodedPattern = encodeArtifactPathPattern(pattern);
          const oldNodesIDs = nodesByKindLookup.get(encodedPattern) ?? new Set();
          const oldNodes = nodesByKind.get(encodedPattern) ?? [];
          if (!oldNodesIDs.has(parent.id)) {
            oldNodesIDs.add(parent.id);
            oldNodes.push(parent);
            nodesByKindLookup.set(encodedPattern, oldNodesIDs);
            nodesByKind.set(encodedPattern, oldNodes);
          }
        }
      }
    }

    const rootNodes = Array.from(tree.values());

    return { tree, nodesByID, nodesByKind, rootNodes };
  }, [artifacts]);
};

export function useOrderedContentArtifactTree({
  tree,
  sortDescriptors,
  activeEventSummaryID,
  metricDefinitionForID,
  kindConfigurationForPattern,
}: {
  tree: Map<string, ArtifactNode>;
  sortDescriptors: SortDescriptor[];
  activeEventSummaryID: EventSummaryID | null;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
  kindConfigurationForPattern: KindConfigurationLookup;
}) {
  return useMemo(
    () =>
      sortItems({
        items: Array.from(tree.values()),
        sortDescriptors,
        activeEventSummaryID,
        metricDefinitionForID,
        kindConfigurationForPattern,
      }),
    [tree, sortDescriptors, activeEventSummaryID, metricDefinitionForID, kindConfigurationForPattern],
  );
}

export const useContentArtifacts = (orgID: string | undefined): SWRResponse<TypedArtifact[]> => {
  const { data, error, isLoading } = useSWR(orgID, fetchArtifacts);
  return useMemo(() => {
    const artifacts = data?.artifacts.map(toTypedArtifact);
    return { response: artifacts, error, isLoading };
  }, [data, error, isLoading]);
};

export const invalidateContentArtifacts = async (orgID: string | undefined) => {
  await mutate(orgID); // FIXME: The key should not be the org ID but a tuple of path and request.
};

function replaceArtifactInList(artifacts: Artifact[], updatedArtifact: Artifact): Artifact[] {
  const artifactKey = encodeArtifactPath(updatedArtifact.artifactPath);
  return artifacts.map((artifact) =>
    encodeArtifactPath(artifact.artifactPath) === artifactKey ? updatedArtifact : artifact,
  );
}

function applySnapshotDeltaToArtifact({
  artifact,
  eventSummaryID,
  snapshot,
}: {
  artifact: Artifact;
  eventSummaryID: EventSummaryID;
  snapshot: ArtifactSnapshotDelta;
}): Artifact {
  return {
    ...artifact,
    snapshots: artifact.snapshots.map((existingSnapshot) => {
      if (existingSnapshot.eventSummaryID !== eventSummaryID) return existingSnapshot;

      return {
        ...existingSnapshot,
        annotations: snapshot.annotations
          ? { ...(existingSnapshot.annotations ?? {}), ...snapshot.annotations }
          : existingSnapshot.annotations,
        reviews: snapshot.reviews
          ? { ...(existingSnapshot.reviews ?? {}), ...snapshot.reviews }
          : existingSnapshot.reviews,
        dueDates: snapshot.dueDates
          ? { ...(existingSnapshot.dueDates ?? {}), ...snapshot.dueDates }
          : existingSnapshot.dueDates,
      };
    }),
  };
}

async function patchArtifactInCache(orgID: string | undefined, updatedArtifact: Artifact): Promise<void> {
  if (!orgID) return;

  await mutate(
    orgID,
    (currentData: { artifacts: Artifact[] } | undefined) => {
      if (!currentData?.artifacts) return currentData;
      return { ...currentData, artifacts: replaceArtifactInList(currentData.artifacts, updatedArtifact) };
    },
    { revalidate: false },
  );
}

async function patchSnapshotDeltaInCache({
  orgID,
  artifactPath,
  eventSummaryID,
  snapshot,
}: {
  orgID: RecordArtifactContentsRequest["orgID"] | undefined;
  artifactPath: ArtifactPath;
  eventSummaryID: EventSummaryID;
  snapshot: ArtifactSnapshotDelta;
}): Promise<void> {
  if (!orgID) return;

  const artifactKey = encodeArtifactPath(artifactPath);

  await mutate(
    orgID,
    (currentData: { artifacts: Artifact[] } | undefined) => {
      if (!currentData?.artifacts) return currentData;
      return {
        ...currentData,
        artifacts: currentData.artifacts.map((artifact) => {
          const currentArtifactKey = encodeArtifactPath(artifact.artifactPath);
          if (currentArtifactKey !== artifactKey) return artifact;
          return applySnapshotDeltaToArtifact({ artifact, eventSummaryID, snapshot });
        }),
      };
    },
    { revalidate: false },
  );
}

/**
 * Sends artifact contents to the server and updates the local cache on success.
 */
export async function fetchUpsertArtifact(request: RecordArtifactContentsRequest): Promise<void> {
  const response = await fetchRecordArtifactContents(request);
  if (response.status === "success") {
    await patchArtifactInCache(request.orgID, response.artifact);
  }
}

/**
 * Sends a partial snapshot update to the server and patches local cache state on success.
 */
export async function fetchUpdateArtifactSnapshot(request: UpdateArtifactSnapshotRequest): Promise<void> {
  const response = await fetch(getBackendURL("v0.1/artifacts/snapshots/update"), {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orgID: request.orgID,
      artifactPath: request.artifactPath,
      eventSummaryID: request.eventSummaryID,
      snapshotDelta: request.snapshotDelta,
    }),
  });

  const json = (await response.json()) as Partial<UpdateArtifactSnapshotResponse>;
  const message = json.message ?? "Unable to update artifact snapshot";
  if (response.status !== 200) {
    throw new Error(message);
  }
  if (json.status !== "success") {
    throw new Error(message);
  }

  await patchSnapshotDeltaInCache({
    orgID: request.orgID,
    artifactPath: request.artifactPath,
    eventSummaryID: request.eventSummaryID,
    snapshot: request.snapshotDelta,
  });
}

export const __visibleForTesting = {
  replaceArtifactInList,
};
