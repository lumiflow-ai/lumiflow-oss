import type { Request } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeClient, fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

import {
  AuthenticationError,
  AuthorizationError,
  AuthorizationRequirement,
  ProductionAuthorizationManager,
} from "@/lib/authorization";
import { deriveFakeUserSessionFromSessionCookie, FakeAPIKeys, FakeHTTPRequests } from "@/lib/authorization.internal";

import type { Managers } from "@/model/managers";
import { FakeOrganizations, FakeOrgManager } from "@/model/org.internal";
import { FakeUserManager, FakeUsers } from "@/model/user.internal";

import { OrgIDs } from "@/user";

describe("ProductionAuthorizationManager", () => {
  beforeEach(() => {
    vi.stubEnv("API_KEYS", FakeAPIKeys.valid);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("userSessionFromInfo() no user", () => {
    it("loads same user from persistence once", async () => {
      await fakePersistence(async (pgPool) => {
        const now = new Date();
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await org.createOrganization({ organization: FakeOrganizations.org1 });
        await user.createUser({
          user: FakeUsers.existingUser,
        });
        const result1 = await auth.validateAuthorization({
          auth: undefined,
          httpRequest: FakeHTTPRequests.validExistingUserSession,
          managers: { user, org },
          now,
          pgPool,
          logger,
        });
        expect(result1.user?.id).toEqual("existingUser");
        expect(auth.userSessionCache.entries.size).toEqual(1);
        const result2 = await auth.validateAuthorization({
          auth: undefined,
          httpRequest: FakeHTTPRequests.validExistingUserSession,
          managers: { user, org },
          now,
          pgPool,
          logger,
        });
        expect(result2.user?.id).toEqual("existingUser");
        expect(auth.userSessionCache.entries.size).toEqual(1);
      }).expectClient(fakeClient.expectTransaction());
    });

    it("loads different users from persistence twice", async () => {
      await fakePersistence(async (pgPool) => {
        const now = new Date();
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await org.createOrganization({ organization: FakeOrganizations.org1 });
        await user.createUser({
          user: FakeUsers.existingUser,
        });
        await user.createUser({
          user: FakeUsers.newUser,
        });
        const result1 = await auth.validateAuthorization({
          auth: undefined,
          httpRequest: FakeHTTPRequests.validExistingUserSession,
          managers: { user, org },
          now,
          pgPool,
          logger,
        });
        expect(result1.user?.id).toEqual("existingUser");
        expect(auth.userSessionCache.entries.size).toEqual(1);
        const result2 = await auth.validateAuthorization({
          auth: undefined,
          httpRequest: FakeHTTPRequests.validNewUserSession,
          managers: { user, org },
          now,
          pgPool,
          logger,
        });
        expect(result2.user?.id).toEqual("newUser");
        expect(auth.userSessionCache.entries.size).toEqual(2);
      })
        .expectClient(fakeClient.expectTransaction())
        .expectClient(fakeClient.expectTransaction());
    });

    /// This represents two different sessions that happen to point to the same user, but should likely still be cached separately.
    it("loads same user with different IDs from persistence twice", async () => {
      await fakePersistence(async (pgPool) => {
        const now = new Date();
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await org.createOrganization({ organization: FakeOrganizations.org1 });
        await user.createUser({
          user: FakeUsers.existingUser,
        });
        const result1 = await auth.validateAuthorization({
          auth: undefined,
          httpRequest: FakeHTTPRequests.validExistingUserSession,
          managers: { user, org },
          now,
          pgPool,
          logger,
        });
        expect(result1.user?.id).toEqual("existingUser");
        expect(auth.userSessionCache.entries.size).toEqual(1);
        const result2 = await auth.validateAuthorization({
          auth: undefined,
          httpRequest: FakeHTTPRequests.validExistingUserSessionAlternateID,
          managers: { user, org },
          now,
          pgPool,
          logger,
        });
        expect(result2.user?.id).toEqual("existingUser");
        expect(auth.userSessionCache.entries.size).toEqual(2);
      })
        .expectClient(fakeClient.expectTransaction())
        .expectClient(fakeClient.expectTransaction());
    });
  });

  describe("validateAuthorization() no user", () => {
    it("with no auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const result = await auth.validateAuthorization({
          auth: undefined,
          httpRequest: FakeHTTPRequests.empty,
          managers: {} as Managers,
          pgPool,
          logger,
        });
        expect(result.user).toBeUndefined();
        expect(result.auth).toBeUndefined();
      });
    });

    it("with session auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        await expect(async () => {
          await auth.validateAuthorization({
            auth: AuthorizationRequirement.session,
            httpRequest: FakeHTTPRequests.empty,
            managers: {} as Managers,
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthenticationError("Session Not Found"));
      });
    });

    it("with [session] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        await expect(async () => {
          await auth.validateAuthorization({
            auth: [AuthorizationRequirement.session],
            httpRequest: FakeHTTPRequests.empty,
            managers: {} as Managers,
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthenticationError("Session Not Found"));
      });
    });

    it("with api-key auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        await expect(async () => {
          await auth.validateAuthorization({
            auth: AuthorizationRequirement.apiKey,
            httpRequest: FakeHTTPRequests.empty,
            managers: {} as Managers,
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthorizationError("Missing X-API-Key header."));
      });
    });

    it("with [api-key] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        await expect(async () => {
          await auth.validateAuthorization({
            auth: [AuthorizationRequirement.apiKey],
            httpRequest: FakeHTTPRequests.empty,
            managers: {} as Managers,
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthorizationError("Missing X-API-Key header."));
      });
    });

    it("with [session, api-key] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        await expect(async () => {
          await auth.validateAuthorization({
            auth: [AuthorizationRequirement.session, AuthorizationRequirement.apiKey],
            httpRequest: FakeHTTPRequests.empty,
            managers: {} as Managers,
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthorizationError("Missing X-API-Key header."));
      });
    });
  });

  describe("validateAuthorization() in-memory-to-db migrated user", () => {
    it("with no auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        // Pre-seed the organization and user to simulate migrated state
        await org.createOrganization({ organization: { id: OrgIDs.testData, name: "Test Data" } });
        await user.createUser({ user: FakeUsers.inMemoryUser });
        const result = await auth.validateAuthorization({
          auth: undefined,
          httpRequest: FakeHTTPRequests.validMigratedUserSession,
          managers: { user, org },
          pgPool,
          logger,
        });
        expect(result.user?.email).toEqual("unit-test@testing.example.com");
        expect(result.user?.organizations.size).toEqual(1);
        expect(result.user?.organizations.get(OrgIDs.testData)).toEqual({
          id: "4748b6c8-c161-466b-a516-897d67c19c0e",
          name: "Test Data",
        });
        expect(result.auth).toBeUndefined();

        /// Check user was updated:
        expect(user.users.size).toEqual(1);
        expect(user.usersByEmail.get("unit-test@testing.example.com")?.auth?.isFake).toEqual(true);
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with session auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        // Pre-seed the organization and user to simulate migrated state
        await org.createOrganization({ organization: { id: OrgIDs.testData, name: "Test Data" } });
        await user.createUser({ user: FakeUsers.inMemoryUser });
        const result = await auth.validateAuthorization({
          auth: AuthorizationRequirement.session,
          httpRequest: FakeHTTPRequests.validMigratedUserSession,
          managers: { user, org },
          pgPool,
          logger,
        });
        expect(result.user?.email).toEqual("unit-test@testing.example.com");
        expect(result.user?.organizations.size).toEqual(1);
        expect(result.user?.organizations.get(OrgIDs.testData)).toEqual({
          id: "4748b6c8-c161-466b-a516-897d67c19c0e",
          name: "Test Data",
        });
        expect(result.auth).toEqual("session");

        /// Check user was created:
        expect(user.users.size).toEqual(1);
        expect(user.usersByEmail.get("unit-test@testing.example.com")?.auth?.isFake).toEqual(true);
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with [session] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        // Pre-seed the organization and user to simulate migrated state
        await org.createOrganization({ organization: { id: OrgIDs.testData, name: "Test Data" } });
        await user.createUser({ user: FakeUsers.inMemoryUser });
        const result = await auth.validateAuthorization({
          auth: [AuthorizationRequirement.session],
          httpRequest: FakeHTTPRequests.validMigratedUserSession,
          managers: { user, org },
          pgPool,
          logger,
        });
        expect(result.user?.email).toEqual("unit-test@testing.example.com");
        expect(result.user?.organizations.size).toEqual(1);
        expect(result.user?.organizations.get(OrgIDs.testData)).toEqual({
          id: "4748b6c8-c161-466b-a516-897d67c19c0e",
          name: "Test Data",
        });
        expect(result.auth).toEqual("session");

        /// Check user was created:
        expect(user.users.size).toEqual(1);
        expect(user.usersByEmail.get("unit-test@testing.example.com")?.auth?.isFake).toEqual(true);
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with api-key auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await expect(async () => {
          await auth.validateAuthorization({
            auth: AuthorizationRequirement.apiKey,
            httpRequest: FakeHTTPRequests.validMigratedUserSession,
            managers: { user, org },
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthorizationError("Missing X-API-Key header."));
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with [api-key] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await expect(async () => {
          await auth.validateAuthorization({
            auth: [AuthorizationRequirement.apiKey],
            httpRequest: FakeHTTPRequests.validMigratedUserSession,
            managers: { user, org },
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthorizationError("Missing X-API-Key header."));
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with [session, api-key] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        // Pre-seed the organization and user to simulate migrated state
        await org.createOrganization({ organization: { id: OrgIDs.testData, name: "Test Data" } });
        await user.createUser({ user: FakeUsers.inMemoryUser });
        const result = await auth.validateAuthorization({
          auth: [AuthorizationRequirement.session, AuthorizationRequirement.apiKey],
          httpRequest: FakeHTTPRequests.validMigratedUserSession,
          managers: { user, org },
          pgPool,
          logger,
        });
        expect(result.user?.email).toEqual("unit-test@testing.example.com");
        expect(result.user?.organizations.size).toEqual(1);
        expect(result.user?.organizations.get(OrgIDs.testData)).toEqual({
          id: "4748b6c8-c161-466b-a516-897d67c19c0e",
          name: "Test Data",
        });
        expect(result.auth).toEqual("session");

        /// Check user was created:
        expect(user.users.size).toEqual(1);
        expect(user.usersByEmail.get("unit-test@testing.example.com")?.auth?.isFake).toEqual(true);
      }).expectClient(fakeClient.expectTransaction());
    });
  });

  describe("validateAuthorization() new user", () => {
    it("with no auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        const result = await auth.validateAuthorization({
          auth: undefined,
          httpRequest: FakeHTTPRequests.validNewUserSession,
          managers: { user, org },
          pgPool,
          logger,
        });
        expect(result.user?.email).toEqual("newUser@example.com");
        expect(result.user?.organizations.size).toEqual(0);
        expect(result.auth).toBeUndefined();

        /// Check user was updated:
        expect(user.users.size).toEqual(1);
        expect(user.usersByEmail.get("newuser@example.com")?.auth?.isFake).toEqual(true);
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with session auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        const result = await auth.validateAuthorization({
          auth: AuthorizationRequirement.session,
          httpRequest: FakeHTTPRequests.validNewUserSession,
          managers: { user, org },
          pgPool,
          logger,
        });
        expect(result.user?.email).toEqual("newUser@example.com");
        expect(result.user?.organizations.size).toEqual(0);
        expect(result.auth).toEqual("session");

        /// Check user was created:
        expect(user.users.size).toEqual(1);
        expect(user.usersByEmail.get("newuser@example.com")?.auth?.isFake).toEqual(true);
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with [session] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        const result = await auth.validateAuthorization({
          auth: [AuthorizationRequirement.session],
          httpRequest: FakeHTTPRequests.validNewUserSession,
          managers: { user, org },
          pgPool,
          logger,
        });
        expect(result.user?.email).toEqual("newUser@example.com");
        expect(result.user?.organizations.size).toEqual(0);
        expect(result.auth).toEqual("session");

        /// Check user was created:
        expect(user.users.size).toEqual(1);
        expect(user.usersByEmail.get("newuser@example.com")?.auth?.isFake).toEqual(true);
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with api-key auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await expect(async () => {
          await auth.validateAuthorization({
            auth: AuthorizationRequirement.apiKey,
            httpRequest: FakeHTTPRequests.validNewUserSession,
            managers: { user, org },
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthorizationError("Missing X-API-Key header."));
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with [api-key] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await expect(async () => {
          await auth.validateAuthorization({
            auth: [AuthorizationRequirement.apiKey],
            httpRequest: FakeHTTPRequests.validNewUserSession,
            managers: { user, org },
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthorizationError("Missing X-API-Key header."));
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with [session, api-key] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        const result = await auth.validateAuthorization({
          auth: [AuthorizationRequirement.session, AuthorizationRequirement.apiKey],
          httpRequest: FakeHTTPRequests.validNewUserSession,
          managers: { user, org },
          pgPool,
          logger,
        });
        expect(result.user?.email).toEqual("newUser@example.com");
        expect(result.user?.organizations.size).toEqual(0);
        expect(result.auth).toEqual("session");

        /// Check user was created:
        expect(user.users.size).toEqual(1);
        expect(user.usersByEmail.get("newuser@example.com")?.auth?.isFake).toEqual(true);
      }).expectClient(fakeClient.expectTransaction());
    });
  });

  describe("validateAuthorization() existing user", () => {
    it("with no auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await org.createOrganization({ organization: FakeOrganizations.org1 });
        await user.createUser({ user: FakeUsers.existingUser });
        const result = await auth.validateAuthorization({
          auth: undefined,
          httpRequest: FakeHTTPRequests.validExistingUserSession,
          managers: { user, org },
          pgPool,
          logger,
        });
        expect(result.user?.id).toEqual("existingUser");
        expect(result.user?.email).toEqual("existingUser@example.com");
        expect(result.user?.fullName).toEqual("Existing User");
        expect(result.user?.organizations.size).toEqual(1);
        expect(result.user?.organizations.get(FakeOrganizations.org1.id)).toEqual({
          id: "11111111-1111-1111-1111-111111111111",
          name: "Org 1",
        });
        expect(result.auth).toBeUndefined();

        /// Check user was updated:
        expect(user.users.size).toEqual(1);
        expect(user.usersByEmail.get("existinguser@example.com")?.id).toEqual("existingUser");
        expect(user.usersByEmail.get("existinguser@example.com")?.auth?.isFake).toEqual(true);
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with session auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await org.createOrganization({ organization: FakeOrganizations.org1 });
        await user.createUser({ user: FakeUsers.existingUser });
        const result = await auth.validateAuthorization({
          auth: AuthorizationRequirement.session,
          httpRequest: FakeHTTPRequests.validExistingUserSession,
          managers: { user, org },
          pgPool,
          logger,
        });
        expect(result.user?.id).toEqual("existingUser");
        expect(result.user?.email).toEqual("existingUser@example.com");
        expect(result.user?.fullName).toEqual("Existing User");
        expect(result.user?.organizations.size).toEqual(1);
        expect(result.user?.organizations.get(FakeOrganizations.org1.id)).toEqual({
          id: "11111111-1111-1111-1111-111111111111",
          name: "Org 1",
        });
        expect(result.auth).toEqual("session");

        /// Check user was updated:
        expect(user.users.size).toEqual(1);
        expect(user.usersByEmail.get("existinguser@example.com")?.id).toEqual("existingUser");
        expect(user.usersByEmail.get("existinguser@example.com")?.auth?.isFake).toEqual(true);
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with [session] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await org.createOrganization({ organization: FakeOrganizations.org1 });
        await user.createUser({ user: FakeUsers.existingUser });
        const result = await auth.validateAuthorization({
          auth: [AuthorizationRequirement.session],
          httpRequest: FakeHTTPRequests.validExistingUserSession,
          managers: { user, org },
          pgPool,
          logger,
        });
        expect(result.user?.id).toEqual("existingUser");
        expect(result.user?.email).toEqual("existingUser@example.com");
        expect(result.user?.fullName).toEqual("Existing User");
        expect(result.user?.organizations.size).toEqual(1);
        expect(result.user?.organizations.get(FakeOrganizations.org1.id)).toEqual({
          id: "11111111-1111-1111-1111-111111111111",
          name: "Org 1",
        });
        expect(result.auth).toEqual("session");

        /// Check user was updated:
        expect(user.users.size).toEqual(1);
        expect(user.usersByEmail.get("existinguser@example.com")?.id).toEqual("existingUser");
        expect(user.usersByEmail.get("existinguser@example.com")?.auth?.isFake).toEqual(true);
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with api-key auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await expect(async () => {
          await auth.validateAuthorization({
            auth: AuthorizationRequirement.apiKey,
            httpRequest: FakeHTTPRequests.validExistingUserSession,
            managers: { user, org },
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthorizationError("Missing X-API-Key header."));
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with [api-key] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await expect(async () => {
          await auth.validateAuthorization({
            auth: [AuthorizationRequirement.apiKey],
            httpRequest: FakeHTTPRequests.validExistingUserSession,
            managers: { user, org },
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthorizationError("Missing X-API-Key header."));
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with [session, api-key] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await org.createOrganization({ organization: FakeOrganizations.org1 });
        await user.createUser({ user: FakeUsers.existingUser });
        const result = await auth.validateAuthorization({
          auth: [AuthorizationRequirement.session, AuthorizationRequirement.apiKey],
          httpRequest: FakeHTTPRequests.validExistingUserSession,
          managers: { user, org },
          pgPool,
          logger,
        });
        expect(result.user?.id).toEqual("existingUser");
        expect(result.user?.email).toEqual("existingUser@example.com");
        expect(result.user?.fullName).toEqual("Existing User");
        expect(result.user?.organizations.size).toEqual(1);
        expect(result.user?.organizations.get(FakeOrganizations.org1.id)).toEqual({
          id: "11111111-1111-1111-1111-111111111111",
          name: "Org 1",
        });
        expect(result.auth).toEqual("session");

        /// Check user was updated:
        expect(user.users.size).toEqual(1);
        expect(user.usersByEmail.get("existinguser@example.com")?.id).toEqual("existingUser");
        expect(user.usersByEmail.get("existinguser@example.com")?.auth?.isFake).toEqual(true);
      }).expectClient(fakeClient.expectTransaction());
    });
  });

  describe("validateAuthorization() API Key", () => {
    it("with no auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const result = await auth.validateAuthorization({
          auth: undefined,
          httpRequest: FakeHTTPRequests.validAPIKey,
          managers: {} as Managers,
          pgPool,
          logger,
        });
        expect(result.user).toBeUndefined();
        expect(result.auth).toBeUndefined();
      });
    });

    it("with session auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        await expect(async () => {
          await auth.validateAuthorization({
            auth: AuthorizationRequirement.session,
            httpRequest: FakeHTTPRequests.validAPIKey,
            managers: {} as Managers,
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthenticationError("Session Not Found"));
      });
    });

    it("with [session] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        await expect(async () => {
          await auth.validateAuthorization({
            auth: [AuthorizationRequirement.session],
            httpRequest: FakeHTTPRequests.validAPIKey,
            managers: {} as Managers,
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthenticationError("Session Not Found"));
      });
    });

    it("with api-key auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const result = await auth.validateAuthorization({
          auth: AuthorizationRequirement.apiKey,
          httpRequest: FakeHTTPRequests.validAPIKey,
          managers: {} as Managers,
          pgPool,
          logger,
        });
        expect(result.user).toBeUndefined();
        expect(result.auth).toEqual("api-key");
      });
    });

    it("with [api-key] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const result = await auth.validateAuthorization({
          auth: [AuthorizationRequirement.apiKey],
          httpRequest: FakeHTTPRequests.validAPIKey,
          managers: {} as Managers,
          pgPool,
          logger,
        });
        expect(result.user).toBeUndefined();
        expect(result.auth).toEqual("api-key");
      });
    });

    it("with [session, api-key] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const result = await auth.validateAuthorization({
          auth: [AuthorizationRequirement.session, AuthorizationRequirement.apiKey],
          httpRequest: FakeHTTPRequests.validAPIKey,
          managers: {} as Managers,
          pgPool,
          logger,
        });
        expect(result.user).toBeUndefined();
        expect(result.auth).toEqual("api-key");
      });
    });
  });

  describe("validateAuthorization() Invalid API Key", () => {
    it("with no auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const result = await auth.validateAuthorization({
          auth: undefined,
          httpRequest: FakeHTTPRequests.invalidAPIKey,
          managers: {} as Managers,
          pgPool,
          logger,
        });
        expect(result.user).toBeUndefined();
        expect(result.auth).toBeUndefined();
      });
    });

    it("with session auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        await expect(async () => {
          await auth.validateAuthorization({
            auth: AuthorizationRequirement.session,
            httpRequest: FakeHTTPRequests.invalidAPIKey,
            managers: {} as Managers,
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthenticationError("Session Not Found"));
      });
    });

    it("with [session] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        await expect(async () => {
          await auth.validateAuthorization({
            auth: [AuthorizationRequirement.session],
            httpRequest: FakeHTTPRequests.invalidAPIKey,
            managers: {} as Managers,
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthenticationError("Session Not Found"));
      });
    });

    it("with api-key auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        await expect(async () => {
          await auth.validateAuthorization({
            auth: AuthorizationRequirement.apiKey,
            httpRequest: FakeHTTPRequests.invalidAPIKey,
            managers: {} as Managers,
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthorizationError("Invalid API-Key."));
      });
    });

    it("with [api-key] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        await expect(async () => {
          await auth.validateAuthorization({
            auth: [AuthorizationRequirement.apiKey],
            httpRequest: FakeHTTPRequests.invalidAPIKey,
            managers: {} as Managers,
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthorizationError("Invalid API-Key."));
      });
    });

    it("with [session, api-key] auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        await expect(async () => {
          await auth.validateAuthorization({
            auth: [AuthorizationRequirement.session, AuthorizationRequirement.apiKey],
            httpRequest: FakeHTTPRequests.invalidAPIKey,
            managers: {} as Managers,
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthorizationError("Invalid API-Key."));
      });
    });
  });

  describe("validateAuthorization() Unconfigured API Key", () => {
    it("rejects api-key auth when API_KEYS is empty", async () => {
      vi.stubEnv("API_KEYS", "");

      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        await expect(async () => {
          await auth.validateAuthorization({
            auth: AuthorizationRequirement.apiKey,
            httpRequest: FakeHTTPRequests.validAPIKey,
            managers: {} as Managers,
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthorizationError("API key auth is not configured."));
      });
    });
  });

  describe("validateAuthorization() mis-matched existing user", () => {
    it("with no auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await org.createOrganization({ organization: FakeOrganizations.org1 });
        await user.createUser({ user: FakeUsers.existingUser });
        const result = await auth.validateAuthorization({
          auth: undefined,
          httpRequest: FakeHTTPRequests.validExistingUserSessionAlternateID,
          managers: { user, org },
          pgPool,
          logger,
        });
        expect(result.user?.id).toEqual("existingUser");
        expect(result.user?.email).toEqual("existingUser@example.com");
        expect(result.user?.fullName).toEqual("Existing User");
        expect(result.user?.organizations.size).toEqual(1);
        expect(result.user?.organizations.get(FakeOrganizations.org1.id)).toEqual({
          id: "11111111-1111-1111-1111-111111111111",
          name: "Org 1",
        });
        expect(result.auth).toBeUndefined();

        /// Check user was updated:
        expect(user.users.size).toEqual(1);
        expect(user.usersByEmail.get("existinguser@example.com")?.id).toEqual("existingUser");
        expect(user.usersByEmail.get("existinguser@example.com")?.email).toEqual("existingUser@example.com");
        expect(user.usersByEmail.get("existinguser@example.com")?.auth?.email).toEqual("EXISTINGUSER@example.com");
        expect(user.usersByEmail.get("existinguser@example.com")?.auth?.isFake).toEqual(true);
      }).expectClient(fakeClient.expectTransaction());
    });

    it("with session auth requirement", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        const org = new FakeOrgManager();
        await org.createOrganization({ organization: FakeOrganizations.org1 });
        await user.createUser({ user: FakeUsers.existingUser });
        const result = await auth.validateAuthorization({
          auth: AuthorizationRequirement.session,
          httpRequest: FakeHTTPRequests.validExistingUserSessionAlternateID,
          managers: { user, org },
          pgPool,
          logger,
        });
        expect(result.user?.id).toEqual("existingUser");
        expect(result.user?.email).toEqual("existingUser@example.com");
        expect(result.user?.fullName).toEqual("Existing User");
        expect(result.user?.organizations.size).toEqual(1);
        expect(result.user?.organizations.get(FakeOrganizations.org1.id)).toEqual({
          id: "11111111-1111-1111-1111-111111111111",
          name: "Org 1",
        });
        expect(result.auth).toEqual("session");

        /// Check user was updated:
        expect(user.users.size).toEqual(1);
        expect(user.usersByEmail.get("existinguser@example.com")?.id).toEqual("existingUser");
        expect(user.usersByEmail.get("existinguser@example.com")?.email).toEqual("existingUser@example.com");
        expect(user.usersByEmail.get("existinguser@example.com")?.auth?.email).toEqual("EXISTINGUSER@example.com");
        expect(user.usersByEmail.get("existinguser@example.com")?.auth?.isFake).toEqual(true);
      }).expectClient(fakeClient.expectTransaction());
    });
  });

  describe("validateAuthorization() app access gating", () => {
    it("allows verified users when no app access allow-list is configured", async () => {
      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const result = await auth.validateAuthorization({
          auth: AuthorizationRequirement.session,
          httpRequest: { headers: { cookie: "appSession=person@example.com;" } } as Request,
          managers: { user: new FakeUserManager(), org: new FakeOrgManager() },
          pgPool,
          logger,
        });

        expect(result.user?.email).toEqual("person@example.com");
        expect(result.auth).toEqual("session");
      }).expectClient(fakeClient.expectTransaction());
    });

    it("rejects verified users outside the configured app access allow-list", async () => {
      vi.stubEnv("APP_ACCESS_ALLOW_LIST", "@restricted-company.com");

      await fakePersistence(async (pgPool) => {
        const auth = new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie);
        const user = new FakeUserManager();
        await user.createUser({ user: FakeUsers.existingUser });

        await expect(async () => {
          await auth.validateAuthorization({
            auth: AuthorizationRequirement.session,
            httpRequest: FakeHTTPRequests.validExistingUserSession,
            managers: { user, org: new FakeOrgManager() },
            pgPool,
            logger,
          });
        }).rejects.toThrowError(new AuthorizationError());
      }).expectClient(fakeClient.expectTransaction());
    });
  });
});
