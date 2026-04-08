import http from "node:http";

import { Configuration } from "@/server/config";
import { logger } from "@/server/logger";
import { createPGPool } from "@/server/persistence";

import { createApp } from "@/app";
import { startJobListener } from "@/jobQueue/jobListener";

const pgPool = await createPGPool();
const app = createApp({ logger, pgPool });
const httpServer = http.createServer(app);
const jobQueue = startJobListener();

await new Promise<void>((resolve) => httpServer.listen({ port: Configuration.LISTEN_PORT }, resolve));
logger.info(`🚀 Server ready at ${Configuration.HOST.join(", ")}`);

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
    await jobQueue.shutdown();
  } catch (error) {
    logger.error({ error }, "Job queue could not be shut down.");
  }

  try {
    await pgPool.end();
  } catch (error) {
    logger.error({ error }, "PG Pool could not be shut down.");
  }
}
