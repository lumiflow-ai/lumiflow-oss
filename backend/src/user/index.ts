import type { OrganizationID, OrganizationTemplate } from "@/types";

import { CONFIG } from "@/serverInitSetup/config";

const DemoTemplateOrgID = "f858f830-e7c7-4067-a351-5629e1ed80f5" as OrganizationID;

export const TemplateOrgIDs: { [key in OrganizationTemplate]: OrganizationID } = {
  demo: DemoTemplateOrgID,
  general: DemoTemplateOrgID,
};

export const OrgIDs = {
  testData: "4748b6c8-c161-466b-a516-897d67c19c0e" as OrganizationID,

  demo: {
    coding: "9ea3eb56-ef14-4c00-a761-07d173d14a15" as OrganizationID,
    medical: "2ae3bef1-e1f0-4751-8632-679ca5d633d8" as OrganizationID,
  },

  industries: {
    banking: "ccdb7889-d0a4-4802-9116-4bd76e5669b2" as OrganizationID,
    constructionCompliance: "34831f7b-4f87-4e60-87c0-24a12a7106fe" as OrganizationID,
    customerSupport: "352644c7-b421-4937-ae9e-807268bb3db4" as OrganizationID,
    gaming: "e7188205-ab5f-495c-9370-3cd2f3561d44" as OrganizationID,
    maven: "97015baf-ec72-47f6-8f02-b95d11b07712" as OrganizationID,
    telecom: "95de5fb5-0528-4bb8-b12c-333a8d272753" as OrganizationID,
  },

  template: TemplateOrgIDs,
};

/**
 * Well-known organization IDs extracted from the OrgIDs structure.
 *
 * Includes both top-level string IDs and nested object IDs.
 */
export const WellKnownOrgIDs: ReadonlyArray<OrganizationID> = (() => {
  const ids = new Set<OrganizationID>();

  for (const value of Object.values(OrgIDs)) {
    if (typeof value === "string") {
      ids.add(value as OrganizationID);
    } else {
      for (const id of Object.values(value)) {
        ids.add(id as OrganizationID);
      }
    }
  }

  return Array.from(ids);
})();

/**
 * Users with emails in these domains are allowed to access the app and are given access to all orgs in WellKnownOrgIds.
 * Please keep lexicographically organized.
 */
export function domainsWithAdditionalOrgAccess() {
  return new Set(
    (process.env.ADDITIONAL_ORG_ACCESS_DOMAINS ?? CONFIG.ADDITIONAL_ORG_ACCESS_DOMAINS)
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0),
  );
}

function defaultAppAccessAllowList() {
  return (process.env.APP_ACCESS_ALLOW_LIST ?? CONFIG.APP_ACCESS_ALLOW_LIST)
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function extractNormalizedEmailDomain(email: string): string | undefined {
  const normalizedEmail = email.toLowerCase();
  const parts = normalizedEmail.split("@");
  if (parts.length !== 2) return undefined;

  const [localPart, domain] = parts;
  if (!localPart || !domain) return undefined;

  return domain;
}

function matchesEmailAccessRule(email: string, allowedValue: string): boolean {
  const normalizedEmail = email.toLowerCase();
  const normalizedAllowedValue = allowedValue.toLowerCase();

  if (!normalizedAllowedValue.startsWith("@")) return normalizedEmail === normalizedAllowedValue;

  const domain = extractNormalizedEmailDomain(normalizedEmail);
  if (!domain) return false;

  return domain === normalizedAllowedValue.slice(1);
}

/**
 * Gets the complete set of organization IDs a user should have access to.
 * Users whose email domains are included in `domainsWithAdditionalOrgAccess()` get
 * their database orgs plus all well-known orgs.
 */
export function resolveOrganizationIDsForEmail(userEmail: string, dbOrgIDS: OrganizationID[]): OrganizationID[] {
  const domain = extractNormalizedEmailDomain(userEmail);
  const hasAdditionalOrgAccess = domain !== undefined && domainsWithAdditionalOrgAccess().has(domain);
  if (!hasAdditionalOrgAccess) return dbOrgIDS;

  return Array.from(new Set(dbOrgIDS.concat(WellKnownOrgIDs)));
}

/**
 * Determines whether a user email is allowed to access the app in the current deployment.
 * When no allow-list is configured, the app is open to any authenticated user.
 */
export function isEmailAllowedForApp(
  email: string | undefined,
  {
    appAccessAllowList = defaultAppAccessAllowList(),
  }: {
    appAccessAllowList?: ReadonlyArray<string>;
  } = {},
): boolean {
  if (!email) return false;
  if (appAccessAllowList.length === 0) return true;

  return appAccessAllowList.some((allowedValue) => matchesEmailAccessRule(email, allowedValue));
}
