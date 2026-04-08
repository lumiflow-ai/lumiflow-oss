/**
 * Database Cleanup Script: Clear Everything Except Artifacts
 *
 * This script clears everything except artifacts from the database - all computed,
 * derived, and evaluation data while preserving the core artifact data. It's designed
 * for development environments to reset the system to a clean state for local work.
 *
 * What gets cleared:
 * - evaluation_queue: Pending evaluation jobs
 * - generations: AI model generation records
 * - metric_definitions: Metric configuration data
 * - metrics: Computed metric values
 * - recipes: Recipe/workflow definitions
 * - All evaluation results stored in artifact_snapshots.snapshot.metrics
 *
 * What gets preserved:
 * - All artifact data and metadata
 *
 * Safety Features:
 * - Only runs in development environment (NODE_ENV=development)
 * - Confirmation prompt before making changes
 * - Provides detailed logging of operations
 *
 * Usage: npm run db:clear-except-artifacts
 */

import { createInterface } from "node:readline";

import { createPGClient } from "@/server/persistence";
import { CONFIG, isDev } from "@/serverInitSetup/config";

/**
 * Main function to clear everything except artifacts from the database
 */
async function clearEverythingExceptArtifacts() {
  // Safety check: only allow running in development environment
  if (!isDev) {
    console.error("❌ This script can only be run in development environment");
    console.error("Current NODE_ENV:", process.env.NODE_ENV);
    console.error("Set NODE_ENV=development to run this script");
    process.exit(1);
  }

  console.log("🔍 Development environment confirmed, proceeding to clear everything except artifacts...");

  // Create database connection using the same configuration as the application
  const client = await createPGClient();

  try {
    console.log("✅ Connected to database");
    console.log(`📍 Database: ${CONFIG.DB_DATABASE_NAME} on ${CONFIG.DB_HOST}:${CONFIG.DB_CREDENTIALS.port}`);

    // Confirmation prompt
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      readline.question("\n⚠️  This will permanently delete everything except artifacts. Continue? (y/N): ", resolve);
    });

    readline.close();

    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
      console.log("❌ Operation cancelled by user");
      return;
    }

    console.log("▶️  Proceeding to clear everything except artifacts...");

    // Clear evaluation-related tables
    // These tables contain computed/derived data that can be regenerated
    await client.query(`
      TRUNCATE TABLE evaluation_queue, generations, metric_definitions, metrics, recipes CASCADE;
    `);
    console.log("✓ Cleared tables: evaluation_queue, generations, metric_definitions, metrics, recipes");

    // Clear evaluation results from artifact snapshots
    // This preserves the artifact snapshots but removes the computed metrics within them
    console.log("\n🧹 Clearing everything except artifacts from snapshots...");
    const result = await client.query(`
      UPDATE artifact_snapshots
      SET snapshot = jsonb_set(snapshot, '{metrics}', '[]'::jsonb)
      WHERE snapshot ? 'metrics';
    `);
    console.log(`✓ Cleared everything except artifacts from ${result.rowCount} snapshots`);

    console.log("📊 Artifacts preserved, all other data cleared");
  } catch (error) {
    console.error("\n❌ Error during database cleanup:", error);
    console.error("💡 Check database connection and permissions");
    process.exit(1);
  } finally {
    // Ensure database connection is properly closed
    await client.end();
    console.log("🔌 Database connection closed");
  }
}

// Execute the cleanup function
clearEverythingExceptArtifacts();
