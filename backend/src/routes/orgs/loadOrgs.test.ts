import supertest from "supertest";
import { describe, expect, it } from "vitest";

import { fakeClient, fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

import { ProductionAuthorizationManager } from "@/lib/authorization";
import {
  deriveFakeUserSessionFromSessionCookie,
  FakeAuthorizationManager,
  FakeAuthorizationResults,
} from "@/lib/authorization.internal";

import type { Managers } from "@/model/managers";
import { FakeOrganizations, FakeOrgManager } from "@/model/org.internal";
import { FakeUserManager, FakeUsers } from "@/model/user.internal";

import { createApp } from "@/app";
import { OrgIDs } from "@/user";

describe("Load Orgs Route", () => {
  it("/v0.1/orgs returns ok for existing user", async () => {
    await fakePersistence(async (pgPool) => {
      const org = new FakeOrgManager();
      await org.createOrganization({ organization: FakeOrganizations.org1 });
      const user = new FakeUserManager();
      await user.createUser({ user: FakeUsers.existingUser });
      const app = createApp({
        managers: { user, org },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validExistingUserSession),
        pgPool,
        logger,
      });
      await supertest(app)
        .get("/v0.1/orgs")
        .expect(200)
        .expect((response) => {
          expect(response.body.orgs.length).equals(1);
          expect(response.body.orgs).toContainEqual({ id: "11111111-1111-1111-1111-111111111111", name: "Org 1" });
        });
    }).expectClient(fakeClient.expectTransaction());
  });

  it("/v0.1/orgs returns ok for in-memory user", async () => {
    await fakePersistence(async (pgPool) => {
      const org = new FakeOrgManager();
      const testDataOrg = { id: OrgIDs.testData, name: "Test Data" };
      await org.createOrganization({ organization: testDataOrg });
      const user = new FakeUserManager();
      await user.createUser({ user: FakeUsers.inMemoryUser });
      const app = createApp({
        managers: { user, org },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMigratedUserSession),
        pgPool,
        logger,
      });
      await supertest(app)
        .get("/v0.1/orgs")
        .expect(200)
        .expect((response) => {
          expect(response.body.orgs.length).equals(1);
          expect(response.body.orgs).toContainEqual({ id: OrgIDs.testData, name: "Test Data" });
        });
    }).expectClient(fakeClient.expectTransaction());
  });

  it("/v0.1/orgs returns ok for new user", async () => {
    await fakePersistence(async (pgPool) => {
      const org = new FakeOrgManager();
      await org.createOrganization({ organization: FakeOrganizations.org1 });
      const user = new FakeUserManager();
      await user.createUser({ user: FakeUsers.newUser });
      const app = createApp({
        managers: { user, org },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validNewUserSession),
        pgPool,
        logger,
      });
      await supertest(app)
        .get("/v0.1/orgs")
        .expect(200)
        .expect((response) => {
          expect(response.body.orgs.length).equals(0);
        });
    }).expectClient(fakeClient.expectTransaction());
  });

  it("/v0.1/orgs returns unauthorized when no auth is present", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie),
        pgPool,
        logger,
      });
      await supertest(app)
        .get("/v0.1/orgs")
        .expect(401)
        .expect((response) => {
          expect(response.body.type).equals("error");
          expect(response.body.reason).equals("Authentication Error");
          expect(response.body.error.message).equals("Session Not Found");
        });
    });
  });
});
