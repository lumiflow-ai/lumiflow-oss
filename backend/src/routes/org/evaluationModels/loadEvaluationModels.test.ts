import supertest from "supertest";
import { describe, expect, it } from "vitest";

import { fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

import { FakeAuthorizationManager, FakeAuthorizationResults } from "@/lib/authorization.internal";

import type { Managers } from "@/model/managers";
import { FakeOrganizations } from "@/model/org.internal";

import { createApp } from "@/app";
import { OrgIDs } from "@/user";

describe("Load Evaluation Models Route", () => {
  it("/v0.1/org/evaluation-models returns ok for plain user", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMigratedUserSession),
        pgPool,
        logger,
      });
      const response = await supertest(app).get(`/v0.1/org/evaluation-models?orgID=${OrgIDs.testData}`).expect(200);

      expect(response.body.defaultEvaluationModelID).toEqual("gpt-oss-20b");
      expect(response.body.evaluationModels).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "nova-micro",
            provider: "Amazon",
          }),
        ]),
      );
    });
  });

  it("/v0.1/org/evaluation-models returns ok for medical user", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });
      const response = await supertest(app)
        .get(`/v0.1/org/evaluation-models?orgID=${FakeOrganizations.medical.id}`)
        .expect(200);

      expect(response.body.defaultEvaluationModelID).toEqual("gpt-oss-20b");
      expect(response.body.evaluationModels).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "nova-micro",
          }),
        ]),
      );
    });
  });

  it("/v0.1/org/evaluation-models returns 403 for mis-matched org", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validExistingUserSession),
        pgPool,
        logger,
      });
      const response = await supertest(app)
        .get(`/v0.1/org/evaluation-models?orgID=${FakeOrganizations.medical.id}`)
        .expect(403);

      expect(response.body.reason).toEqual("Authorization Error");
    });
  });
});
