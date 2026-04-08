import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { ArtifactPath, ArtifactSnapshotStrict, EventSummaryID, OrganizationID, RenderedContent } from "@/types";

import { withIdempotentTransaction, withPGClient } from "@/server/persistence";
import { CONFIG } from "@/serverInitSetup/config";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { type RequestContext, RouteGroup } from "@/lib/routeGroup";

import { encodeArtifactPath, encodeArtifactPathComponents } from "@/model/artifactPath";

import { CreateArtifactRequestSchema, CreateArtifactResponseSchema } from "@/routes/artifacts/definitions";
import { scheduleEvaluationsForSelectors } from "@/routes/artifacts/scheduleEvaluations";
import { displayNameForArtifactPath } from "@/routes/org/configuration/loadOrgConfiguration";

export const createArtifact = new RouteGroup();

createArtifact.put(
  "create",
  {
    requestSchema: CreateArtifactRequestSchema,
    responseSchema: CreateArtifactResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context) => {
    const orgID = request.orgID.toLowerCase();
    if (!context.user?.organizations.has(orgID)) throw new AuthorizationError();

    const eventSummaryID = randomUUID();
    const rootPath: ArtifactPath = (request.parentArtifactPath ?? []).concat([{ kind: "artifact", id: request.id }]);
    const name = request.metadata?.name ?? "Artifact";

    await saveSnapshot({
      orgID,
      artifactPath: rootPath,
      eventSummaryID,
      timestamp: new Date(request.timestamp),
      content: null,
      metadata: request.metadata ?? {},
      context,
    });

    const inputArtifactPath = rootPath.concat([{ id: "input" }]);
    const inputTypeName = displayNameForArtifactPath({ orgID, artifactPath: inputArtifactPath }).one;
    await saveSnapshot({
      orgID,
      artifactPath: inputArtifactPath,
      eventSummaryID,
      timestamp: new Date(request.timestamp),
      content: request.input,
      metadata: { ...request.metadata, name: `${name} ${inputTypeName}` },
      context,
    });

    const outputArtifactPath = rootPath.concat([{ id: "output" }]);
    const outputTypeName = displayNameForArtifactPath({ orgID, artifactPath: outputArtifactPath }).one;
    await saveSnapshot({
      orgID,
      artifactPath: outputArtifactPath,
      eventSummaryID,
      timestamp: new Date(new Date(request.timestamp).getTime() + 1), // Ensure output is after input
      content: request.output,
      metadata: { ...request.metadata, name: `${name} ${outputTypeName}` },
      context,
    });

    await withPGClient(context, async (context) => {
      await withIdempotentTransaction(context, async (context) => {
        await scheduleEvaluationsForSelectors({
          orgID,
          selectors: [{ artifactPath: rootPath, eventSummaryID }],
          context,
        });
      });
    });

    return {
      url: `${CONFIG.FRONTEND_PUBLIC_URL_AND_PORT.at(0)}/navigator/${orgID}/artifacts/${encodeArtifactPath(rootPath)}`,
      artifactPath: rootPath,
      eventSummaryID,
    };
  },
);

createArtifact.post(
  "evaluateArtifactCallback",
  {
    requestSchema: z.record(z.string(), z.unknown()),
    responseSchema: z.object({}),
    auth: [AuthorizationRequirement.session, AuthorizationRequirement.apiKey],
  },
  async (request, context) => {
    context.logger.info({ request }, "Received API Callback!");
    return {};
  },
);

async function saveSnapshot({
  orgID,
  artifactPath,
  eventSummaryID,
  timestamp,
  content,
  metadata,
  context,
}: {
  orgID: OrganizationID;
  artifactPath: ArtifactPath;
  eventSummaryID: EventSummaryID;
  timestamp: Date;
  content: RenderedContent;
  metadata: Record<string, string>;
  context: RequestContext;
}) {
  const snapshot: ArtifactSnapshotStrict = {
    artifactPath,
    sourceArtifactSelectors: [],
    eventSummaryID,
    tags: {},
    metadata: metadata,
    timestamp: timestamp.toISOString(),
    content: content,
    metrics: [],
    generations: [],
    annotations: {},
    reviews: {},
    dueDates: {},
  };

  await withPGClient(context, async (context) => {
    await withIdempotentTransaction(context, async ({ pgClient }) => {
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
        values: [orgID, encodeArtifactPathComponents(artifactPath), eventSummaryID, timestamp, snapshot],
      });
    });
  });
}
