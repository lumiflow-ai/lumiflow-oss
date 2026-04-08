import supertest from "supertest";
import { describe, expect, it } from "vitest";

import { expectQueryText, fakeClient, fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

import { FakeAuthorizationManager, FakeAuthorizationResults } from "@/lib/authorization.internal";

import { FakeOrganizations, FakeOrgManager } from "@/model/org.internal";
import { FakeUserManager } from "@/model/user.internal";

import { createApp } from "@/app";

const datasetID = "d5e6f7a8-1234-5678-9abc-def012345678";
const artifact1ID = "a1b2c3d4-5678-90ab-cdef-123456789abc";
const artifact2ID = "a2b3c4d5-6789-01bc-def0-23456789abcd";
const patient1ID = "b1c2d3e4-7890-12cd-ef01-3456789abcde";
const event1ID = "e1f2a3b4-8901-23de-f012-456789abcdef";
const event2ID = "e2f3a4b5-9012-34ef-0123-56789abcdef0";

describe("Export Dataset Route", () => {
  it("should return CSV file with correct headers and data", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .get(
          `/v0.1/artifacts/export?orgID=${FakeOrganizations.medical.id}&artifactPath[0][kind]=dataset&artifactPath[0][id]=${datasetID}`,
        )
        .expect(200);

      expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");
      expect(response.headers["content-disposition"]).toMatch(/attachment; filename="Test-Dataset\.csv"/);
      expect(response.text).toBe(
        "Artifact,Input,Expected,Date\nArtifact 1,input content 1,output content 1,2024-01-15T10:30:00Z\nArtifact 2,input content 2,,2024-01-15T11:45:00Z",
      );
    })
      .expectClient(
        fakeClient.expectQuery(({ text, values }) => {
          expectQueryText(text).toMatch(`
            SELECT snapshot
            FROM public.artifact_snapshots
            WHERE "org_id" = $1
              AND "artifact_path" = $2
              AND array_length("artifact_path", 1) = $3
            LIMIT 1;
          `);
          expect(values).toEqual([FakeOrganizations.medical.id, [["dataset", datasetID]], 1]);

          return {
            rows: [
              {
                snapshot: {
                  artifactPath: [{ kind: "dataset", id: datasetID }],
                  metadata: { name: "Test Dataset" },
                },
              },
            ],
            rowCount: 1,
          };
        }),
      )
      .expectClient(
        fakeClient.expectQuery(({ text, values }) => {
          expectQueryText(text).toMatch(`
            SELECT snapshot
            FROM public.artifact_snapshots
            WHERE "org_id" = $1
              AND "artifact_path"[1:$2] = $3
              AND array_length("artifact_path", 1) > $2
            LIMIT 5000;
          `);
          expect(values).toEqual([FakeOrganizations.medical.id, 1, [["dataset", datasetID]]]);

          return {
            rows: [
              {
                snapshot: {
                  artifactPath: [
                    { kind: "dataset", id: datasetID },
                    { kind: "artifact", id: artifact1ID },
                  ],
                  metadata: { name: "Artifact 1" },
                  timestamp: "2024-01-15T10:30:00Z",
                },
              },
              {
                snapshot: {
                  artifactPath: [
                    { kind: "dataset", id: datasetID },
                    { kind: "artifact", id: artifact1ID },
                    { kind: "", id: "input" },
                  ],
                  content: "input content 1",
                },
              },
              {
                snapshot: {
                  artifactPath: [
                    { kind: "dataset", id: datasetID },
                    { kind: "artifact", id: artifact1ID },
                    { kind: "", id: "output" },
                  ],
                  content: "output content 1",
                },
              },
              {
                snapshot: {
                  artifactPath: [
                    { kind: "dataset", id: datasetID },
                    { kind: "artifact", id: artifact2ID },
                  ],
                  metadata: { name: "Artifact 2" },
                  timestamp: "2024-01-15T11:45:00Z",
                },
              },
              {
                snapshot: {
                  artifactPath: [
                    { kind: "dataset", id: datasetID },
                    { kind: "artifact", id: artifact2ID },
                    { kind: "", id: "input" },
                  ],
                  content: "input content 2",
                },
              },
            ],
            rowCount: 5,
          };
        }),
      );
  });

  it("should deduplicate artifacts with multiple snapshots from different events", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .get(
          `/v0.1/artifacts/export?orgID=${FakeOrganizations.medical.id}&artifactPath[0][kind]=dataset&artifactPath[0][id]=${datasetID}`,
        )
        .expect(200);

      const lines = response.text.split("\n");

      // Should produce only one row even though patient-1 has two parent snapshots from different events
      expect(lines.length).toBe(2);
      expect(response.text).toBe("Artifact,Input,Date\nPatient 1,input content 1,2024-01-15T10:30:00Z");
    })
      .expectClient(
        fakeClient.expectQuery(() => {
          return {
            rows: [
              {
                snapshot: {
                  artifactPath: [{ kind: "dataset", id: datasetID }],
                  metadata: { name: "Test Dataset" },
                },
              },
            ],
            rowCount: 1,
          };
        }),
      )
      .expectClient(
        fakeClient.expectQuery(() => {
          return {
            rows: [
              // Parent snapshot from event 1
              {
                snapshot: {
                  artifactPath: [
                    { kind: "dataset", id: datasetID },
                    { kind: "artifact", id: patient1ID },
                  ],
                  metadata: { name: "Patient 1" },
                  timestamp: "2024-01-15T10:30:00Z",
                  eventSummaryID: event1ID,
                },
              },
              // Leaf snapshot from event 1
              {
                snapshot: {
                  artifactPath: [
                    { kind: "dataset", id: datasetID },
                    { kind: "artifact", id: patient1ID },
                    { kind: "", id: "input" },
                  ],
                  content: "input content 1",
                  eventSummaryID: event1ID,
                },
              },
              // Duplicate parent snapshot from event 2 (same artifact, different event)
              {
                snapshot: {
                  artifactPath: [
                    { kind: "dataset", id: datasetID },
                    { kind: "artifact", id: patient1ID },
                  ],
                  metadata: { name: "Patient 1" },
                  timestamp: "2024-01-15T10:30:00Z",
                  eventSummaryID: event2ID,
                },
              },
            ],
            rowCount: 3,
          };
        }),
      );
  });

  it("should require authorization", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.invalidUnverifiedUserSession),
        pgPool,
        logger,
      });

      await supertest(app)
        .get(
          `/v0.1/artifacts/export?orgID=${FakeOrganizations.medical.id}&artifactPath[0][kind]=dataset&artifactPath[0][id]=${datasetID}`,
        )
        .expect(403);
    });
  });
});
