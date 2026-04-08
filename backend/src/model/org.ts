import type pg from "pg";
import type { Logger } from "pino";

import type { Organization, OrganizationID } from "@/types";

/** All org persistence operations must go through the OrgMananger */
export interface OrgManager {
  createOrganization(params: {
    organization: Organization;
    context: { pgClient: pg.ClientBase; logger: Logger };
  }): Promise<Organization>;

  fetchOrganizationByID(params: {
    orgID: OrganizationID;
    context: { pgClient: pg.ClientBase; logger: Logger };
  }): Promise<Organization | null>;

  fetchAllOrganizations(params: { context: { pgClient: pg.ClientBase; logger: Logger } }): Promise<Organization[]>;
}

export const PGOrgManager: OrgManager = {
  async createOrganization({ organization, context }) {
    await context.pgClient.query({
      text: `
        INSERT INTO public.organizations (
          "id",
          "updated_at",
          "organization"
        ) VALUES (
          $1,
          now(),
          $2
        )
        ON CONFLICT ("id") DO UPDATE
          SET
            "updated_at" = excluded."updated_at",
            "organization" = excluded."organization";
      `,
      values: [organization.id, organization],
    });
    return organization;
  },

  async fetchOrganizationByID({ orgID, context }) {
    const result = await context.pgClient.query<{ organization: Organization }>({
      text: `
        SELECT "organization"
          FROM public.organizations
          WHERE "id" = $1
          LIMIT 1;
      `,
      values: [orgID],
    });
    return result.rows.at(0)?.organization ?? null;
  },

  async fetchAllOrganizations({ context }) {
    const result = await context.pgClient.query<{ organization: Organization }>({
      text: `
        SELECT "organization"
          FROM public.organizations
          WHERE organization->>'isDeleted' IS NULL OR organization->>'isDeleted' != 'true'
          ORDER BY "updated_at" DESC;
      `,
    });
    return result.rows.map(({ organization }) => organization);
  },
};
