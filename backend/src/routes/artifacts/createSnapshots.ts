import type { ArtifactPath, EventSummaryID, URL } from "@/types";

import { withIdempotentTransaction, withPGClient } from "@/server/persistence";
import { CONFIG } from "@/serverInitSetup/config";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { encodeArtifactPath, encodeArtifactPathComponents } from "@/model/artifactPath";

import { CreateSnapshotsRequestSchema, CreateSnapshotsResponseSchema } from "@/routes/artifacts/definitions";
import { scheduleEvaluationsForSelectors } from "@/routes/artifacts/scheduleEvaluations";

export const createSnapshots = new RouteGroup();

createSnapshots.put(
  "create",
  {
    requestSchema: CreateSnapshotsRequestSchema,
    responseSchema: CreateSnapshotsResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context) => {
    const orgID = request.orgID.toLowerCase();
    if (!context.user?.organizations.has(orgID)) {
      throw new AuthorizationError();
    }

    return withPGClient(context, async (context) => {
      return withIdempotentTransaction(context, async ({ pgClient }) => {
        const results: {
          url: URL;
          artifactPath: ArtifactPath;
          eventSummaryID: EventSummaryID;
        }[] = [];

        const selectors: { artifactPath: ArtifactPath; eventSummaryID: EventSummaryID }[] = [];

        for (const snapshot of request.snapshots) {
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
                now(),
                $5
              );
            `,
            values: [
              orgID,
              encodeArtifactPathComponents(snapshot.artifactPath),
              snapshot.eventSummaryID,
              new Date(snapshot.timestamp),
              snapshot,
            ],
          });

          results.push({
            url: `${CONFIG.FRONTEND_PUBLIC_URL_AND_PORT.at(0)}/navigator/${orgID}/artifacts/${encodeArtifactPath(snapshot.artifactPath)}`,
            artifactPath: snapshot.artifactPath,
            eventSummaryID: snapshot.eventSummaryID,
          });
          selectors.push({ artifactPath: snapshot.artifactPath, eventSummaryID: snapshot.eventSummaryID });
        }

        if (selectors.length > 0) {
          await scheduleEvaluationsForSelectors({
            orgID,
            selectors,
            context,
          });
        }

        return results;
      });
    });
  },
);
