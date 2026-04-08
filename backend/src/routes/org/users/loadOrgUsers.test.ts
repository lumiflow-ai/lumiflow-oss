import supertest from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import type { PersistedUser } from "@/model/user";
import { FakeUserManager, FakeUsers } from "@/model/user.internal";

import { createApp } from "@/app";
import { OrgIDs } from "@/user";

describe("Load Org Users Route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("/v0.1/org/users returns users for the requested org", async () => {
    await fakePersistence(async (pgPool) => {
      const orgManager = new FakeOrgManager();
      const userManager = new FakeUserManager();
      await userManager.createUser({ user: FakeUsers.existingUser });
      const otherUser: PersistedUser = {
        id: "otherUser",
        email: "otherUser@example.com",
        fullName: "Other User",
        organizationIDs: [FakeOrganizations.org2.id],
        auth: {},
      };
      await userManager.createUser({ user: otherUser });

      const app = createApp({
        managers: { user: userManager, org: orgManager },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validExistingUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .get("/v0.1/org/users")
        .query({ orgID: FakeOrganizations.org1.id })
        .expect(200);

      expect(response.body.users).toEqual([
        {
          id: FakeUsers.existingUser.id,
          email: FakeUsers.existingUser.email,
          fullName: FakeUsers.existingUser.fullName,
        },
      ]);
    }).expectClient(fakeClient);
  });

  it("/v0.1/org/users returns users for allowed orgs on example.com sessions", async () => {
    vi.stubEnv("ADDITIONAL_ORG_ACCESS_DOMAINS", "example.com");

    await fakePersistence(async (pgPool) => {
      const org = new FakeOrgManager();
      const user = new FakeUserManager();
      const internalUser: PersistedUser = {
        id: "internalUser",
        email: "reviewer@example.com",
        fullName: "Internal User",
        organizationIDs: [OrgIDs.testData],
        auth: {},
      };
      await user.createUser({ user: internalUser });
      const otherUserAllowed: PersistedUser = {
        id: "otherUserAllowed",
        email: "allowed@example.com",
        fullName: "Allowed User",
        organizationIDs: [OrgIDs.demo.medical],
        auth: {},
      };
      await user.createUser({ user: otherUserAllowed });
      const otherUserDisallowed: PersistedUser = {
        id: "otherUserDisallowed",
        email: "disallowed@other-company.com",
        fullName: "Disallowed User",
        organizationIDs: [FakeOrganizations.org2.id],
        auth: {},
      };
      await user.createUser({ user: otherUserDisallowed });

      const app = createApp({
        managers: { user, org },
        authorization: new FakeAuthorizationManager({
          user: {
            id: internalUser.id,
            email: internalUser.email,
            fullName: internalUser.fullName,
            organizations: new Map([[OrgIDs.testData, { id: OrgIDs.testData, name: "Test Data" }]]),
            isAuthenticated: true,
            isEmailVerified: true,
          },
          auth: undefined,
        }),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .get("/v0.1/org/users")
        .query({ orgID: FakeOrganizations.org2.id })
        .expect(200);

      expect(response.body.users).toHaveLength(2);
      expect(response.body.users).toEqual(
        expect.arrayContaining([
          {
            id: internalUser.id,
            email: internalUser.email,
            fullName: internalUser.fullName,
          },
          {
            id: otherUserAllowed.id,
            email: otherUserAllowed.email,
            fullName: otherUserAllowed.fullName,
          },
        ]),
      );
    }).expectClient(fakeClient);
  });

  it("/v0.1/org/users returns forbidden for orgs outside the session", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { user: new FakeUserManager(), org: new FakeOrgManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validExistingUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .get("/v0.1/org/users")
        .query({ orgID: FakeOrganizations.org2.id })
        .expect(403);

      expect(response.body.type).equals("error");
      expect(response.body.reason).equals("Authorization Error");
    }).expectClient(fakeClient);
  });

  it("/v0.1/org/users returns unauthorized when no auth is present", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: {} as Managers,
        authorization: new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .get("/v0.1/org/users")
        .query({ orgID: FakeOrganizations.org1.id })
        .expect(401);

      expect(response.body.type).equals("error");
      expect(response.body.reason).equals("Authentication Error");
      expect(response.body.error.message).equals("Session Not Found");
    });
  });
});
