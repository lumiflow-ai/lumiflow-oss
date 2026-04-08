import supertest from "supertest";
import { describe, expect, it } from "vitest";

import type { ArtifactSnapshotStrict } from "@/types";

import { fakeClient, fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

import { FakeAuthorizationManager, FakeAuthorizationResults } from "@/lib/authorization.internal";

import { FakeOrganizations, FakeOrgManager } from "@/model/org.internal";
import { FakeUserManager } from "@/model/user.internal";

import { createApp } from "@/app";

const orgID = FakeOrganizations.medical.id;
const artifactPath = [{ kind: "dataset", id: "d5e6f7a8-1234-5678-9abc-def012345678" }];
const eventSummaryID = "e1f2a3b4-8901-23de-f012-456789abcdef";

function makeSnapshot(overrides: Partial<ArtifactSnapshotStrict> = {}): ArtifactSnapshotStrict {
  return {
    artifactPath,
    sourceArtifactSelectors: [],
    eventSummaryID,
    tags: {},
    metadata: {},
    timestamp: "2024-01-01T00:00:00.000Z",
    content: "test content",
    metrics: [],
    generations: [],
    annotations: {},
    reviews: {},
    dueDates: {},
    ...overrides,
  };
}

/**
 * Creates a query handler that returns the given snapshots for SELECT queries
 * and accepts any INSERT/UPDATE/other queries.
 */
function snapshotQueryHandler(existingSnapshots: ArtifactSnapshotStrict[]) {
  return ({ text }: { text: string }) => {
    // SELECT queries return the existing snapshots
    if (text.toLowerCase().includes("select")) {
      return { rows: existingSnapshots.map((snapshot) => ({ snapshot })) };
    }
    // All other queries (INSERT, UPDATE, etc.) succeed silently
    return { rows: [] };
  };
}

describe("Record Artifact Contents Route", () => {
  it("returns the reconstructed artifact after updating an existing snapshot", async () => {
    const existingSnapshot = makeSnapshot({ content: "old content" });
    const updatedSnapshot = makeSnapshot({ content: "new content" });

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .put("/v0.1/artifacts")
        .set("Content-Type", "application/json")
        .send({
          orgID,
          artifactPath,
          snapshots: [updatedSnapshot],
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.artifact).toBeDefined();
      expect(response.body.artifact.artifactPath).toEqual(artifactPath);
      expect(response.body.artifact.snapshots).toHaveLength(1);
      // The returned snapshot should have the new content (merged result)
      expect(response.body.artifact.snapshots[0].content).toBe("new content");
    }).expectClient(
      fakeClient.expectTransaction(
        // Handle all queries within the transaction
        fakeClient
          .expectQuery(snapshotQueryHandler([existingSnapshot]))
          .expectQuery(snapshotQueryHandler([existingSnapshot])),
      ),
    );
  });

  it("returns the reconstructed artifact after creating a new snapshot", async () => {
    const newSnapshot = makeSnapshot({ content: "brand new content" });

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .put("/v0.1/artifacts")
        .set("Content-Type", "application/json")
        .send({
          orgID,
          artifactPath,
          snapshots: [newSnapshot],
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.artifact).toBeDefined();
      expect(response.body.artifact.snapshots).toHaveLength(1);
      expect(response.body.artifact.snapshots[0].content).toBe("brand new content");
    }).expectClient(
      fakeClient.expectTransaction(
        // No existing snapshots, so first SELECT returns empty
        // Then INSERT, then SELECT for recipes (scheduleEvaluations)
        fakeClient
          .expectQuery(snapshotQueryHandler([]))
          .expectQuery(snapshotQueryHandler([newSnapshot]))
          .expectQuery(snapshotQueryHandler([])),
      ),
    );
  });

  it("returns forbidden when a session user attempts to record contents for a different org", async () => {
    const newSnapshot = makeSnapshot({ content: "cross-org content" });

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validExistingUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .put("/v0.1/artifacts")
        .set("Content-Type", "application/json")
        .send({
          orgID,
          artifactPath,
          snapshots: [newSnapshot],
        });

      expect(response.status).toBe(403);
      expect(response.body.reason).toBe("Authorization Error");
    });
  });
});
