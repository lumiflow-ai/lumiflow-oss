"use client";

import { use, useContext, useEffect } from "react";

import { nameSlugForOrganization } from "@/model/organizations";

import { OrganizationContext } from "@/components/contexts/OrganizationContext";

export default function ArtifactsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgID: string }>;
}) {
  const { orgID } = use(params);

  const { currentOrganizationState, organizations } = useContext(OrganizationContext);

  useEffect(() => {
    const proposedOrgID = decodeURIComponent(orgID).toLowerCase();

    /// Search based on the org name and id first.
    const orgCandidates = organizations.filter((organization) => {
      const slug = nameSlugForOrganization(organization);
      if (proposedOrgID.endsWith(slug)) {
        const remainingID = proposedOrgID.slice(0, proposedOrgID.length - slug.length);
        return organization.id.toLowerCase().startsWith(remainingID);
      }
      return false;
    });
    if (orgCandidates.length) {
      /// This should result in a single perfect match assuming the org name didn't change, but may have multiple matches if and only if multiple orgs share a name and have very similar ID prefixes, but were shared by someone with access to only one. In that case, we just use the first match.
      currentOrganizationState.wrappedValue = orgCandidates[0];
      return;
    }

    /// We didn't find any candidates, so we are searching based on ID only until the first difference.
    let allCandidates = [...organizations];
    for (let index = 0; index < proposedOrgID.length; index++) {
      const prefix = proposedOrgID.slice(0, index + 1);
      const remainingCandidates = allCandidates.filter((organization) =>
        organization.id.toLowerCase().startsWith(prefix),
      );
      if (remainingCandidates.length === 0) break;
      allCandidates = remainingCandidates;
    }
    /// Assuming at least one match exists, use the first one the slug satisfies.
    if (allCandidates.length) {
      currentOrganizationState.wrappedValue = allCandidates[0];
      return;
    }
  }, [orgID, organizations, currentOrganizationState]);
  return children;
}
