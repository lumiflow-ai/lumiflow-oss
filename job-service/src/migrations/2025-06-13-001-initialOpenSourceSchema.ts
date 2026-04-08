import type pg from "pg";

export default {
  name: "2025-06-13-001-initialOpenSourceSchema",
  async run(client: pg.Client) {
    await client.query(`
      CREATE TABLE public.generations (
        "org_id" uuid NOT NULL,
        "generation_id" uuid NOT NULL,
        "event_summary_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL,
        "contents" jsonb DEFAULT NULL,
        PRIMARY KEY (generation_id)
      );
      CREATE INDEX generations_created_at_idx
        ON public.generations
        USING btree (org_id, created_at);

      CREATE TYPE evaluation_queue_job_status AS ENUM (
        'waiting',
        'processing',
        'complete',
        'failed',
        'cancelled'
      );

      CREATE TABLE public.evaluation_queue (
        "created_at" timestamp NOT NULL,
        "updated_at" timestamp NOT NULL,
        "status" evaluation_queue_job_status NOT NULL,
        "priority" integer NOT NULL,
        "generation_id" text NOT NULL,
        "event_summary_id" text,
        "runner_id" text NOT NULL,
        "org_id" text NOT NULL,
        "callback_url" text,
        "inputs" jsonb NOT NULL,
        "kind" text NOT NULL,
        "recipe_run_id" text,
        "attempt_count" integer NOT NULL DEFAULT 0,
        "available_at" timestamp NOT NULL DEFAULT now(),
        "defer_count" integer NOT NULL DEFAULT 0,
        PRIMARY KEY (generation_id)
      );
      CREATE INDEX evaluation_queue_scheduler_waiting_idx
        ON public.evaluation_queue
        USING btree (
          status,
          kind,
          available_at,
          priority,
          created_at,
          org_id
        );
      CREATE INDEX evaluation_queue_processing_stale_idx
        ON public.evaluation_queue
        USING btree (
          status,
          kind,
          updated_at
        );

      CREATE TABLE public.evaluation_queue_fairness_state (
        "resource_pool" text NOT NULL,
        "org_id" text NOT NULL,
        "scope" text NOT NULL,
        "workstream_key" text NOT NULL,
        "last_selected_at" timestamp NOT NULL,
        CONSTRAINT evaluation_queue_fairness_state_scope_check
          CHECK ("scope" IN ('org', 'workstream')),
        CONSTRAINT evaluation_queue_fairness_state_pkey
          PRIMARY KEY ("resource_pool", "org_id", "scope", "workstream_key")
      );
      CREATE INDEX evaluation_queue_fairness_state_selection_idx
        ON public.evaluation_queue_fairness_state
        USING btree (
          "resource_pool",
          "org_id",
          "scope",
          "last_selected_at",
          "workstream_key"
        );
    `);
  },
};
