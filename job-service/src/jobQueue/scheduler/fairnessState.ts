import type pg from "pg";

import { type JobKind, JobKinds } from "@/jobQueue/globals";
import type { EvaluationQueueJobSQLSchema } from "@/jobQueue/types";

import { getResourcePoolForKind } from "./resourcePools";

export const FairnessStateScopes = {
  org: "org",
  workstream: "workstream",
} as const;

export type FairnessStateScope = (typeof FairnessStateScopes)[keyof typeof FairnessStateScopes];

function getInputValueAsString(inputs: unknown, key: string) {
  if (!inputs || typeof inputs !== "object") return undefined;

  const value = (inputs as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getSchedulerWorkstreamKeys({
  kind,
  generation_id,
  recipe_run_id,
  inputs,
}: Pick<EvaluationQueueJobSQLSchema<unknown>, "kind" | "generation_id" | "recipe_run_id" | "inputs">) {
  switch (kind) {
    case JobKinds.evaluateRecipeStep:
      return {
        selectionKey: getInputValueAsString(inputs, "evaluationGroupID") ?? recipe_run_id ?? generation_id,
        fairnessStateKey: getInputValueAsString(inputs, "evaluationGroupID") ?? recipe_run_id,
      };
    case JobKinds.scheduleRecipeEvaluation:
      return {
        selectionKey: recipe_run_id ?? generation_id,
        fairnessStateKey: recipe_run_id,
      };
    case JobKinds.notifyCallback:
      return {
        selectionKey: generation_id,
        fairnessStateKey: undefined,
      };
  }
}

export function getSchedulerWorkstreamKey(
  jobRecord: Pick<EvaluationQueueJobSQLSchema<unknown>, "kind" | "generation_id" | "recipe_run_id" | "inputs">,
) {
  return getSchedulerWorkstreamKeys(jobRecord).selectionKey;
}

export function getSchedulerFairnessStateWorkstreamKey(
  jobRecord: Pick<EvaluationQueueJobSQLSchema<unknown>, "kind" | "generation_id" | "recipe_run_id" | "inputs">,
) {
  return getSchedulerWorkstreamKeys(jobRecord).fairnessStateKey;
}

export function getSchedulerWorkstreamKeySql(kindColumnName = `"kind"`) {
  return `
    CASE
      WHEN ${kindColumnName} = '${JobKinds.evaluateRecipeStep}'
        THEN COALESCE("inputs"->>'evaluationGroupID', "recipe_run_id"::text, "generation_id"::text)
      WHEN ${kindColumnName} = '${JobKinds.scheduleRecipeEvaluation}'
        THEN COALESCE("recipe_run_id"::text, "generation_id"::text)
      ELSE "generation_id"::text
    END
  `;
}

export async function recordJobFairnessSelection({
  pgClient,
  jobRecord,
}: {
  pgClient: Pick<pg.ClientBase, "query">;
  jobRecord: Pick<
    EvaluationQueueJobSQLSchema<unknown>,
    "generation_id" | "inputs" | "kind" | "org_id" | "recipe_run_id"
  >;
}) {
  const resourcePool = getResourcePoolForKind(jobRecord.kind as JobKind);
  const fairnessStateWorkstreamKey = getSchedulerFairnessStateWorkstreamKey(jobRecord);
  const fairnessStateRows = [
    [resourcePool, jobRecord.org_id, FairnessStateScopes.org, jobRecord.org_id],
    ...(fairnessStateWorkstreamKey
      ? [[resourcePool, jobRecord.org_id, FairnessStateScopes.workstream, fairnessStateWorkstreamKey]]
      : []),
  ];
  const values = fairnessStateRows.flat();
  const rowValuePlaceholders = fairnessStateRows
    .map((_, index) => {
      const parameterOffset = index * 4;
      return `($${parameterOffset + 1}, $${parameterOffset + 2}, $${parameterOffset + 3}, $${parameterOffset + 4})`;
    })
    .join(",\n        ");

  await pgClient.query({
    text: `
      WITH selection_time AS (
        SELECT clock_timestamp() AS "selected_at"
      )
      INSERT INTO public.evaluation_queue_fairness_state (
        "resource_pool",
        "org_id",
        "scope",
        "workstream_key",
        "last_selected_at"
      )
      SELECT
        fairness_rows."resource_pool",
        fairness_rows."org_id",
        fairness_rows."scope",
        fairness_rows."workstream_key",
        selection_time."selected_at"
      FROM selection_time
      CROSS JOIN (
        VALUES
          ${rowValuePlaceholders}
      ) AS fairness_rows("resource_pool", "org_id", "scope", "workstream_key")
      ON CONFLICT ("resource_pool", "org_id", "scope", "workstream_key")
      DO UPDATE SET
        "last_selected_at" = EXCLUDED."last_selected_at";
    `,
    values,
  });
}
