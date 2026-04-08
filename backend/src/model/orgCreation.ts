import { randomUUID } from "node:crypto";

import { type Organization, OrganizationTemplate } from "@/types";

import { withIdempotentTransaction, withPGClient } from "@/server/persistence";

import { AuthorizationError } from "@/lib/authorization";
import type { RequestContext } from "@/lib/routeGroup";

import { copyTemplateIntoOrganization } from "@/model/orgTransfer";

const DefaultTemplate = OrganizationTemplate.general;

/**
 * Creates a new organization and adds it to the user's organization list.
 * Copies template data (metrics, recipes, artifacts) into the new org.
 *
 * @param orgName - Name for the new organization
 * @param context - Request context containing user and managers
 * @param fullName - If provided, also updates the user's full name (used during signup)
 * @returns The created organization
 * @throws AuthorizationError if user is not authenticated, email not verified, or user not found
 */
export async function createOrganizationForUser({
  orgName,
  context,
  fullName,
}: {
  orgName: string;
  context: RequestContext;
  fullName?: string;
}): Promise<Organization> {
  const { user, managers } = context;
  if (!user?.isAuthenticated || !user.isEmailVerified) throw new AuthorizationError();

  const organization: Organization = {
    id: randomUUID(),
    name: orgName,
    template: DefaultTemplate,
  };

  return await withPGClient(context, async (context) =>
    withIdempotentTransaction(context, async (context) => {
      const createdOrg = await managers.org.createOrganization({
        organization,
        context,
      });

      const persistedUser = await managers.user.fetchUserByID({
        userID: user.id,
        context,
      });
      if (!persistedUser) throw new AuthorizationError();

      const organizationIDs = new Set(persistedUser.organizationIDs);
      organizationIDs.add(createdOrg.id);

      await managers.user.updateUser({
        user: {
          ...persistedUser,
          ...(fullName !== undefined && { fullName }),
          organizationIDs: Array.from(organizationIDs).sort(),
        },
        context,
      });

      user.organizations.set(createdOrg.id, createdOrg);

      await copyTemplateIntoOrganization({ organization: createdOrg, ...context });

      return createdOrg;
    }),
  );
}
