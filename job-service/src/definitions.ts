import { installOpenAPIExtensions } from "@/server/zodExtensions";

installOpenAPIExtensions();

export * from "@/routes/definitions";

/** Placeholder for fields backfilled before their tracking was added. */
export const BACKFILL_PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000" as const;
