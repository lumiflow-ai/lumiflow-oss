import type pg from "pg";

/** The base expected structure of a migration. */
interface Migration {
  name: string;
  run: (client: pg.Client) => Promise<void>;
}

/** Add migrations in order to this list. */
export const runList: Promise<{ default: Migration }>[] = [import("./2024-09-19-001-initialOpenSourceSchema")];
