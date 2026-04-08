import type pg from "pg";
import type { Logger } from "pino";

import { withPGClient } from "@/server/persistence";

import { getSchedulerWorkstreamKeySql } from "./fairnessState";
import { selectRunnableJobsFairly } from "./policy";
import type { ResourcePool, SchedulerRunnableJob } from "./types";

const schedulerSelectionOverfetchFactor = 4;

export type SchedulerStore = {
  loadRunnableJobs(args: {
    pgPool: pg.Pool;
    logger: Logger;
    kinds: readonly string[];
    limit: number;
    abandonedIntervalS: number;
    resourcePool: ResourcePool;
  }): Promise<SchedulerRunnableJob[]>;
};

export const schedulerStore: SchedulerStore = {
  async loadRunnableJobs({ pgPool, logger, kinds, limit, abandonedIntervalS, resourcePool }) {
    return await withPGClient({ pgPool, logger }, async ({ pgClient }) => {
      const candidateWorkstreamLimit = Math.max(limit * schedulerSelectionOverfetchFactor, limit);
      const candidateJobLimit = candidateWorkstreamLimit * limit;
      const queryResults = await pgClient.query<{
        generation_id: string;
        kind: SchedulerRunnableJob["kind"];
        org_id: string;
        workstream_key: string;
        priority: number;
        created_at: Date;
        org_last_selected_at: Date | null;
        workstream_last_selected_at: Date | null;
      }>({
        text: `
          WITH runnable_jobs AS (
            SELECT
              "generation_id",
              "kind",
              "org_id",
              "priority",
              "created_at",
              ${getSchedulerWorkstreamKeySql()} AS "workstream_key"
            FROM public.evaluation_queue
            WHERE
              "kind" = ANY($1)
              AND (
                (
                  "status" = 'waiting'
                  AND "available_at" <= now()
                )
                OR (
                  "status" = 'processing'
                  AND "updated_at" < (now() - ($2 * INTERVAL '1 second'))
                )
              )
          ),
          ranked_workstream_jobs AS (
            SELECT
              "generation_id",
              "kind",
              "org_id",
              "priority",
              "created_at",
              "workstream_key",
              row_number() OVER (
                PARTITION BY "org_id", "workstream_key"
                ORDER BY "priority" ASC, "created_at" ASC, "generation_id" ASC
              ) AS "workstream_rank"
            FROM runnable_jobs
          ),
          workstream_heads AS (
            SELECT
              ranked_workstream_jobs."generation_id",
              ranked_workstream_jobs."kind",
              ranked_workstream_jobs."org_id",
              ranked_workstream_jobs."priority",
              ranked_workstream_jobs."created_at",
              ranked_workstream_jobs."workstream_key",
              org_fairness_state."last_selected_at" AS "org_last_selected_at",
              workstream_fairness_state."last_selected_at" AS "workstream_last_selected_at"
            FROM ranked_workstream_jobs
            LEFT JOIN public.evaluation_queue_fairness_state AS org_fairness_state
              ON org_fairness_state."resource_pool" = $3
              AND org_fairness_state."org_id" = ranked_workstream_jobs."org_id"
              AND org_fairness_state."scope" = 'org'
              AND org_fairness_state."workstream_key" = ranked_workstream_jobs."org_id"
            LEFT JOIN public.evaluation_queue_fairness_state AS workstream_fairness_state
              ON workstream_fairness_state."resource_pool" = $3
              AND workstream_fairness_state."org_id" = ranked_workstream_jobs."org_id"
              AND workstream_fairness_state."scope" = 'workstream'
              AND workstream_fairness_state."workstream_key" = ranked_workstream_jobs."workstream_key"
            WHERE ranked_workstream_jobs."workstream_rank" = 1
          ),
          candidate_workstreams AS (
            SELECT
              "org_id",
              "workstream_key",
              "org_last_selected_at",
              "workstream_last_selected_at",
              row_number() OVER (
                ORDER BY
                  "org_last_selected_at" ASC NULLS FIRST,
                  "workstream_last_selected_at" ASC NULLS FIRST,
                  "priority" ASC,
                  "created_at" ASC,
                  "generation_id" ASC,
                  "org_id" ASC,
                  "workstream_key" ASC
              ) AS "workstream_order"
            FROM workstream_heads
          )
          SELECT
            ranked_workstream_jobs."generation_id",
            ranked_workstream_jobs."kind",
            ranked_workstream_jobs."org_id",
            ranked_workstream_jobs."workstream_key",
            ranked_workstream_jobs."priority",
            ranked_workstream_jobs."created_at",
            candidate_workstreams."org_last_selected_at",
            candidate_workstreams."workstream_last_selected_at"
          FROM ranked_workstream_jobs
          INNER JOIN candidate_workstreams
            ON candidate_workstreams."org_id" = ranked_workstream_jobs."org_id"
            AND candidate_workstreams."workstream_key" = ranked_workstream_jobs."workstream_key"
          WHERE
            candidate_workstreams."workstream_order" <= $4
            AND ranked_workstream_jobs."workstream_rank" <= $5
          ORDER BY
            candidate_workstreams."workstream_order" ASC,
            ranked_workstream_jobs."workstream_rank" ASC,
            ranked_workstream_jobs."priority" ASC,
            ranked_workstream_jobs."created_at" ASC,
            ranked_workstream_jobs."generation_id" ASC
          LIMIT $6;
        `,
        values: [kinds, abandonedIntervalS, resourcePool, candidateWorkstreamLimit, limit, candidateJobLimit],
      });

      const runnableJobs = queryResults.rows.map((row) => ({
        generationID: row.generation_id,
        kind: row.kind,
        orgID: row.org_id,
        workstreamKey: row.workstream_key,
        priority: row.priority,
        createdAt: row.created_at,
        orgLastSelectedAt: row.org_last_selected_at ?? undefined,
        workstreamLastSelectedAt: row.workstream_last_selected_at ?? undefined,
      }));

      return selectRunnableJobsFairly({ jobs: runnableJobs, limit });
    });
  },
};
