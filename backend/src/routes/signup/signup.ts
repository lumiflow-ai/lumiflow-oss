import type { z } from "zod";

import { AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { createOrganizationForUser } from "@/model/orgCreation";

import { SignupRequestSchema, SignupResponseSchema } from "./definitions";

export const signup = new RouteGroup();

signup.post(
  null,
  {
    requestSchema: SignupRequestSchema,
    responseSchema: SignupResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context): Promise<z.infer<typeof SignupResponseSchema>> => {
    const organization = await createOrganizationForUser({
      orgName: request.org.name,
      context,
      fullName: request.user.fullName,
    });
    return { organization };
  },
);
