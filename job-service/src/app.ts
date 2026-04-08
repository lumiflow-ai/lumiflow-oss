import express, { type Express } from "express";
import type pg from "pg";
import type { Logger } from "pino";

import { installRoutesOnExpress } from "@/lib/routeGroup";

import { apiRoutes } from "@/routes";

export function createApp({ logger, pgPool }: { logger: Logger; pgPool: pg.Pool }) {
  const app: Express = express();

  installRoutesOnExpress({ routes: apiRoutes, app, logger, pgPool });

  return app;
}
