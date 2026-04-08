import { useMemo } from "react";

import type { Organization } from "@/generated/serverTypes";

/*
 * Generate a slug suffix for the specified organization.
 *
 * This lowercases the org name, strips non alpha-numeric characters, and replaces spaces with hyphens.
 */
export function nameSlugForOrganization(organization: Organization): string {
  return `-${organization.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\-0-9a-z-]/g, "")}`;
}

/*
 * Generate a unique org slug based off the smallest unique ID (of the ones a user has access to), and the slug-ified name of the org. This ensures some resilience as the org name could change, while the short ID will likely still work for members of the same teams.
 *
 */
export function generateOrganizationSlug({
  org,
  organizations,
}: {
  org: Organization | undefined;
  organizations: Organization[];
}): string | null {
  if (!org) return null;
  const slug = nameSlugForOrganization(org);

  /// Find the smallest ID by iteratively growing it one character at a time until there is only a single match.
  const completeID = org.id.toLowerCase();
  let allCandidates = organizations;
  for (let index = 0; index < completeID.length; index++) {
    const prefix = completeID.slice(0, index + 1);
    const remainingCandidates = allCandidates.filter((organization) =>
      organization.id.toLowerCase().startsWith(prefix),
    );
    if (remainingCandidates.length === 1) {
      return `${prefix}${slug}`;
    }
    allCandidates = remainingCandidates;
  }
  return `${completeID}${slug}`;
}

/*
 * Generate a unique org slug based off the smallest unique ID (of the ones a user has access to), and the slug-ified name of the org. This ensures some resilience as the org name could change, while the short ID will likely still work for members of the same teams.
 *
 */
export function useOrganizationSlug({
  org,
  organizations,
}: {
  org: Organization | undefined;
  organizations: Organization[];
}): string | null {
  return useMemo(() => generateOrganizationSlug({ org, organizations }), [org, organizations]);
}
