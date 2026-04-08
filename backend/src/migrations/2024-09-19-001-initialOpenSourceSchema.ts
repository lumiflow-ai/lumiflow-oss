import type pg from "pg";

import { OrgIDs } from "@/user";

const organizations = [
  { id: OrgIDs.demo.coding, organization: { id: OrgIDs.demo.coding, name: "Coding (Demo)" } },
  {
    id: OrgIDs.demo.medical,
    organization: { id: OrgIDs.demo.medical, name: "Medical (Demo)", isDeleted: true },
  },
  { id: OrgIDs.testData, organization: { id: OrgIDs.testData, name: "Test Data" } },
  {
    id: OrgIDs.template.demo,
    organization: { id: OrgIDs.template.demo, name: "Cold Start (Template)", template: "demo" },
  },
  { id: OrgIDs.industries.maven, organization: { id: OrgIDs.industries.maven, name: "Maven" } },
  { id: OrgIDs.industries.banking, organization: { id: OrgIDs.industries.banking, name: "Banking" } },
  { id: OrgIDs.industries.telecom, organization: { id: OrgIDs.industries.telecom, name: "Telecom" } },
  { id: OrgIDs.industries.gaming, organization: { id: OrgIDs.industries.gaming, name: "Gaming" } },
  {
    id: OrgIDs.industries.constructionCompliance,
    organization: { id: OrgIDs.industries.constructionCompliance, name: "Construction Compliance" },
  },
  {
    id: OrgIDs.industries.customerSupport,
    organization: { id: OrgIDs.industries.customerSupport, name: "Customer Support" },
  },
];

export default {
  name: "2024-09-19-001-initialOpenSourceSchema",
  async run(client: pg.Client) {
    await client.query(`
      CREATE TABLE public.metrics (
        "org" uuid NOT NULL,
        "id_tuple" text NOT NULL,
        "created_at" timestamp NOT NULL,
        "contents" jsonb DEFAULT NULL,
        PRIMARY KEY (org, id_tuple)
      );
      CREATE INDEX metrics_created_at_idx ON public.metrics USING btree (org, created_at);

      CREATE TABLE public.artifact_snapshots (
        "org_id" text NOT NULL,
        "artifact_path" text[][] NOT NULL,
        "event_summary_id" text NOT NULL,
        "timestamp" timestamp NOT NULL,
        "updated_at" timestamp NOT NULL,
        "snapshot" jsonb NOT NULL,
        PRIMARY KEY (org_id, artifact_path, event_summary_id)
      );
      CREATE INDEX artifact_snapshots_timestamp_idx ON public.artifact_snapshots USING btree (org_id, timestamp);
      CREATE INDEX artifact_snapshots_updated_at_idx ON public.artifact_snapshots USING btree (org_id, updated_at);

      CREATE TABLE public.metric_definitions (
        "org_id" text NOT NULL,
        "metric_id" text NOT NULL,
        "updated_at" timestamp NOT NULL,
        "definition" jsonb NOT NULL,
        PRIMARY KEY (org_id, metric_id)
      );
      CREATE INDEX metric_definitions_updated_at_idx
        ON public.metric_definitions
        USING btree (org_id, updated_at);

      CREATE TABLE public.recipes (
        "org_id" text NOT NULL,
        "id" text NOT NULL,
        "updated_at" timestamp NOT NULL,
        "recipe" jsonb NOT NULL,
        PRIMARY KEY (org_id, id)
      );
      CREATE INDEX recipes_updated_at_idx ON public.recipes USING btree (org_id, updated_at);

      CREATE TABLE public.organizations (
        "id" text NOT NULL,
        "updated_at" timestamp NOT NULL,
        "organization" jsonb NOT NULL,
        PRIMARY KEY (id)
      );

      CREATE TABLE public.users (
        "id" text NOT NULL,
        "email" text NOT NULL,
        "updated_at" timestamp NOT NULL,
        "user" jsonb NOT NULL,
        PRIMARY KEY (id)
      );
      CREATE INDEX users_email_idx ON public.users USING btree (email);
      CREATE INDEX users_orgids_gin_idx ON public.users USING gin (("user"->'organizationIDs'));

      CREATE TABLE public.evaluation_runs (
        "org_id" text NOT NULL,
        "evaluation_run_id" text NOT NULL,
        "updated_at" timestamp NOT NULL,
        "run" jsonb NOT NULL,
        PRIMARY KEY (org_id, evaluation_run_id)
      );

      CREATE TABLE public."auth_users" (
        "id" text NOT NULL,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "emailVerified" boolean NOT NULL,
        "image" text,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY ("id"),
        UNIQUE ("email")
      );

      CREATE TABLE public."auth_sessions" (
        "id" text NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "token" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL,
        "ipAddress" text,
        "userAgent" text,
        "userId" text NOT NULL REFERENCES public."auth_users" ("id") ON DELETE CASCADE,
        PRIMARY KEY ("id"),
        UNIQUE ("token")
      );

      CREATE TABLE public."auth_accounts" (
        "id" text NOT NULL,
        "accountId" text NOT NULL,
        "providerId" text NOT NULL,
        "userId" text NOT NULL REFERENCES public."auth_users" ("id") ON DELETE CASCADE,
        "accessToken" text,
        "refreshToken" text,
        "idToken" text,
        "accessTokenExpiresAt" timestamptz,
        "refreshTokenExpiresAt" timestamptz,
        "scope" text,
        "password" text,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL,
        PRIMARY KEY ("id")
      );

      CREATE TABLE public."auth_verifications" (
        "id" text NOT NULL,
        "identifier" text NOT NULL,
        "value" text NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY ("id")
      );

      CREATE INDEX auth_sessions_userid_idx ON public."auth_sessions" ("userId");
      CREATE INDEX auth_accounts_userid_idx ON public."auth_accounts" ("userId");
      CREATE INDEX auth_verifications_identifier_idx ON public."auth_verifications" ("identifier");

      DO $$
      BEGIN
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'rds_iam')
           AND NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'backup_user') THEN
          CREATE USER backup_user WITH LOGIN;
          GRANT rds_iam TO backup_user;
        END IF;

        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'backup_user') THEN
          GRANT USAGE ON SCHEMA public TO backup_user;
          GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;
          ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_user;
        END IF;
      END
      $$;
    `);

    for (const { id, organization } of organizations) {
      await client.query(
        `
          INSERT INTO public.organizations ("id", "updated_at", "organization")
          VALUES ($1, now(), $2);
        `,
        [id, organization],
      );
    }

    const testUser = {
      id: "unit-test-user",
      email: "unit-test@testing.example.com",
      fullName: "",
      organizationIDs: [OrgIDs.testData],
      auth: {},
    };

    await client.query(
      `
        INSERT INTO public.users ("id", "email", "updated_at", "user")
        VALUES ($1, $2, now(), $3);
      `,
      [testUser.id, testUser.email, testUser],
    );
  },
};
