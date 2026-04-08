import supertest from "supertest";
import { describe, expect, it } from "vitest";

import { fakePersistence } from "@/server/persistence.internal";
import { CONFIG } from "@/serverInitSetup/config";
import { logger } from "@/serverInitSetup/logger";

import { ProductionAuthorizationManager } from "@/lib/authorization";
import { deriveFakeUserSessionFromSessionCookie } from "@/lib/authorization.internal";

import type { Managers } from "@/model/managers";

import { createApp } from "@/app";

describe("Authentication Routes", () => {
  describe("GET /logout", () => {
    it("redirects back to the frontend", async () => {
      await fakePersistence(async (pgPool) => {
        const app = createApp({
          authorization: new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie),
          pgPool,
          logger,
          managers: {} as Managers,
        });

        const response = await supertest(app).get("/logout").expect(302);

        expect(response.headers.location).to.equal(`${CONFIG.FRONTEND_PUBLIC_URL_AND_PORT[0]}/app`);
        const setCookieHeader = response.headers["set-cookie"];
        expect(setCookieHeader).to.exist;
        expect(Array.isArray(setCookieHeader)).to.equal(true);

        const cookies = setCookieHeader as unknown as string[];
        const sessionTokenCookie = cookies.find((cookie) => cookie.includes("better-auth.session_token="));
        expect(sessionTokenCookie).to.be.a("string");
        expect(
          sessionTokenCookie?.includes("Max-Age=0") || sessionTokenCookie?.toLowerCase().includes("expires="),
        ).to.equal(true);
      });
    });
  });

  describe("GET /login", () => {
    it("redirects to Google login", async () => {
      await fakePersistence(async (pgPool) => {
        const app = createApp({
          authorization: new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie),
          pgPool,
          logger,
          managers: {} as Managers,
        });

        const response = await supertest(app).get("/login").expect(302);

        expect(response.headers.location).to.be.a("string");
        expect(response.headers.location).to.include("accounts.google.com");
        expect(response.headers["set-cookie"]).to.exist;
      });
    });

    it("accepts a path parameter for the post-login redirect target", async () => {
      await fakePersistence(async (pgPool) => {
        const app = createApp({
          authorization: new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie),
          pgPool,
          logger,
          managers: {} as Managers,
        });

        const response = await supertest(app).get("/login?path=/app/test-org").expect(302);

        expect(response.headers.location).to.be.a("string");
        expect(response.headers.location).to.include("accounts.google.com");
        expect(response.headers["set-cookie"]).to.exist;
      });
    });
  });

  describe("POST /login", () => {
    it("is disabled when dev credentials are not configured", async () => {
      await fakePersistence(async (pgPool) => {
        const app = createApp({
          authorization: new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie),
          pgPool,
          logger,
          managers: {} as Managers,
        });

        await supertest(app).post("/login").send({ email: "dev@example.com", password: "secret" }).expect(404);
      });
    });
  });
});
