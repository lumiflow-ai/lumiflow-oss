import { z } from "zod";

import { installAPIExtensions } from "@/lib/apiGeneration";

import { OrganizationSchema } from "@/routes/orgs/definitions";

installAPIExtensions();

// MARK: - HTTP

export const SignupRequestSchema = z
  .object({
    org: z.object({
      name: z.string().min(1),
    }),
    user: z.object({
      fullName: z.string().min(1),
    }),
  })
  .api("SignupRequest");

export const SignupResponseSchema = z
  .object({
    organization: OrganizationSchema,
  })
  .api("SignupResponse");
