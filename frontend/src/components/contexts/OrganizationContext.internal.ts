import type { CSSColor, MetricID, Organization } from "@/generated/serverTypes";

import { StateObject } from "@/library/StateObject";

export function createFakeOrgContenxt() {
  return {
    organizations: [],
    currentOrganizationState: new StateObject<Organization | undefined>(undefined),
    currentOrganization: undefined,
    organizationSlug: null,
    kindConfigurations: [],
    kindConfigurationForPattern: () => ({
      displayName: "Artifact",
      otherNames: { one: "Artifact", other: "Artifacts" },
      includesID: false,
      pattern: [],
    }),
    genericArtifactName: { one: "Artifact", other: "Artifacts" },
    canCreateArtifactWithPattern: () => false,
    metricDefinitionForID: (_id: MetricID) => null,
    metricColorForID: (_id: MetricID): CSSColor => "#000000",
    refreshMetrics: async () => {},
    error: undefined,
    isLoading: false,
    refresh: async () => undefined,
  };
}
