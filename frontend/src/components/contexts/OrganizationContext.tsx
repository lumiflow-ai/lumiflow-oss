import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, type PropsWithChildren, useCallback, useLayoutEffect, useMemo, useRef } from "react";

import { useOrgConfiguration, useOrgs } from "@/generated/serverEndpoints";
import type {
  ArtifactPath,
  ArtifactPathPattern,
  ArtifactPatternConfiguration,
  CSSColor,
  DisplayName,
  MetricDefinition,
  MetricID,
  Organization,
  PluralityClass,
} from "@/generated/serverTypes";

import { StateObject, useBinding, useReactiveState } from "@/library/StateObject";
import useLocalStorageStateObject from "@/library/useLocalStorageStateObject";

import { encodeArtifactPathPattern, matchingPatternsForArtifactPath } from "@/model/artifactPath";
import { useMetricDefinitions } from "@/model/metrics";
import { generateOrganizationSlug, useOrganizationSlug } from "@/model/organizations";

export type KindConfiguration = ArtifactPatternConfiguration & {
  key: string;
  depth: number;
};

export type KindConfigurationLookup = (
  artifactPath: ArtifactPathPattern | ArtifactPath,
  plurality: PluralityClass,
) => { displayName: string; otherNames: DisplayName; includesID: boolean; pattern: ArtifactPathPattern };

const emptyName: DisplayName = { one: "", other: "" };
const emptyPatternConfigurations: ArtifactPatternConfiguration[] = [];
const emptyConfiguration = { displayName: "", otherNames: emptyName, includesID: false, pattern: [] };
const defaultGenericArtifactName: DisplayName = { one: "Artifact", other: "Artifacts" };

function accessibleOrganization(
  currentOrganization: Organization | undefined,
  organizations: Organization[],
): Organization | undefined {
  if (!currentOrganization) return organizations.at(0);
  return organizations.find((organization) => organization.id === currentOrganization.id) ?? organizations.at(0);
}

export const OrganizationContext = createContext<{
  /** All visible organizations the user can access */
  organizations: Organization[];
  /** Map of all recipes, including deleted ones */
  currentOrganizationState: StateObject<Organization | undefined>;
  /** The active organization */
  currentOrganization: Organization | undefined;
  /** The slug to use when linking to a resource */
  organizationSlug: string | null;
  /** An ordered list of top-level kinds for the org. */
  kindConfigurations: KindConfiguration[];
  /** The kind for an artifact at a given path, suitable for display */
  kindConfigurationForPattern: KindConfigurationLookup;
  /** The name to use for generic artifacts throughout the UI */
  genericArtifactName: DisplayName;
  /** Check if an artifact with the given pattern can be created */
  canCreateArtifactWithPattern: (artifactPath: ArtifactPathPattern | ArtifactPath) => boolean;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
  metricColorForID: (id: MetricID) => CSSColor;
  refreshMetrics: () => Promise<void>;
  error: Error | undefined;
  isLoading: boolean;
  refresh: () => Promise<{ organizations: Organization[] } | undefined>;
}>({
  organizations: [],
  currentOrganizationState: new StateObject<Organization | undefined>(undefined),
  currentOrganization: undefined,
  organizationSlug: null,
  kindConfigurations: [],
  kindConfigurationForPattern: () => emptyConfiguration,
  genericArtifactName: defaultGenericArtifactName,
  canCreateArtifactWithPattern: () => false,
  metricDefinitionForID: () => null,
  metricColorForID: () => "white",
  refreshMetrics() {
    throw new Error("Metrics can't be refreshed.");
  },
  error: new Error("Organizations can't be loaded."),
  isLoading: false,
  refresh() {
    throw new Error("Organizations can't be refreshed.");
  },
});

export const OrganizationContextProvider = ({ children }: PropsWithChildren) => {
  /// Context

  const router = useRouter();
  const currentPath = usePathname();
  const searchParams = useSearchParams();
  const currentPathRef = useRef({ path: currentPath, searchParams });
  currentPathRef.current.path = currentPath;
  currentPathRef.current.searchParams = searchParams;

  /// State

  const organizationsLoader = useOrgs();
  const refreshOrganizations = organizationsLoader.refresh;
  const isLoadingOrganizations = organizationsLoader.isLoading;
  const organizationsError = organizationsLoader.error;

  const organizations = organizationsLoader.response?.orgs ?? [];
  const hasLoadedOrganizations = organizationsLoader.response !== undefined;
  const isNewUser = organizationsLoader.response?.orgs && organizationsLoader.response.orgs.length === 0;

  const currentOrganizationState = useLocalStorageStateObject<Organization | undefined>("lastOrganization", undefined);
  const [storedCurrentOrganization] = useBinding(currentOrganizationState);
  const currentOrganization = hasLoadedOrganizations
    ? accessibleOrganization(storedCurrentOrganization, organizations)
    : undefined;

  const configurationLoader = useOrgConfiguration(currentOrganization && { orgID: currentOrganization.id });
  const isLoadingConfiguration = configurationLoader.isLoading;
  const configurationError = configurationLoader.error;
  const artifactPatterns = configurationLoader.response?.artifactPatterns ?? emptyPatternConfigurations;
  const genericArtifactName = configurationLoader.response?.genericArtifactName ?? defaultGenericArtifactName;

  const metricDefinitionsLoader = useMetricDefinitions(currentOrganization?.id);
  const isLoadingMetricDefinitions = metricDefinitionsLoader.isLoading;
  const metricDefinitionsError = metricDefinitionsLoader.error;
  const { metricDefinitionForID, metricColorForID, refreshMetrics } = metricDefinitionsLoader;

  /// Derived State

  const organizationSlug = useOrganizationSlug({ org: currentOrganization, organizations });

  useReactiveState(
    currentOrganizationState,
    (oldOrganization, newOrganization) => {
      /// When the organizationSlug changes, redirect the user so the URL matches the most up-to-date slug.
      const organizationSlug = generateOrganizationSlug({ org: newOrganization, organizations });
      if (!organizationSlug) return;

      let pathComponents = currentPathRef.current.path.split("/");
      if (pathComponents.length >= 3) {
        /// If the org slugs match, do nothing and stop here.
        if (pathComponents[2] === organizationSlug) return;
        /// Otherwise, update the URL path.
        pathComponents[2] = organizationSlug;
      } else {
        pathComponents = ["", "app", organizationSlug, "artifacts"];
      }

      /// If the org IDs change, remove any details from the path.
      if (oldOrganization?.id && oldOrganization.id !== newOrganization?.id) {
        const basePath = pathComponents.slice(0, 4).join("/");
        if (pathComponents[3] === "metrics") {
          router.push(`${basePath}?sets`);
        } else {
          router.push(basePath);
        }
      } else {
        const path = pathComponents.join("/");
        const searchParams = currentPathRef.current.searchParams.toString();
        router.push(searchParams ? `${path}?${searchParams}` : path);
      }
    },
    [router, organizations],
  );

  /// If this is a new user, redirect to the signup page.
  useLayoutEffect(() => {
    if (!isNewUser) return;

    /// Clear out any saved organization info from other potential sessions.
    currentOrganizationState.wrappedValue = undefined;

    /// Redirect the user if they are not on the signup page.
    if (currentPathRef.current.path !== "/app/signup") router.push("/app/signup");
  }, [isNewUser, currentOrganizationState, router]);

  /// Keep localStorage aligned with organizations the active account can actually access.
  useLayoutEffect(() => {
    if (!hasLoadedOrganizations) return;

    const accessibleCurrentOrganization = accessibleOrganization(currentOrganizationState.wrappedValue, organizations);
    if (currentOrganizationState.wrappedValue?.id === accessibleCurrentOrganization?.id) return;

    currentOrganizationState.wrappedValue = accessibleCurrentOrganization;
  }, [hasLoadedOrganizations, organizations, currentOrganizationState]);

  const [patternDisplayNameLookup, kindConfigurations] = useMemo(() => {
    const patternDisplayNameLookup = new Map<string, KindConfiguration>(
      artifactPatterns.map((patternConfiguration) => {
        const key = encodeArtifactPathPattern(patternConfiguration.pattern);
        return [key, { ...patternConfiguration, key, depth: patternConfiguration.pattern.length }];
      }),
    );

    return [patternDisplayNameLookup, Array.from(patternDisplayNameLookup.values())];
  }, [artifactPatterns]);

  /// Actions

  const localRefresh = useCallback(async () => {
    const organizationsResponse = await refreshOrganizations();
    if (!organizationsResponse) return undefined;
    return { organizations: organizationsResponse.orgs };
  }, [refreshOrganizations]);

  const kindConfigurationForPattern: KindConfigurationLookup = useCallback(
    (artifactPath, plurality) => {
      if (!artifactPath) return emptyConfiguration;

      for (const pattern of matchingPatternsForArtifactPath(artifactPath)) {
        const patternConfiguration = patternDisplayNameLookup.get(encodeArtifactPathPattern(pattern));
        if (!patternConfiguration) continue;

        const displayName = patternConfiguration.displayName[plurality] ?? patternConfiguration.displayName.other;
        return {
          displayName,
          otherNames: patternConfiguration.displayName,
          includesID: !!patternConfiguration.pattern.at(-1)?.id,
          pattern: patternConfiguration.pattern,
        };
      }
      const lastComponent = artifactPath.at(-1);
      if (!lastComponent) return emptyConfiguration;

      if ("kind" in lastComponent && lastComponent.kind) {
        return {
          displayName: lastComponent.kind,
          otherNames: { one: lastComponent.kind, other: lastComponent.kind },
          includesID: false,
          pattern: artifactPath.slice(0, -1).concat({ kind: lastComponent.kind }),
        };
      }
      return {
        displayName: lastComponent.id ?? "",
        otherNames: { one: lastComponent.id ?? "", other: lastComponent.id ?? "" },
        includesID: true,
        pattern: artifactPath,
      };
    },
    [patternDisplayNameLookup],
  );

  const canCreateArtifactWithPattern = useCallback(
    (artifactPath: ArtifactPath | ArtifactPathPattern) => {
      for (const pattern of matchingPatternsForArtifactPath(artifactPath)) {
        const patternConfiguration = patternDisplayNameLookup.get(encodeArtifactPathPattern(pattern));
        if (patternConfiguration?.allowCreation) return true;
      }
      return false;
    },
    [patternDisplayNameLookup],
  );

  /// Provider

  const contextValue = useMemo(
    () => ({
      organizations,
      currentOrganizationState,
      currentOrganization,
      organizationSlug,
      kindConfigurations,
      kindConfigurationForPattern,
      genericArtifactName,
      canCreateArtifactWithPattern,
      metricDefinitionForID,
      metricColorForID,
      refreshMetrics,
      error: organizationsError ?? configurationError ?? metricDefinitionsError,
      isLoading: isLoadingOrganizations ?? isLoadingConfiguration ?? isLoadingMetricDefinitions,
      refresh: localRefresh,
    }),
    [
      organizations,
      currentOrganizationState,
      currentOrganization,
      organizationSlug,
      kindConfigurations,
      kindConfigurationForPattern,
      genericArtifactName,
      canCreateArtifactWithPattern,
      metricDefinitionForID,
      metricColorForID,
      refreshMetrics,
      organizationsError,
      configurationError,
      metricDefinitionsError,
      isLoadingOrganizations,
      isLoadingConfiguration,
      isLoadingMetricDefinitions,
      localRefresh,
    ],
  );

  return <OrganizationContext.Provider value={contextValue}>{children}</OrganizationContext.Provider>;
};
OrganizationContextProvider.displayName = "OrganizationContextProvider";
