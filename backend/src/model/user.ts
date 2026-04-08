import type pg from "pg";
import type { Logger } from "pino";

import type { OrganizationID, UserID } from "@/types";

import { isInTransaction, withIdempotentTransaction } from "@/server/persistence";

import { updateOptional } from "@/lib/validation";

import { domainsWithAdditionalOrgAccess, WellKnownOrgIDs } from "@/user";

export type AuthSessionInfo = {
  user_id?: string;
  name?: string;
  picture?: string;
  blocked?: boolean;
  email_verified?: boolean;
  [key: string]: unknown;
};

export type PersistedUser = {
  id: UserID;
  email: string;
  fullName: string;
  auth?: AuthSessionInfo;
  /** Legacy key kept for backwards compatibility with historical data/migrations. */
  auth0?: AuthSessionInfo;
  organizationIDs: OrganizationID[];
};

export interface UserManager {
  createUser(params: {
    user: PersistedUser;
    context: { pgClient: pg.ClientBase; logger: Logger };
  }): Promise<PersistedUser>;

  fetchUserByID(params: {
    userID: UserID;
    context: { pgClient: pg.ClientBase; logger: Logger };
  }): Promise<PersistedUser | null>;

  fetchUserByEmail(params: {
    email: string;
    context: { pgClient: pg.ClientBase; logger: Logger };
  }): Promise<PersistedUser | null>;

  fetchAllUsers(params: { context: { pgClient: pg.ClientBase; logger: Logger } }): Promise<PersistedUser[]>;

  fetchUsersByOrgAccess(params: {
    allowedOrgIDs: OrganizationID[];
    context: { pgClient: pg.ClientBase; logger: Logger };
  }): Promise<PersistedUser[]>;

  updateUser(params: {
    user: Partial<PersistedUser> & Pick<PersistedUser, "id">;
    context: { pgClient: pg.ClientBase; logger: Logger };
  }): Promise<PersistedUser>;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const PGUserManager: UserManager = {
  async createUser({ user, context }): Promise<PersistedUser> {
    await context.pgClient.query({
      text: `
        INSERT INTO public.users (
          "id",
          "email",
          "updated_at",
          "user"
        ) VALUES (
          $1,
          $2,
          now(),
          $3
        );
      `,
      values: [user.id, normalizeEmail(user.email), user],
    });
    return user;
  },

  async fetchUserByID({ userID, context }): Promise<PersistedUser | null> {
    const result = await context.pgClient.query<{ user: PersistedUser | null }>({
      text: `
        SELECT *
          FROM public.users
          WHERE "id" = $1
          LIMIT 1;
      `,
      values: [userID],
    });
    return result.rows.at(0)?.user ?? null;
  },

  async fetchUserByEmail({ email, context }): Promise<PersistedUser | null> {
    const result = await context.pgClient.query<{ user: PersistedUser }>({
      text: `
        SELECT *
          FROM public.users
          WHERE "email" = $1
          LIMIT 1;
      `,
      values: [normalizeEmail(email)],
    });
    return result.rows.at(0)?.user ?? null;
  },

  async fetchAllUsers({ context }): Promise<PersistedUser[]> {
    const result = await context.pgClient.query<{
      id: string;
      email: string;
      user: PersistedUser | null;
    }>({
      text: `
        SELECT "id", "email", "user"
          FROM public.users
          ORDER BY "updated_at" DESC;
      `,
    });
    return result.rows.map((row) => row.user ?? null).filter((user): user is PersistedUser => user !== null);
  },

  async fetchUsersByOrgAccess({ allowedOrgIDs, context }): Promise<PersistedUser[]> {
    const normalizedAllowedOrgIDs = allowedOrgIDs.map((id) => id.toLowerCase());
    const normalizedWellKnownOrgIDs = WellKnownOrgIDs.map((id) => id.toLowerCase());
    const hasWellKnownOverlap = normalizedWellKnownOrgIDs.some((id) => normalizedAllowedOrgIDs.includes(id));

    const result = await context.pgClient.query<{
      user: PersistedUser | null;
    }>({
      text: `
        SELECT "user"
          FROM public.users
          WHERE
            ("user"->'organizationIDs') ?| $1
            OR (
              lower(split_part("email", '@', 2)) = ANY($2)
              AND $3 = true
            )
          ORDER BY "updated_at" DESC;
      `,
      values: [normalizedAllowedOrgIDs, Array.from(domainsWithAdditionalOrgAccess()), hasWellKnownOverlap],
    });

    return result.rows.map((row) => row.user ?? null).filter((user): user is PersistedUser => user !== null);
  },

  /**
   * Updates a user record with partial field updates.
   *
   * Transaction handling: Automatically detects whether it's called within an existing
   * transaction (e.g., migrations) or standalone. When called outside a transaction,
   * wraps the update in an idempotent transaction with retry logic for serialization failures.
   *
   * @throws {Error} If the user does not exist.
   */
  async updateUser({
    user,
    context,
  }: {
    user: PersistedUser;
    context: { pgClient: pg.ClientBase; logger: Logger };
  }): Promise<PersistedUser> {
    const performUpdate = async ({ pgClient, logger }: { pgClient: pg.ClientBase; logger: Logger }) => {
      const existingResults = await pgClient.query<{
        email: string;
        user: PersistedUser | null;
      }>({
        text: `
          SELECT "email", "user"
            FROM public.users
            WHERE "id" = $1
            FOR UPDATE;
        `,
        values: [user.id],
      });

      const existingUser = existingResults.rows.at(0)?.user;
      if (!existingUser) {
        logger.warn({ userID: user.id }, "Attempted to update a user that does not exist.");
        throw new Error(`User "${user.id}" does not exist.`);
      }

      logger.info("Updating user.");

      updateOptional(existingUser, "email", user);
      updateOptional(existingUser, "fullName", user);
      updateOptional(existingUser, "auth", user);
      updateOptional(existingUser, "organizationIDs", user);

      const result = await pgClient.query({
        text: `
          UPDATE public.users
            SET
              "email" = $2,
              "updated_at" = now(),
              "user" = $3
            WHERE "id" = $1
            RETURNING "user";
        `,
        values: [existingUser.id, normalizeEmail(existingUser.email), existingUser],
      });

      return result.rows.at(0)?.user ?? existingUser;
    };

    // Check if already in a transaction (e.g., called from a migration)
    const inTransaction = await isInTransaction(context.pgClient);

    if (inTransaction) {
      // Already in transaction - execute directly without managing transaction
      return await performUpdate(context);
    }

    // Not in transaction - wrap in idempotent transaction with retry logic
    return await withIdempotentTransaction(context, performUpdate);
  },
};
