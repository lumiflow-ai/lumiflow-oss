import type { ArtifactSnapshotStrict, EventSummaryID } from "@/types";

import { withPGClient } from "@/server/persistence";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { reconstructArtifact } from "@/model/artifact";
import { encodeArtifactPath } from "@/model/artifactPath";

import { ArtifactContentsRequestSchema, ArtifactContentsResponseSchema } from "./definitions";

export const loadContents = new RouteGroup();
loadContents.get(
  null,
  {
    requestSchema: ArtifactContentsRequestSchema,
    responseSchema: ArtifactContentsResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context) => {
    if (!context.user?.organizations.has(request.orgID.toLowerCase())) {
      throw new AuthorizationError();
    }
    const orgID = request.orgID.toLowerCase();

    const artifactSnapshotsQueryResults = await withPGClient(context, async ({ pgClient }) => {
      return await pgClient.query<{
        org_id: string;
        artifact_path: [string, string][];
        event_summary_id: EventSummaryID;
        timestamp: Date;
        updated_at: Date;
        snapshot: ArtifactSnapshotStrict;
      }>({
        text: `
            SELECT *
              FROM public.artifact_snapshots
              WHERE "org_id" = $1
              LIMIT 5000;
          `,
        values: [orgID],
      });
    });

    // Group snapshots by artifact path
    const snapshotsByPath = new Map<string, ArtifactSnapshotStrict[]>();
    for (const { snapshot } of artifactSnapshotsQueryResults.rows) {
      if (!snapshot.artifactPath) continue;
      const encodedPath = encodeArtifactPath(snapshot.artifactPath);
      const existing = snapshotsByPath.get(encodedPath);
      if (existing) {
        existing.push(snapshot);
      } else {
        snapshotsByPath.set(encodedPath, [snapshot]);
      }
    }

    // Reconstruct artifacts from snapshots
    const artifacts = [];
    for (const [, snapshots] of snapshotsByPath) {
      const artifact = reconstructArtifact(snapshots[0].artifactPath, snapshots);

      // Temporarily reduce the number of snapshots to the most recent three
      if (artifact.snapshots.length > 3) {
        artifact.snapshots = artifact.snapshots.slice(-3);
      }

      artifacts.push(artifact);
    }

    return {
      artifacts,
      startCursor: "",
      endCursor: "",
    };
  },
);
