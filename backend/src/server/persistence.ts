import { randomUUID } from "node:crypto";

import pg from "pg";
import type pino from "pino";

import { CONFIG } from "@/serverInitSetup/config";
import { logger as globalLogger } from "@/serverInitSetup/logger";

function isTestAssertion(error: unknown) {
  return typeof error === "object" && error && error.constructor.name === "AssertionError";
}

export async function createPGClient(): Promise<pg.Client> {
  let client: pg.Client | undefined;
  try {
    client = new pg.Client({
      user: CONFIG.DB_CREDENTIALS.username,
      host: CONFIG.DB_HOST,
      database: CONFIG.DB_DATABASE_NAME,
      password: CONFIG.DB_CREDENTIALS.password,
      port: CONFIG.DB_CREDENTIALS.port,
    });
    await client.connect();
  } catch (err) {
    globalLogger.error(err, "Error connecting to DB");
    await client?.end();
    throw err;
  }
  return client;
}

export async function createPGPool(): Promise<pg.Pool> {
  return new pg.Pool({
    host: CONFIG.DB_HOST,
    user: CONFIG.DB_CREDENTIALS.username,
    database: CONFIG.DB_DATABASE_NAME,
    password: CONFIG.DB_CREDENTIALS.password,
    port: CONFIG.DB_CREDENTIALS.port,
  });
}

export async function withPGClient<T>(
  { pgPool, logger = globalLogger }: { pgPool: pg.Pool; logger?: pino.Logger },
  work: (context: { pgClient: pg.ClientBase; logger: pino.Logger }) => Promise<T>,
): Promise<T> {
  let pgClient: pg.PoolClient | undefined;
  const childLogger = logger.child({ pgClientID: randomUUID() });

  try {
    const connectionStartTime = process.hrtime();
    pgClient = await pgPool.connect();
    const connectionDelay = process.hrtime(connectionStartTime);

    const processingStartTime = process.hrtime();
    const result = await work({ pgClient, logger: childLogger });

    try {
      pgClient.release(false);
    } catch (error) {
      if (isTestAssertion(error)) throw error;
      childLogger.error({ error }, "Error releasing PG Pool Client connection after success.");
    }

    const processingDelay = process.hrtime(processingStartTime);
    childLogger.info(
      {
        connectionDelay: `${(connectionDelay[0] * 1000 + connectionDelay[1] / 1000 / 1000).toFixed(3)}ms`,
        processingDelay: `${(processingDelay[0] * 1000 + processingDelay[1] / 1000 / 1000).toFixed(3)}ms`,
      },
      "PG client runtime stats.",
    );

    return result;
  } catch (error) {
    childLogger.warn({ error }, "withPGClient encountered error.");

    try {
      pgClient?.release(true);
    } catch (error) {
      if (isTestAssertion(error)) throw error;
      childLogger.error({ error }, "Error releasing PG Pool Client connection after failure.");
    }

    throw error;
  }
}

export type TransactionMode = "readWrite" | "readOnly";
export type IsolationLevel = "serializable" | "repeatableRead" | "readCommitted";

/**
 * Check if the client is currently in a transaction block.
 *
 * Compares transaction_timestamp() with statement_timestamp(). In a transaction block,
 * transaction_timestamp() remains constant while statement_timestamp() advances.
 * When equal, we're in autocommit mode (not in a transaction block).
 *
 * @returns true if in a transaction block, false if in autocommit mode
 */
export async function isInTransaction(pgClient: pg.ClientBase): Promise<boolean> {
  const result = await pgClient.query<{ in_transaction: boolean }>(
    "SELECT transaction_timestamp() != statement_timestamp() as in_transaction",
  );
  return result.rows[0]?.in_transaction ?? false;
}

/**
 * Perform a single-shot transaction.
 *
 * Many transactions should be retried, but can't be guaranteed to be idempotent by Postgres. If the application can guarantee its work is idempotent, withIdempotentTransaction should be used instead to automatically retry acceptable errors up to a deadline specified in milliseconds.
 *
 * See Also: https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html
 */
export async function withTransaction<T>(
  {
    pgClient,
    logger = globalLogger,
    mode = "readWrite",
    isolation = "serializable",
  }: { pgClient: pg.ClientBase; logger?: pino.Logger; mode?: TransactionMode; isolation?: IsolationLevel },
  work: (context: { pgClient: pg.ClientBase; logger: pino.Logger }) => Promise<T>,
): Promise<T> {
  try {
    const transactionMode = (() => {
      switch (mode) {
        case "readOnly":
          return "TRANSACTION READ ONLY";
        case "readWrite":
          return "";
        default:
          throw new Error(`Unknown transaction mode: ${mode}`);
      }
    })();
    const isolationLevel = (() => {
      switch (isolation) {
        case "serializable":
          return "ISOLATION LEVEL SERIALIZABLE";
        case "repeatableRead":
          return "ISOLATION LEVEL REPEATABLE READ";
        case "readCommitted":
          return "";
        default:
          throw new Error(`Unknown isolation level: ${isolation}`);
      }
    })();
    await pgClient.query(`
      BEGIN
        ${transactionMode}
        ${isolationLevel};
    `);
    const result = await work({ pgClient, logger });
    await pgClient.query("COMMIT;");
    return result;
  } catch (error) {
    logger.error({ error }, "Error applying transaction.");
    await pgClient.query("ROLLBACK;");
    throw error;
  }
}

type PostgresError = string;

export const PostgresError = {
  serializationFailure: "40001",
  deadlockDetected: "40P01",
  uniqueViolation: "23505",
  exclusionViolation: "23P01",
  retryableErrors: new Set<PostgresError>(),
};

PostgresError.retryableErrors = new Set([
  PostgresError.serializationFailure,
  PostgresError.deadlockDetected,
  PostgresError.uniqueViolation,
  PostgresError.exclusionViolation,
]);

/**
 * Perform a retry-able transaction.
 *
 * Many transactions should be retried, but can't be guaranteed to be idempotent by Postgres. If the application can guarantee its work is idempotent, withIdempotentTransaction should be used to automatically retry acceptable errors up to a deadline specified in milliseconds.
 *
 * See Also: https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html
 */
export async function withIdempotentTransaction<T>(
  {
    pgClient,
    logger = globalLogger,
    mode = "readWrite",
    isolation = "serializable",
    deadlineMS = 5 * 1000,
    retryableErrors = PostgresError.retryableErrors,
  }: {
    pgClient: pg.ClientBase;
    logger?: pino.Logger;
    mode?: TransactionMode;
    isolation?: IsolationLevel;
    deadlineMS?: number;
    retryableErrors?: Set<PostgresError>;
  },
  work: (context: { pgClient: pg.ClientBase; logger: pino.Logger; isRetry: boolean }) => Promise<T>,
): Promise<T> {
  const startHRTime = process.hrtime();
  let isRetry = false;

  while (true) {
    try {
      return await withTransaction({ pgClient, logger, mode, isolation }, async ({ pgClient, logger }) => {
        return await work({ pgClient, logger, isRetry });
      });
    } catch (error) {
      const totalHRTime = process.hrtime(startHRTime);
      const totalTime = totalHRTime[0] * 1000 + totalHRTime[1] / 1000 / 1000;
      const childLogger = logger.child({
        error,
        totalTime: `${totalTime.toFixed(3)}ms`,
        deadline: `${deadlineMS.toFixed(3)}ms`,
        retryableErrors: [...retryableErrors],
      });
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        typeof error.code === "string" &&
        retryableErrors.has(error.code)
      ) {
        if (totalTime > deadlineMS) {
          childLogger.error("Retryable transaction could not be applied, but ran out of time.");
          throw error;
        }
        childLogger.info("Retryable transaction could not be applied, will retry.");
        isRetry = true;
        continue;
      }
      childLogger.error("Error applying retryable transaction, cannot retry.");
      throw error;
    }
  }
}
