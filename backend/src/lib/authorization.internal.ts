import type { Request } from "express";

import {
  type AuthorizationManager,
  AuthorizationRequirement,
  type AuthorizationResult,
  type UserSessionInfo,
} from "@/lib/authorization";

import { FakeOrganizations } from "@/model/org.internal";

import { OrgIDs } from "@/user";

/**
 * Available cookies that can be set on supertest using `.set("Cookie", [FakeCookies.validExistingUserSession])`.
 *
 * Note that these can be used by creating an authentication manager in tests using `new ProductionAuthorizationManager(deriveFakeUserSessionFromSessionCookie)`
 */
export const FakeCookies = {
  validNewUserSession: "appSession=newUser@example.com;",
  validExistingUserSession: "appSession=existingUser@example.com;",
  validExistingUserSessionAlternateID: "appSession=EXISTINGUSER@example.com;",
  validMigratedUserSession: "appSession=unit-test@testing.example.com;",
  missingUserSession: "",
};

/**
 * Available API Keys that can be set on supertest using `.set("X-API-Key", [FakeAPIKeys.valid])`.
 *
 * Note that these can be used by creating an authentication manager in tests using `new ProductionAuthorizationManager(…)`
 */
export const FakeAPIKeys = {
  valid: "test-api-key",
  invalid: "INVALID",
  missing: "",
};

function makeFakeUserSessionRequest(cookie: string | undefined): Request {
  return { headers: { cookie } } as Request;
}

function makeFakeAPIKeyRequest(apiKey: string | undefined): Request {
  return { headers: { "x-api-key": apiKey } } as unknown as Request;
}

/**
 * Available HTTP Requests that can be used when testing components that directly take one as an argument.
 */
export const FakeHTTPRequests = {
  validNewUserSession: makeFakeUserSessionRequest(FakeCookies.validNewUserSession),
  validExistingUserSession: makeFakeUserSessionRequest(FakeCookies.validExistingUserSession),
  validExistingUserSessionAlternateID: makeFakeUserSessionRequest(FakeCookies.validExistingUserSessionAlternateID),
  validMigratedUserSession: makeFakeUserSessionRequest(FakeCookies.validMigratedUserSession),
  missingUserSession: makeFakeUserSessionRequest(FakeCookies.missingUserSession),

  validAPIKey: makeFakeAPIKeyRequest(FakeAPIKeys.valid),
  invalidAPIKey: makeFakeAPIKeyRequest(FakeAPIKeys.invalid),

  empty: { headers: {} } as Request,
};

const invalidUnverifiedUserSession: AuthorizationResult = {
  user: {
    id: "newUser",
    email: "newUser@example.com",
    fullName: "New User",
    organizations: new Map([]),
    isAuthenticated: false,
    isEmailVerified: false,
  },
  auth: undefined,
};

const validUnverifiedUserSession: AuthorizationResult = {
  user: {
    id: "newUser",
    email: "newUser@example.com",
    fullName: "New User",
    organizations: new Map([]),
    isAuthenticated: true,
    isEmailVerified: false,
  },
  auth: undefined,
};

const validNewUserSession: AuthorizationResult = {
  user: {
    id: "newUser",
    email: "newUser@example.com",
    fullName: "New User",
    organizations: new Map([]),
    isAuthenticated: true,
    isEmailVerified: true,
  },
  auth: AuthorizationRequirement.session,
};

const validExistingUserSession: AuthorizationResult = {
  user: {
    id: "existingUser",
    email: "existingUser@example.com",
    fullName: "Existing User",
    organizations: new Map([[FakeOrganizations.org1.id, FakeOrganizations.org1]]),
    isAuthenticated: true,
    isEmailVerified: true,
  },
  auth: AuthorizationRequirement.session,
};

const validMigratedUserSession: AuthorizationResult = {
  user: {
    id: "migratedUser",
    email: "unit-test@testing.example.com",
    fullName: "In Memory To DB Migrated User",
    organizations: new Map([[OrgIDs.testData, { id: OrgIDs.testData, name: "Test Data" }]]),
    isAuthenticated: true,
    isEmailVerified: true,
  },
  auth: AuthorizationRequirement.session,
};

const validMedicalUserSession: AuthorizationResult = {
  user: {
    id: "demoMedicalUser",
    email: "demo.medical.user@example.com",
    fullName: "Demo Medical User",
    organizations: new Map([[FakeOrganizations.medical.id, FakeOrganizations.medical]]),
    isAuthenticated: true,
    isEmailVerified: true,
  },
  auth: AuthorizationRequirement.session,
};

/** Available authorization results that can be passed directly to FakeAuthorizationManager to simulate different user session conditions. */
export const FakeAuthorizationResults = {
  invalidUnverifiedUserSession,
  validUnverifiedUserSession,
  validNewUserSession,
  validExistingUserSession,
  validMigratedUserSession,
  validMedicalUserSession,
};

export function deriveFakeUserSessionFromSessionCookie(httpRequest: Request): UserSessionInfo | null {
  const cookie = httpRequest.headers.cookie;
  if (!cookie) return null;

  const cookieMatcher = cookie.match(/appSession=([^;]+);/);
  if (!cookieMatcher || cookieMatcher.length <= 1) return null;
  const email = cookieMatcher[1];
  if (!email) return null;

  return {
    email,
    fullName: undefined,
    isAuthenticated: true,
    isEmailVerified: true,
    sessionInfo: {
      email,
      isFake: true,
    },
  };
}

export class FakeAuthorizationManager implements AuthorizationManager {
  result: AuthorizationResult | Error;

  constructor(result: AuthorizationResult | Error) {
    this.result = result;
  }

  async validateAuthorization() {
    if (this.result instanceof Error) {
      throw this.result;
    }
    return this.result;
  }
}
