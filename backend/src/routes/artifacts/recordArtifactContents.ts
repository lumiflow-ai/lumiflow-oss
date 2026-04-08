import type { ArtifactPath, ArtifactSnapshotStrict, EventSummaryID } from "@/types";

import { withIdempotentTransaction, withPGClient } from "@/server/persistence";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { reconstructArtifact } from "@/model/artifact";
import { encodeArtifactPathComponents } from "@/model/artifactPath";
import { mergeSnapshots, mergeTimestampedRecords } from "@/model/artifactSnapshot";

import { RecordArtifactContentsRequestSchema, RecordArtifactContentsResponseSchema } from "./definitions";
import { scheduleEvaluationsForSelectors } from "./scheduleEvaluations";

export const recordContents = new RouteGroup();

recordContents.put(
  null,
  {
    requestSchema: RecordArtifactContentsRequestSchema,
    responseSchema: RecordArtifactContentsResponseSchema,
    auth: [AuthorizationRequirement.session, AuthorizationRequirement.apiKey],
  },
  async ({ orgID, artifactPath, snapshots }, context) => {
    const normalizedOrgID = orgID.toLowerCase();
    if (context.auth === AuthorizationRequirement.session && !context.user?.organizations.has(normalizedOrgID)) {
      throw new AuthorizationError();
    }

    return await withPGClient(context, async (context) => {
      return await withIdempotentTransaction(context, async ({ pgClient, logger }) => {
        const encodedArtifactPath = encodeArtifactPathComponents(artifactPath);
        const selectors: { artifactPath: ArtifactPath; eventSummaryID: EventSummaryID }[] = [];

        // Fetch all existing snapshots for this artifact upfront
        const existingSnapshotsResult = await pgClient.query<{ snapshot: ArtifactSnapshotStrict }>({
          text: `
            SELECT "snapshot"
              FROM public.artifact_snapshots
              WHERE "org_id" = $1 AND "artifact_path" = $2;
          `,
          values: [normalizedOrgID, encodedArtifactPath],
        });
        const snapshotsByEventID = new Map<EventSummaryID, ArtifactSnapshotStrict>(
          existingSnapshotsResult.rows.map((row) => [row.snapshot.eventSummaryID, row.snapshot]),
        );

        /// Migrate each snapshot and merge with what's there.
        for (const snapshot of snapshots ?? []) {
          const existingArtifactSnapshot = snapshotsByEventID.get(snapshot.eventSummaryID);
          const now = new Date();

          if (!existingArtifactSnapshot) {
            logger.info("Creating artifact snapshot.");

            const newSnapshot: ArtifactSnapshotStrict = {
              ...snapshot,
              annotations: mergeTimestampedRecords({}, snapshot.annotations, now, "content"),
            };
            await pgClient.query({
              text: `
                INSERT INTO public.artifact_snapshots (
                  "org_id",
                  "artifact_path",
                  "event_summary_id",
                  "timestamp",
                  "updated_at",
                  "snapshot"
                ) VALUES (
                  $1,
                  $2,
                  $3,
                  $4,
                  $5,
                  $6
                );
              `,
              values: [
                normalizedOrgID,
                encodedArtifactPath,
                snapshot.eventSummaryID,
                new Date(snapshot.timestamp),
                now,
                newSnapshot,
              ],
            });
            snapshotsByEventID.set(snapshot.eventSummaryID, newSnapshot);
            selectors.push({ artifactPath, eventSummaryID: snapshot.eventSummaryID });
            continue;
          }

          /// Otherwise, update it and add a snapshot, the generation, and merge the metrics.
          logger.info("Updating artifact snapshot.");

          const strictSnapshot = mergeSnapshots({
            existingSnapshot: existingArtifactSnapshot,
            updatedSnapshot: snapshot,
            now,
          });

          await pgClient.query({
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
              now,
              strictSnapshot,
              normalizedOrgID,
              encodedArtifactPath,
              strictSnapshot.eventSummaryID,
            ],
          });
          snapshotsByEventID.set(strictSnapshot.eventSummaryID, strictSnapshot);
        }

        if (selectors.length > 0) {
          await scheduleEvaluationsForSelectors({
            orgID: normalizedOrgID,
            selectors,
            context: { pgClient, logger },
          });
        }

        const artifact = reconstructArtifact(artifactPath, Array.from(snapshotsByEventID.values()));

        return {
          status: "success",
          message: "Artifact saved successfully",
          artifact,
        };
      });
    });
  },
);
