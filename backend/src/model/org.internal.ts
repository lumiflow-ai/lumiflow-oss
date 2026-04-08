import { type Organization, type OrganizationID, OrganizationTemplate } from "@/types";

import type { OrgManager } from "@/model/org";

const org1: Organization = { id: "11111111-1111-1111-1111-111111111111", name: "Org 1" };
const org2: Organization = { id: "22222222-2222-2222-2222-222222222222", name: "Org 2" };
const medical: Organization = {
  id: "00112233-4455-6677-8899-aabbccddeeff",
  name: "Medical",
  template: OrganizationTemplate.demo,
};

/**
 * Available Organizations that can be used when creating a `FakeOrgManager`.
 */
export const FakeOrganizations = {
  org1,
  org2,
  medical,
};

/**
 * In-memory fake implementation of OrgManager for testing.
 * Maintains state across calls within a test.
 */
export class FakeOrgManager implements OrgManager {
  organizations: Map<OrganizationID, Organization> = new Map();

  async createOrganization({ organization }: { organization: Organization }): Promise<Organization> {
    this.organizations.set(organization.id, organization);
    return organization;
  }

  async fetchOrganizationByID({ orgID }: { orgID: OrganizationID }): Promise<Organization | null> {
    return this.organizations.get(orgID) ?? null;
  }

  async fetchAllOrganizations(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }
}
