import type pg from "pg";
import type { Logger } from "pino";

import type { EvaluationModelParameters, OrganizationID } from "@/types";

export type PersistedEvaluationRun = {
  modelID?: string;
  modelParameters?: EvaluationModelParameters;
  evaluationGroupIDs?: string[];
  cancelledEvaluationGroupIDs?: string[];
  [key: string]: unknown;
};

export interface PGEvaluationRunManager {
  persistEvaluationRuns(params: {
    orgID: OrganizationID;
    runs: { evaluationRunID: string; run: PersistedEvaluationRun }[];
    context: { pgClient: pg.ClientBase; logger: Logger };
  }): Promise<void>;
}

export const PGEvaluationRunManager: PGEvaluationRunManager = {
  async persistEvaluationRuns({ orgID, runs, context }) {
    if (runs.length === 0) return;

    const values: unknown[] = [];
    const tuples: string[] = [];

    for (const [index, row] of runs.entries()) {
      const base = index * 3;
      tuples.push(`($${base + 1}, $${base + 2}, now(), $${base + 3})`);
      values.push(orgID, row.evaluationRunID, row.run);
    }

    await context.pgClient.query({
      text: `
        INSERT INTO public.evaluation_runs (
          "org_id",
          "evaluation_run_id",
          "updated_at",
          "run"
        ) VALUES
          ${tuples.join(",\n          ")}
        ON CONFLICT ("org_id", "evaluation_run_id") DO UPDATE
          SET
            "updated_at" = excluded."updated_at",
            "run" = excluded."run";
      `,
      values,
    });
  },
};
