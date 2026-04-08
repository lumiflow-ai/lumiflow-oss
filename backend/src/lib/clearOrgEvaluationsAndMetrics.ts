/**
 * Shared functionality for clearing evaluations and metrics for organizations
 */

import type pg from "pg";

export interface EvalResultsClearStats {
  metricDefinitions: number;
  recipes: number;
  metrics: number;
  snapshots: number;
}

/**
 * Gets prelim counts for evaluation and metrics data that would be deleted for an organization
 */
export async function getOrgEvalResultsStats(client: pg.Client, orgId: string): Promise<EvalResultsClearStats> {
  const metricDefCount = await client.query(
    `
    SELECT COUNT(*) FROM metric_definitions WHERE org_id = $1
  `,
    [orgId],
  );

  const recipeCount = await client.query(
    `
    SELECT COUNT(*) FROM recipes WHERE org_id = $1
  `,
    [orgId],
  );

  const metricsCount = await client.query(
    `
    SELECT COUNT(*) FROM metrics WHERE org = $1::uuid
  `,
    [orgId],
  );

  const snapshotsWithMetricsCount = await client.query(
    `
    SELECT COUNT(*) FROM artifact_snapshots
    WHERE org_id = $1 AND snapshot ? 'metrics' AND jsonb_array_length(snapshot->'metrics') > 0
  `,
    [orgId],
  );

  return {
    metricDefinitions: Number(metricDefCount.rows[0].count),
    recipes: Number(recipeCount.rows[0].count),
    metrics: Number(metricsCount.rows[0].count),
    snapshots: Number(snapshotsWithMetricsCount.rows[0].count),
  };
}

/**
 * Clears all evaluations and metrics for a specific organization. Transaction is
 * expected to be managed by the caller.
 *
 * This function performs the deletion operations:
 * - Deletes metric definitions
 * - Deletes recipes
 * - Deletes metrics
 * - Clears metrics (eval results) from artifact snapshots
 *
 * @param client - PostgreSQL client (should be in a transaction)
 * @param orgId - Organization ID to clear data for
 * @returns Statistics about deleted records
 */
export async function clearOrgEvalResults(client: pg.Client, orgId: string): Promise<EvalResultsClearStats> {
  // Clear metric definitions for the organization
  const metricDefResult = await client.query(
    `
    DELETE FROM metric_definitions WHERE org_id = $1
  `,
    [orgId],
  );

  // Clear recipes for the organization
  const recipeResult = await client.query(
    `
    DELETE FROM recipes WHERE org_id = $1
  `,
    [orgId],
  );

  // Clear metrics for the organization
  const metricsResult = await client.query(
    `
      DELETE FROM metrics WHERE org = $1::uuid
    `,
    [orgId],
  );

  // Clear evaluation results from artifact snapshots for the organization
  const snapshotResult = await client.query(
    `
    UPDATE artifact_snapshots
    SET snapshot = jsonb_set(snapshot, '{metrics}', '[]'::jsonb)
    WHERE org_id = $1 AND snapshot ? 'metrics'
  `,
    [orgId],
  );

  return {
    metricDefinitions: metricDefResult.rowCount || 0,
    recipes: recipeResult.rowCount || 0,
    metrics: metricsResult.rowCount || 0,
    snapshots: snapshotResult.rowCount || 0,
  };
}
