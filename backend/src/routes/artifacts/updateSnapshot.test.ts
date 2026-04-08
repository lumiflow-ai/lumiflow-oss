import supertest from "supertest";
import { describe, expect, it } from "vitest";

import type { ArtifactSnapshotStrict } from "@/types";

import { expectQueryText, fakeClient, fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

import { FakeAuthorizationManager, FakeAuthorizationResults } from "@/lib/authorization.internal";

import { FakeOrganizations, FakeOrgManager } from "@/model/org.internal";
import { FakeUserManager } from "@/model/user.internal";

import { createApp } from "@/app";

const orgID = FakeOrganizations.medical.id;
const artifactPath = [{ kind: "dataset", id: "d5e6f7a8-1234-5678-9abc-def012345678" }];
const eventSummaryID = "e1f2a3b4-8901-23de-f012-456789abcdef";
const existingEvaluationGroupID = "11111111-1111-1111-1111-111111111111";
const updatedEvaluationGroupID = "22222222-2222-2222-2222-222222222222";
const existingDueDate = "2024-01-01T00:00:00.000Z";
const updatedDueDate = "2024-03-01T00:00:00.000Z";

function makeSnapshot(overrides: Partial<ArtifactSnapshotStrict> = {}): ArtifactSnapshotStrict {
  return {
    artifactPath,
    sourceArtifactSelectors: [],
    eventSummaryID,
    tags: {},
    metadata: {},
    timestamp: "2024-01-01T00:00:00.000Z",
    content: "existing content",
    metrics: [],
    generations: [],
    annotations: {},
    reviews: {},
    dueDates: {},
    ...overrides,
  };
}

describe("Update Artifact Snapshot Route", () => {
  it("updates snapshot deltas without requiring full snapshot payloads", async () => {
    const existingSnapshot = makeSnapshot({
      dueDates: { [existingEvaluationGroupID]: existingDueDate },
    });

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .put("/v0.1/artifacts/snapshots/update")
        .set("Content-Type", "application/json")
        .send({
          orgID,
          artifactPath,
          eventSummaryID,
          snapshotDelta: {
            dueDates: {
              [updatedEvaluationGroupID]: updatedDueDate,
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.message).toContain("updated");
    }).expectClient(
      fakeClient.expectTransaction(
        fakeClient
          .expectQuery(({ text }) => {
            expectQueryText(text).toMatch(`
              SELECT "snapshot"
                FROM public.artifact_snapshots
                WHERE "org_id" = $1 AND "artifact_path" = $2 AND "event_summary_id" = $3;
            `);
            return { rows: [{ snapshot: existingSnapshot }] };
          })
          .expectQuery(({ text, values }) => {
            expectQueryText(text).toMatch(`
              UPDATE public.artifact_snapshots
                SET
                  "timestamp" = $1,
                  "updated_at" = $2,
                  "snapshot" = $3
                WHERE
                  "org_id" = $4
                  AND "artifact_path" = $5
                  AND "event_summary_id" = $6;
            `);

            expect(values?.[3]).toBe(orgID);
            expect(values?.[5]).toBe(eventSummaryID);

            const mergedSnapshot = values?.[2] as ArtifactSnapshotStrict;
            expect(mergedSnapshot.content).toBe("existing content");
            expect(mergedSnapshot.dueDates).toEqual({
              [existingEvaluationGroupID]: existingDueDate,
              [updatedEvaluationGroupID]: updatedDueDate,
            });

            return { rows: [], rowCount: 1 };
          }),
      ),
    );
  });

  it("returns forbidden when a session user attempts to update a different org", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validExistingUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .put("/v0.1/artifacts/snapshots/update")
        .set("Content-Type", "application/json")
        .send({
          orgID,
          artifactPath,
          eventSummaryID,
          snapshotDelta: {
            dueDates: {
              [updatedEvaluationGroupID]: updatedDueDate,
            },
          },
        });

      expect(response.status).toBe(403);
    });
  });

  it("returns not found when update affects no rows", async () => {
    const existingSnapshot = makeSnapshot();

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .put("/v0.1/artifacts/snapshots/update")
        .set("Content-Type", "application/json")
        .send({
          orgID,
          artifactPath,
          eventSummaryID,
          snapshotDelta: {
            dueDates: {
              [updatedEvaluationGroupID]: updatedDueDate,
            },
          },
        });

      expect(response.status).toBe(404);
    }).expectClient(
      fakeClient
        .expectTransactionBegin({ mode: "readWrite", isolation: "serializable" })
        .expectQuery(({ text }) => {
          expectQueryText(text).toMatch(`
            SELECT "snapshot"
              FROM public.artifact_snapshots
              WHERE "org_id" = $1 AND "artifact_path" = $2 AND "event_summary_id" = $3;
          `);
          return { rows: [{ snapshot: existingSnapshot }] };
        })
        .expectQuery(({ text }) => {
          expectQueryText(text).toMatch(`
            UPDATE public.artifact_snapshots
              SET
                "timestamp" = $1,
                "updated_at" = $2,
                "snapshot" = $3
              WHERE
                "org_id" = $4
                AND "artifact_path" = $5
                AND "event_summary_id" = $6;
          `);
          return { rows: [], rowCount: 0 };
        })
        .expectQuery(({ text }) => {
          expectQueryText(text).toMatch("ROLLBACK");
          return { rows: [] };
        }),
    );
  });
});
