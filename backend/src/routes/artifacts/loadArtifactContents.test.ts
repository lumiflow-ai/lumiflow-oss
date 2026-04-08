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

function makeSnapshot(overrides: Partial<ArtifactSnapshotStrict> = {}): ArtifactSnapshotStrict {
  return {
    artifactPath: [{ kind: "dataset", id: "d5e6f7a8-1234-5678-9abc-def012345678" }],
    sourceArtifactSelectors: [],
    eventSummaryID: "e1f2a3b4-8901-23de-f012-456789abcdef",
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

describe("Load Artifact Contents Route", () => {
  it("returns reconstructed artifacts from database snapshots", async () => {
    const snapshot1 = makeSnapshot({
      eventSummaryID: "aaaa1111-0000-0000-0000-000000000001",
      timestamp: "2024-01-01T00:00:00.000Z",
      content: "first snapshot",
    });
    const snapshot2 = makeSnapshot({
      eventSummaryID: "aaaa1111-0000-0000-0000-000000000002",
      timestamp: "2024-06-15T00:00:00.000Z",
      content: "second snapshot",
    });

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .get("/v0.1/artifacts")
        .query({ orgID })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.artifacts).toHaveLength(1);
      // Snapshots should be sorted by timestamp (ascending)
      expect(response.body.artifacts[0].snapshots).toHaveLength(2);
      expect(response.body.artifacts[0].snapshots[0].content).toBe("first snapshot");
      expect(response.body.artifacts[0].snapshots[1].content).toBe("second snapshot");
    }).expectClient(
      fakeClient.expectQuery(() => ({
        rows: [{ snapshot: snapshot1 }, { snapshot: snapshot2 }],
      })),
    );
  });

  it("merges metrics with the same ID across snapshots", async () => {
    const snapshot1 = makeSnapshot({
      eventSummaryID: "aaaa1111-0000-0000-0000-000000000001",
      timestamp: "2024-01-01T00:00:00.000Z",
      metrics: [
        {
          id: "accuracy",
          values: [
            {
              eventSummaryID: "aaaa1111-0000-0000-0000-000000000001",
              recipeRunID: "run-1",
              generationID: "gen-1",
              evaluationGroupID: "eval-group-1",
              value: 0.8,
            },
          ],
        },
      ],
    });
    const snapshot2 = makeSnapshot({
      eventSummaryID: "aaaa1111-0000-0000-0000-000000000002",
      timestamp: "2024-06-15T00:00:00.000Z",
      metrics: [
        {
          id: "accuracy",
          values: [
            {
              eventSummaryID: "aaaa1111-0000-0000-0000-000000000002",
              recipeRunID: "run-2",
              generationID: "gen-2",
              evaluationGroupID: "eval-group-2",
              value: 0.9,
            },
          ],
        },
      ],
    });

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .get("/v0.1/artifacts")
        .query({ orgID })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.artifacts).toHaveLength(1);
      // Metrics should be merged by ID
      expect(response.body.artifacts[0].metrics).toEqual([
        {
          id: "accuracy",
          values: [
            {
              eventSummaryID: "aaaa1111-0000-0000-0000-000000000001",
              recipeRunID: "run-1",
              generationID: "gen-1",
              evaluationGroupID: "eval-group-1",
              value: 0.8,
            },
            {
              eventSummaryID: "aaaa1111-0000-0000-0000-000000000002",
              recipeRunID: "run-2",
              generationID: "gen-2",
              evaluationGroupID: "eval-group-2",
              value: 0.9,
            },
          ],
        },
      ]);
    }).expectClient(
      fakeClient.expectQuery(() => ({
        rows: [{ snapshot: snapshot1 }, { snapshot: snapshot2 }],
      })),
    );
  });

  it("groups snapshots by artifact path into separate artifacts", async () => {
    const artifactPath1 = [{ kind: "dataset", id: "artifact-1111-1111-1111-111111111111" }];
    const artifactPath2 = [{ kind: "dataset", id: "artifact-2222-2222-2222-222222222222" }];

    const snapshotA = makeSnapshot({
      artifactPath: artifactPath1,
      eventSummaryID: "aaaa1111-0000-0000-0000-000000000001",
      content: "artifact 1 content",
    });
    const snapshotB = makeSnapshot({
      artifactPath: artifactPath2,
      eventSummaryID: "bbbb2222-0000-0000-0000-000000000002",
      content: "artifact 2 content",
    });

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .get("/v0.1/artifacts")
        .query({ orgID })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.artifacts).toHaveLength(2);

      // Each artifact should have its own snapshot
      const contents = response.body.artifacts.map((a: { snapshots: { content: string }[] }) => a.snapshots[0].content);
      expect(contents).toContain("artifact 1 content");
      expect(contents).toContain("artifact 2 content");
    }).expectClient(
      fakeClient.expectQuery(() => ({
        rows: [{ snapshot: snapshotA }, { snapshot: snapshotB }],
      })),
    );
  });

  it("limits artifacts to 3 most recent snapshots", async () => {
    const snapshots = [
      makeSnapshot({ eventSummaryID: "aaaa0001-0000-0000-0000-000000000001", timestamp: "2024-01-01T00:00:00.000Z" }),
      makeSnapshot({ eventSummaryID: "aaaa0002-0000-0000-0000-000000000002", timestamp: "2024-02-01T00:00:00.000Z" }),
      makeSnapshot({ eventSummaryID: "aaaa0003-0000-0000-0000-000000000003", timestamp: "2024-03-01T00:00:00.000Z" }),
      makeSnapshot({ eventSummaryID: "aaaa0004-0000-0000-0000-000000000004", timestamp: "2024-04-01T00:00:00.000Z" }),
      makeSnapshot({ eventSummaryID: "aaaa0005-0000-0000-0000-000000000005", timestamp: "2024-05-01T00:00:00.000Z" }),
    ];

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .get("/v0.1/artifacts")
        .query({ orgID })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.artifacts).toHaveLength(1);
      // Only the 3 most recent snapshots should be returned
      expect(response.body.artifacts[0].snapshots).toHaveLength(3);
      // They should be the most recent ones (March, April, May)
      expect(response.body.artifacts[0].snapshots[0].eventSummaryID).toBe("aaaa0003-0000-0000-0000-000000000003");
      expect(response.body.artifacts[0].snapshots[1].eventSummaryID).toBe("aaaa0004-0000-0000-0000-000000000004");
      expect(response.body.artifacts[0].snapshots[2].eventSummaryID).toBe("aaaa0005-0000-0000-0000-000000000005");
    }).expectClient(
      fakeClient.expectQuery(() => ({
        rows: snapshots.map((snapshot) => ({ snapshot })),
      })),
    );
  });

  it("returns empty artifacts array when no snapshots exist", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .get("/v0.1/artifacts")
        .query({ orgID })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.artifacts).toEqual([]);
    }).expectClient(
      fakeClient.expectQuery(() => ({
        rows: [],
      })),
    );
  });
});
