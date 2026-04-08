import supertest from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

import { ProductionAuthorizationManager } from "@/lib/authorization";
import {
  deriveFakeUserSessionFromSessionCookie,
  FakeAuthorizationManager,
  FakeAuthorizationResults,
} from "@/lib/authorization.internal";

import type { Managers } from "@/model/managers";

import { createApp } from "@/app";

describe("Load Account Route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("/v0.1/account returns ok for existing user", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validExistingUserSession),
        pgPool,
        logger,
      });
      const response = await supertest(app).get("/v0.1/account").expect(200);

      expect(response.body.user.id).equals("existingUser");
      expect(response.body.user.email).equals("existingUser@example.com");
      expect(response.body.user.fullName).equals("Existing User");
      expect(response.body.isEmailVerified).equals(true);
    });
  });

  it("/v0.1/account returns ok for unverified user", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new FakeAuthorizationManager({
          user: {
            id: "migratedUser",
            email: "unit-test@testing.example.com",
            fullName: "Testing User",
            organizations: new Map(),
            isAuthenticated: true,
            isEmailVerified: false,
          },
          auth: undefined,
        }),
        pgPool,
        logger,
      });
      const response = await supertest(app).get("/v0.1/account").expect(200);

      expect(response.body.user.id).equals("migratedUser");
      expect(response.body.user.email).equals("unit-test@testing.example.com");
      expect(response.body.user.fullName).equals("Testing User");
      expect(response.body.isEmailVerified).equals(false);
    });
  });

  it("/v0.1/account returns forbidden for unauthenticated user", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new FakeAuthorizationManager({
          user: {
            id: "migratedUser",
            email: "unit-test@testing.example.com",
            fullName: "Testing User",
            organizations: new Map(),
            isAuthenticated: false,
            isEmailVerified: true,
          },
          auth: undefined,
        }),
        pgPool,
        logger,
      });
      const response = await supertest(app).get("/v0.1/account").expect(403);

      expect(response.body.type).equals("error");
      expect(response.body.reason).equals("Authorization Error");
    });
  });

  it("/v0.1/account returns forbidden for user outside configured app access allow-list", async () => {
    vi.stubEnv("APP_ACCESS_ALLOW_LIST", "@restricted-company.com");

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validExistingUserSession),
        pgPool,
        logger,
      });
      const response = await supertest(app).get("/v0.1/account").expect(403);

      expect(response.body.type).equals("error");
      expect(response.body.reason).equals("Authorization Error");
    });
  });

  it("/v0.1/account returns unauthorized when no auth is present", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie),
        pgPool,
        logger,
      });
      const response = await supertest(app).get("/v0.1/account").expect(401);

      expect(response.body.type).equals("error");
      expect(response.body.reason).equals("Authentication Error");
      expect(response.body.error.message).equals("Session Not Found");
    });
  });
});
