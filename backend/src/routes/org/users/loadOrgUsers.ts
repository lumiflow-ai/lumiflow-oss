import { withPGClient } from "@/server/persistence";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { resolveOrganizationIDsForEmail } from "@/user";

import { OrgUsersRequestSchema, OrgUsersResponseSchema } from "./definitions";

export const loadOrgUsers = new RouteGroup();
loadOrgUsers.get(
  null,
  {
    requestSchema: OrgUsersRequestSchema,
    responseSchema: OrgUsersResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (_, context) => {
    const { managers } = context;
    const orgUsers = await withPGClient(context, async (pgContext) => {
      if (!context.user) throw new AuthorizationError();

      const persistedUser = await managers.user.fetchUserByEmail({
        email: context.user.email,
        context: pgContext,
      });
      if (!persistedUser) throw new AuthorizationError();

      const allowedOrgIDs = resolveOrganizationIDsForEmail(persistedUser.email, persistedUser.organizationIDs);

      return await managers.user.fetchUsersByOrgAccess({ allowedOrgIDs, context: pgContext });
    });

    return {
      users: orgUsers.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      })),
    };
  },
);
