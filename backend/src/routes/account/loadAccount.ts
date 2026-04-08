import { z } from "zod";

import { AuthenticationError, AuthorizationError } from "@/lib/authorization";
import { type RequestContext, RouteGroup } from "@/lib/routeGroup";

import { isEmailAllowedForApp } from "@/user";

import { AccountResponseSchema } from "./definitions";

export const loadAccount = new RouteGroup();

function cookieNames(cookieHeader: string | undefined): Set<string> {
  if (!cookieHeader) return new Set();

  return new Set(
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim().split("=", 1)[0])
      .filter((name) => name.length > 0),
  );
}

function emailDomain(email: string): string | undefined {
  const [, domain] = email.split("@", 2);
  if (!domain) return undefined;
  return domain.toLowerCase();
}

function logAccountAuthDiagnostic(context: RequestContext, payload: Record<string, unknown>) {
  context.logger.warn(
    {
      diagnostic: "account-auth",
      ...payload,
    },
    "Account request failed auth checks.",
  );
}

loadAccount.get(null, { requestSchema: z.void(), responseSchema: AccountResponseSchema }, async (_, context) => {
  const { user } = context;
  if (!user) {
    const cookies = cookieNames(context.httpRequest.headers.cookie);

    logAccountAuthDiagnostic(context, {
      reason: "missing-user-session",
      hasSessionCookie: cookies.has("better-auth.session_token"),
    });
    throw new AuthenticationError("Session Not Found");
  }
  if (!user.isAuthenticated) {
    logAccountAuthDiagnostic(context, {
      reason: "user-not-authenticated",
      emailDomain: emailDomain(user.email),
      isEmailVerified: user.isEmailVerified,
    });
    throw new AuthorizationError();
  }
  if (!isEmailAllowedForApp(user.email)) {
    logAccountAuthDiagnostic(context, {
      reason: "email-not-allowed-for-app-environment",
      appEnv: process.env.APP_ENV,
      emailDomain: emailDomain(user.email),
    });
    throw new AuthorizationError();
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    },
    isEmailVerified: user.isEmailVerified,
  };
});
