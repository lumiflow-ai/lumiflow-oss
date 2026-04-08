import { betterAuth } from "better-auth";
import { splitSetCookieHeader } from "better-auth/cookies";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import express, { type Express, type Request as ExpressRequest, type Response } from "express";
import helmet from "helmet";
import type pg from "pg";

import type { UserSessionInfo, UserSessionResolver } from "@/lib/authorization";

import { CONFIG } from "./config";

function resolveHostIndex(request: ExpressRequest) {
  return CONFIG.BACKEND_PUBLIC_URL_AND_PORT.map((host) => host.split("://", 2)[1]?.split(":", 2)[0]).indexOf(
    request.hostname,
  );
}

function frontendURLForRequest(request: ExpressRequest, path: string) {
  const index = resolveHostIndex(request);
  const baseURL = CONFIG.FRONTEND_PUBLIC_URL_AND_PORT[index >= 0 ? index : 0] ?? CONFIG.FRONTEND_PUBLIC_URL_AND_PORT[0];
  return new URL(path, baseURL).toString();
}

function backendURLForRequest(request: ExpressRequest, path: string) {
  const index = resolveHostIndex(request);
  const baseURL = CONFIG.BACKEND_PUBLIC_URL_AND_PORT[index >= 0 ? index : 0] ?? CONFIG.BACKEND_PUBLIC_URL_AND_PORT[0];
  return new URL(path, baseURL).toString();
}

function getSafeRedirectPath(path: unknown, fallback = "/app") {
  if (typeof path !== "string") return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  return path;
}

function copySetCookieHeaders(headers: Headers, response: Response) {
  if (typeof headers.getSetCookie === "function") {
    const setCookieHeaders = headers.getSetCookie();
    if (setCookieHeaders.length > 0) {
      for (const cookie of setCookieHeaders) {
        response.append("Set-Cookie", cookie);
      }
      return;
    }
  }

  const rawSetCookieHeader = headers.get("set-cookie");
  if (!rawSetCookieHeader) return;

  for (const cookie of splitSetCookieHeader(rawSetCookieHeader)) {
    response.append("Set-Cookie", cookie);
  }
}

function passwordLoginConfig() {
  const email = CONFIG.AUTH_DEV_EMAIL.trim().toLowerCase();
  const password = CONFIG.AUTH_DEV_PASSWORD;

  return {
    enabled: CONFIG.IS_DEV && email.length > 0 && password.length > 0,
    email,
    password,
  };
}

async function callAuthEndpoint({
  request,
  authProvider,
  path,
  body,
}: {
  request: ExpressRequest;
  authProvider: ReturnType<typeof createBetterAuth>;
  path: string;
  body: Record<string, unknown>;
}) {
  const headers = fromNodeHeaders(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");

  return await authProvider.handler(
    new globalThis.Request(backendURLForRequest(request, `/api/auth${path}`), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

async function ensurePasswordLoginUser({
  request,
  authProvider,
  pgPool,
  email,
  password,
}: {
  request: ExpressRequest;
  authProvider: ReturnType<typeof createBetterAuth>;
  pgPool: pg.Pool;
  email: string;
  password: string;
}) {
  const existingUser = await pgPool.query("SELECT 1 FROM auth_users WHERE email = $1 LIMIT 1", [email]);

  if (existingUser.rowCount === 0) {
    const signUpResponse = await callAuthEndpoint({
      request,
      authProvider,
      path: "/sign-up/email",
      body: {
        name: "Lumiflow Dev User",
        email,
        password,
      },
    });

    if (!signUpResponse.ok && signUpResponse.status !== 422) {
      throw new Error(`Unable to create login user: ${signUpResponse.status}`);
    }
  }

  await pgPool.query('UPDATE auth_users SET "emailVerified" = true WHERE email = $1', [email]);
}

export function createBetterAuth(pgPool: pg.Pool) {
  const authCookieDomain = CONFIG.AUTH_COOKIE_DOMAIN.trim();
  const canUseCrossDomainCookies =
    authCookieDomain.length > 0 && authCookieDomain !== "localhost" && authCookieDomain.includes(".");
  const passwordLogin = passwordLoginConfig();

  return betterAuth({
    secret: CONFIG.AUTH_SECRET,
    baseURL: CONFIG.BACKEND_PUBLIC_URL_AND_PORT[0],
    basePath: "/api/auth",
    database: pgPool,
    emailAndPassword: {
      enabled: passwordLogin.enabled,
      minPasswordLength: 8,
    },
    socialProviders: {
      google: {
        clientId: CONFIG.GOOGLE_CLIENT_ID,
        clientSecret: CONFIG.GOOGLE_CLIENT_SECRET,
      },
    },
    account: {
      modelName: "auth_accounts",
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
      storeStateStrategy: "cookie",
    },
    user: {
      modelName: "auth_users",
    },
    session: {
      modelName: "auth_sessions",
    },
    verification: {
      modelName: "auth_verifications",
    },
    trustedOrigins: CONFIG.FRONTEND_PUBLIC_URL_AND_PORT,
    advanced: canUseCrossDomainCookies
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: authCookieDomain,
          },
        }
      : undefined,
    rateLimit: {
      enabled: false,
    },
  });
}

export function installAuth(app: Express, authProvider: ReturnType<typeof createBetterAuth>, pgPool: pg.Pool) {
  // Security
  app.use(
    helmet(
      // Special config to allow auth to work locally
      CONFIG.IS_PROD
        ? {
            contentSecurityPolicy: {
              directives: {
                defaultSrc: [`'self'`],
                scriptSrc: [`'self'`, `https: 'unsafe-inline'`],
              },
            },
          }
        : {
            strictTransportSecurity: false,
            crossOriginEmbedderPolicy: false,
            contentSecurityPolicy: false,
          },
    ),
  );

  const authHandler = toNodeHandler(authProvider);
  app.all("/api/auth", authHandler);
  app.all("/api/auth/*", authHandler);

  app.post("/login", express.json(), express.urlencoded({ extended: false }), async (request, response, next) => {
    try {
      const passwordLogin = passwordLoginConfig();
      if (!passwordLogin.enabled) {
        response.status(404).json({ error: "Login is not configured." });
        return;
      }

      const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
      const password = typeof request.body?.password === "string" ? request.body.password : "";

      if (email !== passwordLogin.email || password !== passwordLogin.password) {
        response.status(401).json({ error: "Invalid email or password." });
        return;
      }

      await ensurePasswordLoginUser({
        request,
        authProvider,
        pgPool,
        email: passwordLogin.email,
        password: passwordLogin.password,
      });

      const authResponse = await callAuthEndpoint({
        request,
        authProvider,
        path: "/sign-in/email",
        body: {
          email: passwordLogin.email,
          password: passwordLogin.password,
          callbackURL: frontendURLForRequest(request, getSafeRedirectPath(request.query.path)),
        },
      });

      copySetCookieHeaders(authResponse.headers, response);

      if (!authResponse.ok) {
        response.status(authResponse.status).json({ error: "Unable to complete login." });
        return;
      }

      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get("/login", async (request, response, next) => {
    try {
      const callbackPath = getSafeRedirectPath(request.query.path);
      const headers = fromNodeHeaders(request.headers);
      headers.set("content-type", "application/json");

      const authResponse = await authProvider.handler(
        new globalThis.Request(backendURLForRequest(request, "/api/auth/sign-in/social"), {
          method: "POST",
          headers,
          body: JSON.stringify({
            provider: "google",
            callbackURL: frontendURLForRequest(request, callbackPath),
            newUserCallbackURL: frontendURLForRequest(request, "/app/signup"),
          }),
        }),
      );

      copySetCookieHeaders(authResponse.headers, response);

      const location = authResponse.headers.get("location");
      if (location) {
        response.redirect(location);
        return;
      }

      const body = (await authResponse.json()) as { url?: string };
      response.redirect(body.url ?? frontendURLForRequest(request, callbackPath));
    } catch (error) {
      next(error);
    }
  });

  app.get("/logout", async (request, response, next) => {
    try {
      const callbackPath = getSafeRedirectPath(request.query.path);

      const authResponse = await authProvider.handler(
        new globalThis.Request(backendURLForRequest(request, "/api/auth/sign-out"), {
          method: "POST",
          headers: fromNodeHeaders(request.headers),
        }),
      );

      copySetCookieHeaders(authResponse.headers, response);
      response.redirect(frontendURLForRequest(request, callbackPath));
    } catch (error) {
      next(error);
    }
  });
}

export function createBetterAuthSessionResolver(
  authProvider: ReturnType<typeof createBetterAuth>,
): UserSessionResolver {
  return async (httpRequest: ExpressRequest): Promise<UserSessionInfo | null> => {
    const session = await authProvider.api.getSession({
      headers: fromNodeHeaders(httpRequest.headers),
    });

    if (!session?.user?.email) return null;

    return {
      email: session.user.email,
      fullName: session.user.name || undefined,
      isAuthenticated: true,
      isEmailVerified: !!session.user.emailVerified,
      sessionInfo: {
        sessionID: session.session.id,
        userID: session.user.id,
        provider: "google",
      },
    };
  };
}
