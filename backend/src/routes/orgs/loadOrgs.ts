import { z } from "zod";

import { withIdempotentTransaction, withPGClient } from "@/server/persistence";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { resolveOrganizationIDsForEmail } from "@/user";

import { OrganizationsResponseSchema } from "./definitions";

export const loadOrgs = new RouteGroup();
loadOrgs.get(
  null,
  { requestSchema: z.void(), responseSchema: OrganizationsResponseSchema, auth: AuthorizationRequirement.session },
  async (_, context) => {
    const { user, managers } = context;
    if (!user) throw new AuthorizationError();

    return await withPGClient(context, async (context) => {
      return await withIdempotentTransaction(context, async (context) => {
        const persistedUser = await managers.user.fetchUserByEmail({ email: user.email, context });
        if (!persistedUser) throw new AuthorizationError();

        /// Load the organizations for the user based on domain logic
        const orgIDsToLoad = resolveOrganizationIDsForEmail(persistedUser.email, persistedUser.organizationIDs);

        const organizations = [];
        for (const orgID of orgIDsToLoad) {
          const org = await managers.org.fetchOrganizationByID({ orgID, context });
          if (org && !org.isDeleted) organizations.push(org);
        }

        return {
          orgs: organizations,
        };
      });
    });
  },
);
