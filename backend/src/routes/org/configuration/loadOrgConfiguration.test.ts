import supertest from "supertest";
import { describe, expect, it } from "vitest";

import { fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

import { FakeAuthorizationManager, FakeAuthorizationResults } from "@/lib/authorization.internal";

import type { Managers } from "@/model/managers";
import { FakeOrganizations } from "@/model/org.internal";

import { createApp } from "@/app";
import { OrgIDs } from "@/user";

describe("Load Org Configuration Route", () => {
  it("/v0.1/org/configuration returns ok for plain user", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMigratedUserSession),
        pgPool,
        logger,
      });
      const response = await supertest(app).get(`/v0.1/org/configuration?orgID=${OrgIDs.testData}`).expect(200);

      expect(response.body.genericArtifactName).toEqual({
        one: "Artifact",
        other: "Artifacts",
      });
    });
  });

  it("/v0.1/org/configuration returns ok for medical user", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });
      const response = await supertest(app)
        .get(`/v0.1/org/configuration?orgID=${FakeOrganizations.medical.id}`)
        .expect(200);

      expect(response.body.genericArtifactName).toEqual({
        one: "Artifact",
        other: "Artifacts",
      });
    });
  });

  it("/v0.1/org/configuration returns 403 for mis-matched org", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validExistingUserSession),
        pgPool,
        logger,
      });
      const response = await supertest(app)
        .get(`/v0.1/org/configuration?orgID=${FakeOrganizations.medical.id}`)
        .expect(403);

      expect(response.body.reason).toEqual("Authorization Error");
    });
  });
});
