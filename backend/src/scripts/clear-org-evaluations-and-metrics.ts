/**
 * Database Cleanup Script: Clear Evaluations and Metrics for a Specific Organization
 *
 * This script clears evaluations and metrics for a specific organization including metric definitions,
 * recipes, and computed values on artifacts. It's designed for development environments to reset
 * an organization's evaluation and metrics data while preserving the core artifact data.
 *
 * What gets cleared for the specified org:
 * - metric_definitions: Metric configuration data for the org
 * - recipes: Recipe/workflow definitions for the org
 * - metrics: Computed metric values on artifacts for the org
 * - Evaluation and metrics results stored in artifact_snapshots.snapshot.metrics for the org
 *
 * What gets preserved:
 * - All artifact data and metadata
 * - Data from other organizations
 *
 * Safety Features:
 * - Only runs in development environment (NODE_ENV=development)
 * - Requires organization ID as argument
 * - Confirmation prompt before making changes
 * - Provides detailed logging of operations
 *
 * Usage: npx tsx src/scripts/clear-org-evaluations-and-metrics.ts <orgId>
 */

import { createInterface } from "node:readline";

import type pg from "pg";

import { createPGClient } from "@/server/persistence";
import { CONFIG, isDev } from "@/serverInitSetup/config";
import { logger } from "@/serverInitSetup/logger";

import { clearOrgEvalResults, getOrgEvalResultsStats } from "@/lib/clearOrgEvaluationsAndMetrics";

import { PGOrgManager } from "@/model/org";

async function main() {
  // Get organization ID from command line arguments
  const orgID = process.argv[2];

  if (!orgID) {
    console.error("❌ Organization ID is required");
    console.error("Usage: npx tsx src/scripts/clear-org-evaluations-and-metrics.ts <orgID>");
    process.exit(1);
  }

  // Safety check: only allow running in development environment
  if (!isDev) {
    console.error("❌ This script can only be run in development environment");
    console.error("Current NODE_ENV:", process.env.NODE_ENV);
    console.error("Set NODE_ENV=development to run this script");
    process.exit(1);
  }

  console.log("🔍 Development environment confirmed");

  let client: pg.Client | undefined;
  let orgDisplay = orgID;

  try {
    client = await createPGClient();
    console.log("✅ Connected to database");
    console.log(`📍 Database: ${CONFIG.DB_DATABASE_NAME} on ${CONFIG.DB_HOST}:${CONFIG.DB_CREDENTIALS.port}`);

    // Fetch organization name from database
    const org = await PGOrgManager.fetchOrganizationByID({ orgID, context: { pgClient: client, logger } });
    orgDisplay = org ? `${org.name} (${orgID})` : `${orgID}`;
    console.log(`📌 Preparing to clear evaluations and metrics for organization: ${orgDisplay}`);

    console.log(`✓ Processing organization: ${orgDisplay}`);

    // Get counts of data that will be deleted
    const stats = await getOrgEvalResultsStats(client, orgID);

    console.log("\n📊 Data to be deleted:");
    console.log(`   • ${stats.metricDefinitions} metric definitions`);
    console.log(`   • ${stats.recipes} recipes`);
    console.log(`   • ${stats.metrics} metrics`);
    console.log(`   • ${stats.snapshots} snapshots with metrics`);

    // Confirmation prompt
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      readline.question(
        `\n⚠️  This will permanently delete evaluations and metrics for ${orgDisplay}. Continue? (y/N): `,
        resolve,
      );
    });

    readline.close();

    if (!["y", "yes"].includes(answer.toLowerCase())) {
      console.log("❌ Operation cancelled by user");
      return;
    }

    console.log(`\n▶️  Clearing evaluations and metrics for ${orgDisplay}...`);

    // Perform the deletion with transaction management
    await client.query("BEGIN");

    const deletionStats = await clearOrgEvalResults(client, orgID);

    console.log(`✓ Deleted ${deletionStats.metricDefinitions} metric definitions`);
    console.log(`✓ Deleted ${deletionStats.recipes} recipes`);
    console.log(`✓ Deleted ${deletionStats.metrics} metrics`);
    console.log(`✓ Cleared metrics from ${deletionStats.snapshots} snapshots`);

    await client.query("COMMIT");
    console.log(`\n✅ Successfully cleared all evaluations and metrics for ${orgDisplay}`);
  } catch (error) {
    // Rollback transaction if we started one
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("⚠️  Failed to rollback transaction:", rollbackError);
      }
    }

    console.error(`\n❌ Error clearing evaluations and metrics for ${orgDisplay}:`, error);
    process.exit(1);
  } finally {
    // Ensure database connection is properly closed
    if (client) {
      try {
        await client.end();
        console.log("🔌 Database connection closed");
      } catch (closeError) {
        console.error("⚠️  Failed to close database connection:", closeError);
      }
    }
  }
}

// Execute the cleanup function
main();
