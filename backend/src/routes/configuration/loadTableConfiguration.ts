import type { OrganizationID, TableDescriptor } from "@/types";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { TableConfigurationRequestSchema, TableConfigurationResponseSchema } from "./definitions";

// "root" - the root list, "list*": any list, "detail*": any detail, "list-<kind>"/"detail-<kind>": specific kind.
export const configurationMap = new Map<OrganizationID, Map<string, TableDescriptor>>();

export const loadTableConfiguration = new RouteGroup();
loadTableConfiguration.get(
  "table",
  {
    requestSchema: TableConfigurationRequestSchema,
    responseSchema: TableConfigurationResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context) => {
    if (!context.user?.organizations.has(request.orgID.toLowerCase())) {
      throw new AuthorizationError();
    }
    const configurations = configurationMap.get(request.orgID.toLowerCase());
    return {
      table:
        configurations?.get(request.kind ? `${request.context}-${request.kind}` : "root") ??
        configurations?.get(`${request.context}*`) ??
        null,
    };
  },
);
