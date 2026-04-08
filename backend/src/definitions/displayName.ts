import { z } from "zod";

import { installAPIExtensions } from "@/lib/apiGeneration";

installAPIExtensions();

// MARK: - Plurality Class

export const PluralityClassScheme = z
  .enum(["zero", "one", "two", "few", "many", "other", "evaluate"])
  .api("PluralityClass");

// MARK: - Display Name

export const DisplayNameSchema = z
  .object({
    zero: z.string().optional(),
    one: z.string(),
    two: z.string().optional(),
    few: z.string().optional(),
    many: z.string().optional(),
    other: z.string(),
    evaluate: z.string().optional(),
  })
  .api("DisplayName");
