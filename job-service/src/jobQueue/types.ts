import type { EventSummaryID, GenerationID, OrganizationID, RecipeRunID } from "@/generated/backendTypes";

import type { JobKind } from "./globals";

export type EvaluationQueueJobSQLSchema<T> = {
  created_at: Date;
  updated_at: Date;
  available_at: Date;
  status: "waiting" | "processing" | "complete" | "failed" | "cancelled";
  kind: JobKind;
  priority: number;
  attempt_count: number;
  defer_count: number;
  generation_id: GenerationID;
  org_id: OrganizationID;
  recipe_run_id: RecipeRunID | undefined;
  event_summary_id: EventSummaryID | undefined;
  runner_id: string | undefined;
  callback_url?: string;
  inputs: T;
};

export type NotifyCallbackInputs = {
  body: Record<string, unknown>;
};
