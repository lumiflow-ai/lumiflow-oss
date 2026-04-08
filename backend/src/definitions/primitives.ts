import { z } from "zod";

import { installAPIExtensions } from "@/lib/apiGeneration";

installAPIExtensions();

// MARK: - Primitives

export const URLSchema = z.string().url().api("URL");

export const UUIDSchema = z.string().uuid().api("UUID");

export const ISO8601PreciseTimestampSchema = z
  .union([z.string().datetime({ precision: 3 }), z.string().datetime({ precision: 6 })])
  .api("ISO8601PreciseTimestamp");

export const PrimitiveValueSchema = z.union([z.boolean(), z.string(), z.number(), z.null()]).api("PrimitiveValue");

export const EvaluationGroupIDSchema = UUIDSchema.api("EvaluationGroupID");

/** Placeholder for fields backfilled before their tracking was added. */
export const BACKFILL_PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000" as const;
