import http from "node:http";

import { createPGPool } from "@/server/persistence";
import { createBetterAuth, createBetterAuthSessionResolver } from "@/serverInitSetup/auth";
import { CONFIG } from "@/serverInitSetup/config";
import { logger } from "@/serverInitSetup/logger";

import { ProductionAuthorizationManager } from "@/lib/authorization";

import { PGOrgManager } from "@/model/org";
import { PGUserManager } from "@/model/user";

import { createApp } from "@/app";

logger.info({ appEnv: CONFIG.APP_ENV, nodeEnv: process.env.NODE_ENV }, "Starting backend");

const pgPool = await createPGPool();
const auth = createBetterAuth(pgPool);
const app = createApp({
  managers: {
    org: PGOrgManager,
    user: PGUserManager,
  },
  authorization: new ProductionAuthorizationManager(createBetterAuthSessionResolver(auth)),
  auth,
  pgPool,
  logger,
});
const httpServer = http.createServer(app);

// Modified server startup
await new Promise<void>((resolve) => httpServer.listen({ port: CONFIG.BACKEND_LISTEN_PORT }, resolve));
logger.info(`🚀 Server ready at ${CONFIG.BACKEND_PUBLIC_URL_AND_PORT.join(", ")}`);

/// Add listeners for clean shutdowns.
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
async function shutdown() {
  logger.info("Shutdown signal received");

  await new Promise<void>((resolve) =>
    httpServer.close((error) => {
      if (error) {
        logger.error({ error }, "HTTP Server could not be shut down.");
      }
      resolve();
    }),
  );

  try {
    await pgPool.end();
  } catch (error) {
    logger.error({ error }, "PG Pool could not be shut down.");
  }
}
