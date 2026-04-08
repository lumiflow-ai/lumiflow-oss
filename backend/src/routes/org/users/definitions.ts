import { z } from "zod";

import { installAPIExtensions } from "@/lib/apiGeneration";

import { UserSchema } from "@/routes/account/definitions";
import { OrganizationIDSchema } from "@/routes/orgs/definitions";

installAPIExtensions();

export const OrgUsersRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
  })
  .api("OrgUsersRequest");

export const OrgUsersResponseSchema = z
  .object({
    users: z.array(UserSchema),
  })
  .api("OrgUsersResponse");
