import type { OrganizationID, UserID } from "@/types";

import { FakeOrganizations } from "@/model/org.internal";
import { normalizeEmail, type PersistedUser, type UserManager } from "@/model/user";

import { OrgIDs, resolveOrganizationIDsForEmail } from "@/user";

const newUser: PersistedUser = {
  id: "newUser",
  email: "newUser@example.com",
  fullName: "New User",
  organizationIDs: [],
  auth: {},
} as const;

const existingUser: PersistedUser = {
  id: "existingUser",
  email: "existingUser@example.com",
  fullName: "Existing User",
  organizationIDs: [FakeOrganizations.org1.id],
  auth: {},
} as const;

const inMemoryUser: PersistedUser = {
  id: "inMemoryUser",
  email: "unit-test@testing.example.com",
  fullName: "In Memory User",
  organizationIDs: [OrgIDs.testData],
  auth: {},
} as const;

const demoMedicalUser: PersistedUser = {
  id: "demoMedicalUser",
  email: "demo.medical.user@example.com",
  fullName: "Demo Medical User",
  organizationIDs: [FakeOrganizations.medical.id],
  auth: {},
} as const;

/**
 * Available PersistedUsers that can be used when creating a `FakeUserManager`.
 */
export const FakeUsers = {
  newUser,
  existingUser,
  inMemoryUser,
  demoMedicalUser,
} as const;

/**
 * In-memory fake implementation of UserManager for testing.
 * Tests can set return values and inspect captured arguments.
 */
export class FakeUserManager implements UserManager {
  users: Map<UserID, PersistedUser> = new Map();
  usersByEmail: Map<UserID, PersistedUser> = new Map();

  async createUser({ user }: { user: PersistedUser }): Promise<PersistedUser> {
    this.users.set(user.id, user);
    this.usersByEmail.set(normalizeEmail(user.email), user);
    return user;
  }

  async fetchUserByID({ userID }: { userID: UserID }): Promise<PersistedUser | null> {
    return this.users.get(userID) ?? null;
  }

  async fetchUserByEmail({ email }: { email: string }): Promise<PersistedUser | null> {
    return this.usersByEmail.get(normalizeEmail(email)) ?? null;
  }

  async fetchAllUsers(): Promise<PersistedUser[]> {
    return Array.from(this.users.values());
  }

  async fetchUsersByOrgAccess({
    allowedOrgIDs,
  }: {
    allowedOrgIDs: OrganizationID[];
    context: { pgClient: unknown; logger: unknown };
  }): Promise<PersistedUser[]> {
    const allowedOrgIDsLower = allowedOrgIDs.map((id) => id.toLowerCase());
    return Array.from(this.users.values()).filter((user) =>
      resolveOrganizationIDsForEmail(user.email, user.organizationIDs).some((id) =>
        allowedOrgIDsLower.includes(id.toLowerCase()),
      ),
    );
  }

  async updateUser({ user }: { user: Partial<PersistedUser> & Pick<PersistedUser, "id"> }): Promise<PersistedUser> {
    const existing = this.users.get(user.id);
    const updated = { ...existing, ...user } as PersistedUser;
    this.users.set(user.id, updated);
    if (user.email) this.usersByEmail.delete(normalizeEmail(user.email));
    this.usersByEmail.set(normalizeEmail(updated.email), updated);
    return updated;
  }
}
