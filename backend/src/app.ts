import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import type pg from "pg";
import type { Logger } from "pino";

import { createBetterAuth, installAuth } from "@/serverInitSetup/auth";
import { CONFIG } from "@/serverInitSetup/config";

import type { AuthorizationManager } from "@/lib/authorization";
import { installRoutesOnExpress } from "@/lib/routeGroup";

import type { Managers } from "@/model/managers";

import { apiRoutes } from "@/routes";

export function createApp({
  managers,
  authorization,
  auth,
  pgPool,
  logger,
}: {
  managers: Managers;
  authorization: AuthorizationManager;
  auth?: ReturnType<typeof createBetterAuth>;
  pgPool: pg.Pool;
  logger: Logger;
}) {
  const app: Express = express();
  const authProvider = auth ?? createBetterAuth(pgPool);

  // CORS must be registered before auth routes so /api/auth/* responses include CORS headers.
  app.use(
    "/",
    cors<cors.CorsRequest>({
      origin: CONFIG.FRONTEND_PUBLIC_URL_AND_PORT,
      credentials: true,
    }),
  );

  installAuth(app, authProvider, pgPool);

  // Set up routes
  app.get("/", (_req: Request, res: Response) => {
    res.send("Express + TypeScript Server.");
  });

  installRoutesOnExpress({
    routes: apiRoutes,
    app,
    managers,
    authorization,
    pgPool,
    logger,
  });

  return app;
}
