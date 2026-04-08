import { z } from "zod";

import { installAPIExtensions } from "@/lib/apiGeneration";

installAPIExtensions();

// MARK: - Identifiers

export const UserIDSchema = z.string().api("UserID");

// MARK: - User

export const UserSchema = z
  .object({
    id: UserIDSchema,
    email: z.string(),
    fullName: z.string(),
  })
  .api("User");

// MARK: - HTTP

export const AccountResponseSchema = z
  .object({
    user: UserSchema,
    isEmailVerified: z.boolean(),
  })
  .api("AccountResponse");
