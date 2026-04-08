import type pg from "pg";

import { logger } from "@/server/logger";
import { createPGClient } from "@/server/persistence";

import { runList } from "@/migrations";

// Run with `% npm run db:migrate`

let client: pg.Client | undefined;

try {
  logger.info("Starting migrations…");
  client = await createPGClient();

  await client.query({
    text: `
      CREATE TABLE IF NOT EXISTS public.migrations (
        "name" text NOT NULL,
        "migrated_at" timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (name)
      );
    `,
  });

  const migrationsToRun = (await Promise.all(runList)).map((module) => module.default);

  // Run each migration, wrapping them in transactions so competing instances can't all run them at the same time.
  for (const migration of migrationsToRun) {
    await client.query("BEGIN");
    try {
      const existingMigration = await client.query<{ name: string; migrated_at: Date }>({
        text: `
          SELECT *
            FROM migrations
            WHERE "name" = $1;
        `,
        values: [migration.name],
        name: "migration-lookup",
      });

      if (existingMigration.rows.length === 1) {
        logger.info(`Skipping ${migration.name}.`);
        await client.query("COMMIT");
        continue;
      }

      if (existingMigration.rows.length >= 1) {
        logger.error({ migration: migration.name, rows: existingMigration.rows }, "Found too many migrations.");
        throw new Error(`More than one migration found for ${migration.name}`);
      }

      logger.info(`Migrating ${migration.name}…`);
      await migration.run(client);

      await client.query({
        text: `
          INSERT INTO public.migrations (
            "name"
          ) VALUES (
            $1
          );
        `,
        values: [migration.name],
      });
      await client.query("COMMIT");
      logger.info("Done.");
    } catch (error) {
      logger.error({ error }, "Migration failed.");
      await client.query("ROLLBACK");
      throw error;
    }
  }

  await client.end();
  logger.info("Finished migrations!");
} catch (error) {
  logger.warn({ error }, "Failed to run migrations. Service may start in an invalid state.");
  await client?.end();
}

await new Promise((resolve) => setTimeout(resolve, 500));
