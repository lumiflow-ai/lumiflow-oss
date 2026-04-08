import type { ArtifactSnapshotStrict } from "@/types";

import { withIdempotentTransaction, withPGClient } from "@/server/persistence";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { HTTPError, RouteGroup } from "@/lib/routeGroup";

import { encodeArtifactPathComponents } from "@/model/artifactPath";
import { mergeSnapshots } from "@/model/artifactSnapshot";

import { UpdateArtifactSnapshotRequestSchema, UpdateArtifactSnapshotResponseSchema } from "./definitions";

export const updateSnapshot = new RouteGroup();

updateSnapshot.put(
  "update",
  {
    requestSchema: UpdateArtifactSnapshotRequestSchema,
    responseSchema: UpdateArtifactSnapshotResponseSchema,
    auth: [AuthorizationRequirement.session, AuthorizationRequirement.apiKey],
  },
  async ({ orgID, artifactPath, eventSummaryID, snapshotDelta }, context) => {
    const normalizedOrgID = orgID.toLowerCase();
    if (context.auth === AuthorizationRequirement.session && !context.user?.organizations.has(normalizedOrgID)) {
      throw new AuthorizationError();
    }

    return await withPGClient(context, async (context) => {
      return await withIdempotentTransaction(context, async ({ pgClient }) => {
        const encodedArtifactPath = encodeArtifactPathComponents(artifactPath);

        const existingSnapshotResult = await pgClient.query<{ snapshot: ArtifactSnapshotStrict }>({
          text: `
            SELECT "snapshot"
              FROM public.artifact_snapshots
              WHERE "org_id" = $1 AND "artifact_path" = $2 AND "event_summary_id" = $3;
          `,
          values: [normalizedOrgID, encodedArtifactPath, eventSummaryID],
        });

        const existingSnapshot = existingSnapshotResult.rows[0]?.snapshot;
        if (!existingSnapshot) {
          throw new HTTPError(404, "Artifact snapshot not found");
        }

        const strictSnapshot = mergeSnapshots({
          existingSnapshot,
          updatedSnapshot: snapshotDelta,
          now: new Date(),
        });

        const updateResult = await pgClient.query({
          text: `
            UPDATE public.artifact_snapshots
              SET
                "timestamp" = $1,
                "updated_at" = $2,
                "snapshot" = $3
              WHERE
                "org_id" = $4
                AND "artifact_path" = $5
                AND "event_summary_id" = $6;
          `,
          values: [
            new Date(strictSnapshot.timestamp),
            new Date(),
            strictSnapshot,
            normalizedOrgID,
            encodedArtifactPath,
            strictSnapshot.eventSummaryID,
          ],
        });
        if (!updateResult.rowCount || updateResult.rowCount <= 0) {
          throw new HTTPError(404, "Artifact snapshot not found");
        }

        return {
          status: "success",
          message: "Artifact snapshot updated successfully",
        };
      });
    });
  },
);
