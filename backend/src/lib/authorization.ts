import { randomUUID } from "node:crypto";

import type { Request } from "express";
import type pg from "pg";
import type { Logger } from "pino";

import type { Organization, OrganizationID, UserID } from "@/types";

import { withIdempotentTransaction, withPGClient } from "@/server/persistence";
import { isDev } from "@/serverInitSetup/config";

import { validateAPIKey } from "@/lib/apikey";
import { ExpiringLeastRecentlyUsedCache } from "@/lib/cache";

import type { Managers } from "@/model/managers";

import { isEmailAllowedForApp, resolveOrganizationIDsForEmail } from "@/user";

export enum AuthorizationRequirement {
  session = "session",
  apiKey = "api-key",
}

export class AuthenticationError extends Error {
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      stack: isDev ? this.stack : undefined,
      cause: this.cause,
    };
  }
}
export class AuthorizationError extends Error {
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      stack: isDev ? this.stack : undefined,
      cause: this.cause,
    };
  }
}

/** An internal representation of the user session before it has been matched against a known user in persistence. */
export type UserSessionInfo = {
  email: string;
  fullName?: string;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  sessionInfo: Record<string, unknown>;
};

/** The current user that is logged in, along with information about their current authorization status and organization membership. */
export type UserSession = {
  id: UserID;
  email: string;
  fullName: string;

  organizations: Map<OrganizationID, Organization>;

  isAuthenticated: boolean;
  isEmailVerified: boolean;
};

export type UserSessionResolver = (httpRequest: Request) => UserSessionInfo | null | Promise<UserSessionInfo | null>;

export type AuthorizationResult = { user: UserSession | undefined; auth: AuthorizationRequirement | undefined };

export interface AuthorizationManager {
  validateAuthorization(parameters: {
    auth: AuthorizationRequirement | AuthorizationRequirement[] | undefined;
    httpRequest: Request;
    managers: Managers;
    pgPool: pg.Pool;
    logger: Logger;
  }): Promise<AuthorizationResult>;
}

export class ProductionAuthorizationManager implements AuthorizationManager {
  userSessionResolver: UserSessionResolver;
  userSessionCache = new ExpiringLeastRecentlyUsedCache<string, UserSession>();

  constructor(userSessionResolver: UserSessionResolver) {
    this.userSessionResolver = userSessionResolver;
  }

  async userSessionFromInfo({
    userSessionInfo,
    managers,
    now,
    ...context
  }: {
    userSessionInfo: UserSessionInfo | null;
    managers: Managers;
    now: Date;
    pgPool: pg.Pool;
    logger: Logger;
  }) {
    if (!userSessionInfo) return undefined;

    /// Key by the email of the session info since that's all we have to work from until a user is loaded from the persistence.
    const userSession = await this.userSessionCache.itemForID({
      id: userSessionInfo.email,
      now,
      async resolver() {
        return await withPGClient(context, async (context) => {
          return await withIdempotentTransaction(context, async (context) => {
            let persistedUser = await managers.user.fetchUserByEmail({ email: userSessionInfo.email, context });
            if (!persistedUser) {
              /// Create the user.
              persistedUser = await managers.user.createUser({
                user: {
                  id: randomUUID(),
                  email: userSessionInfo.email,
                  fullName: userSessionInfo.fullName ?? "",
                  organizationIDs: [],
                  auth: userSessionInfo.sessionInfo,
                },
                context,
              });
            } else {
              /// Update the session info on the user.
              await managers.user.updateUser({
                user: {
                  id: persistedUser.id,
                  auth: userSessionInfo.sessionInfo,
                },
                context,
              });
            }

            /// Load the organizations for the user
            /// Users from allowed domains get ALL orgs from OrgIDs plus any from their database record
            const orgIDsToLoad = resolveOrganizationIDsForEmail(persistedUser.email, persistedUser.organizationIDs);

            const organizations = new Map<OrganizationID, Organization>();
            for (const orgID of orgIDsToLoad) {
              const org = await managers.org.fetchOrganizationByID({ orgID, context });
              if (org) organizations.set(org.id, org);
            }

            return {
              id: persistedUser.id,
              email: persistedUser.email,
              fullName: persistedUser.fullName,
              organizations,
              isAuthenticated: userSessionInfo.isAuthenticated,
              isEmailVerified: userSessionInfo.isEmailVerified,
            };
          });
        });
      },
    });

    /// Don't keep the cached entry if it was not verified, since we'd like to re-verify the user next time.
    if (!userSession.isEmailVerified) this.userSessionCache.invalidateItemWithID(userSessionInfo.email);

    return userSession;
  }

  async validateAuthorization({
    auth,
    httpRequest,
    managers,
    now = new Date(),
    ...context
  }: {
    auth: AuthorizationRequirement | AuthorizationRequirement[] | undefined;
    httpRequest: Request;
    managers: Managers;
    now?: Date;
    pgPool: pg.Pool;
    logger: Logger;
  }): Promise<AuthorizationResult> {
    const authorizationRequirements = Array.isArray(auth)
      ? new Set(auth)
      : auth !== undefined
        ? new Set([auth])
        : new Set<AuthorizationRequirement>();

    /// Load the session info and user session no matter what.
    const userSessionInfo = await this.userSessionResolver(httpRequest);
    const userSession = await this.userSessionFromInfo({ userSessionInfo, now, managers, ...context });

    /// If no authorization is required, return the user as is, authenticated or not.
    if (authorizationRequirements.size === 0) return { user: userSession, auth: undefined };

    const requiresSession = authorizationRequirements.has(AuthorizationRequirement.session);
    const requiresAPIKey = authorizationRequirements.has(AuthorizationRequirement.apiKey);
    const hasVerifiedAuthenticatedSession =
      userSession !== undefined && userSession.isAuthenticated === true && userSession.isEmailVerified === true;
    const hasAppAccess = hasVerifiedAuthenticatedSession && isEmailAllowedForApp(userSession.email);

    /// If session authorization is required, check for it first.
    if (requiresSession) {
      if (hasAppAccess) {
        return { user: userSession, auth: AuthorizationRequirement.session };
      }
    }

    /// If APIKey authorization is required, check for it only is session auth fails.
    if (requiresAPIKey) {
      if (await validateAPIKey(httpRequest)) {
        return { user: undefined, auth: AuthorizationRequirement.apiKey };
      }
    }

    if (requiresSession && hasVerifiedAuthenticatedSession && !hasAppAccess) {
      throw new AuthorizationError();
    }

    /// If we got this far, authorization failed, so throw an error.
    if (authorizationRequirements.size === 1) {
      if (requiresSession) {
        throw new AuthenticationError("Session Not Found");
      }
      if (requiresAPIKey) {
        throw new AuthorizationError("API Key Not Found");
      }
    }
    throw new AuthorizationError();
  }
}
