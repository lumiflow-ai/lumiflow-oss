import type { z } from "zod";

import { AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { createOrganizationForUser } from "@/model/orgCreation";

import { CreateOrganizationRequestSchema, CreateOrganizationResponseSchema } from "./definitions";

export const createOrg = new RouteGroup();

createOrg.post(
  null,
  {
    requestSchema: CreateOrganizationRequestSchema,
    responseSchema: CreateOrganizationResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context): Promise<z.infer<typeof CreateOrganizationResponseSchema>> => {
    const organization = await createOrganizationForUser({ orgName: request.name, context });
    return { organization };
  },
);
