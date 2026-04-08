import supertest from "supertest";
import { describe, expect, it, vi } from "vitest";

import { fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

import { ProductionAuthorizationManager } from "@/lib/authorization";
import {
  deriveFakeUserSessionFromSessionCookie,
  FakeAPIKeys,
  FakeAuthorizationManager,
  FakeAuthorizationResults,
} from "@/lib/authorization.internal";

import type { Managers } from "@/model/managers";
import { FakeOrgManager } from "@/model/org.internal";
import { FakeUserManager } from "@/model/user.internal";

import { createApp } from "@/app";

describe("Create Artifact Route", () => {
  it("accepts evaluate artifact callbacks from a session user", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .post("/v0.1/artifacts/evaluateArtifactCallback")
        .send({ status: "complete" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
    });
  });

  it("accepts evaluate artifact callbacks with an API key", async () => {
    vi.stubEnv("API_KEYS", FakeAPIKeys.valid);

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .post("/v0.1/artifacts/evaluateArtifactCallback")
        .set("X-API-Key", FakeAPIKeys.valid)
        .send({ status: "complete" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
    });
  });

  it("rejects evaluate artifact callbacks without auth", async () => {
    vi.stubEnv("API_KEYS", FakeAPIKeys.valid);

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie),
        pgPool,
        logger,
      });

      const response = await supertest(app).post("/v0.1/artifacts/evaluateArtifactCallback").send({
        status: "complete",
      });

      expect(response.status).toBe(403);
      expect(response.body.type).toBe("error");
      expect(response.body.reason).toBe("Authorization Error");
    });
  });
});
