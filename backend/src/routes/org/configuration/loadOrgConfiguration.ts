import {
  type ArtifactPath,
  type ArtifactPathPattern,
  type ArtifactPatternConfiguration,
  type DisplayName,
  type OrganizationID,
  OrganizationTemplate,
  type OrgConfigurationResponse,
} from "@/types";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { encodeArtifactPathPattern, matchingPatternsForArtifactPath } from "@/model/artifactPath";

import { OrgIDs } from "@/user";

import { OrgConfigurationRequestSchema, OrgConfigurationResponseSchema } from "./definitions";

export const generalConfiguration: OrgConfigurationResponse = {
  genericArtifactName: {
    one: "Artifact",
    other: "Artifacts",
  },
  artifactPatterns: [
    {
      pattern: [{ kind: "dataset" }],
      displayName: {
        one: "Dataset",
        other: "Datasets",
      },
      allowCreation: true,
    },
    {
      pattern: [{ kind: "dataset" }, { kind: "artifact" }],
      displayName: {
        one: "Artifact",
        other: "Artifacts",
      },
      allowCreation: true,
    },
    {
      pattern: [{ kind: "dataset" }, { kind: "artifact" }, { id: "input" }],
      displayName: {
        one: "Input",
        other: "Input",
        evaluate: "Evaluate Input?",
      },
    },
    {
      pattern: [{ kind: "dataset" }, { kind: "artifact" }, { id: "output" }],
      displayName: {
        one: "Expected",
        other: "Expected",
        evaluate: "Evaluate Expected?",
      },
    },
  ],
};

export const defaultConfiguration = generalConfiguration;

// For now, demo orgs use the same configuration as general template. This can be customized later as needed.
export const demoConfiguration = generalConfiguration;

const configurationMap = new Map<OrganizationID, OrgConfigurationResponse>([
  [
    OrgIDs.demo.coding,
    {
      genericArtifactName: {
        one: "Project",
        other: "Projects",
      },
      artifactPatterns: [
        {
          pattern: [{ kind: "project" }],
          displayName: {
            one: "Project",
            other: "Projects",
          },
        },
        {
          pattern: [{ kind: "project" }, { kind: "turn" }],
          displayName: {
            one: "Turn",
            other: "Turns",
          },
        },
        {
          pattern: [{ kind: "project" }, { kind: "turn" }, { id: "user" }],
          displayName: {
            one: "User Request",
            other: "User Requests",
          },
        },
        {
          pattern: [{ kind: "project" }, { kind: "turn" }, { id: "assistant" }],
          displayName: {
            one: "Assistant Response",
            other: "Assistant Responses",
          },
        },
      ],
    },
  ],
]);

const orgConfigurationMap = new Map<
  OrganizationID,
  { genericArtifactName: DisplayName; artifactPatternsMap: Map<string, ArtifactPatternConfiguration> }
>();
for (const [orgID, orgConfiguration] of configurationMap) {
  orgConfigurationMap.set(orgID, {
    genericArtifactName: orgConfiguration.genericArtifactName,
    artifactPatternsMap: new Map(
      orgConfiguration.artifactPatterns.map((artifactPattern) => [
        encodeArtifactPathPattern(artifactPattern.pattern),
        artifactPattern,
      ]),
    ),
  });
}

function artifactConfigurationForArtifactPathPattern({
  orgID,
  artifactPathPattern,
}: {
  orgID: OrganizationID;
  artifactPathPattern: ArtifactPathPattern;
}): DisplayName | undefined {
  return orgConfigurationMap.get(orgID)?.artifactPatternsMap.get(encodeArtifactPathPattern(artifactPathPattern))
    ?.displayName;
}

export function displayNameForArtifactPath({
  orgID,
  artifactPath,
}: {
  orgID: OrganizationID;
  artifactPath: ArtifactPath;
}): DisplayName {
  for (const artifactPathPattern of matchingPatternsForArtifactPath(artifactPath)) {
    const displayName = artifactConfigurationForArtifactPathPattern({ orgID, artifactPathPattern });
    if (displayName) return displayName;
  }

  return orgConfigurationMap.get(orgID)?.genericArtifactName ?? { one: "Artifact", other: "Artifacts" };
}

export function displayNameForArtifactPathPattern({
  orgID,
  artifactPathPattern,
  organizationTemplate,
}: {
  orgID: OrganizationID;
  artifactPathPattern: ArtifactPathPattern;
  organizationTemplate?: OrganizationTemplate;
}): DisplayName {
  // First try the org-specific configuration map
  const configuredDisplayName = artifactConfigurationForArtifactPathPattern({ orgID, artifactPathPattern });
  if (configuredDisplayName) return configuredDisplayName;

  // Fall back to template-based configuration
  const configuration = getOrgConfiguration({ orgID, organizationTemplate });
  const patternKey = encodeArtifactPathPattern(artifactPathPattern);

  for (const artifactPattern of configuration.artifactPatterns) {
    if (encodeArtifactPathPattern(artifactPattern.pattern) === patternKey) {
      return artifactPattern.displayName;
    }
  }

  return configuration.genericArtifactName;
}

export function getOrgConfiguration({
  orgID,
  organizationTemplate,
}: {
  orgID: OrganizationID;
  organizationTemplate?: OrganizationTemplate;
}): OrgConfigurationResponse {
  const configuration = configurationMap.get(orgID);
  if (configuration) return configuration;

  switch (organizationTemplate) {
    case OrganizationTemplate.demo:
      return demoConfiguration;
    case OrganizationTemplate.general:
      return generalConfiguration;
    default:
      return defaultConfiguration;
  }
}

export const loadOrgConfiguration = new RouteGroup();
loadOrgConfiguration.get(
  null,
  {
    requestSchema: OrgConfigurationRequestSchema,
    responseSchema: OrgConfigurationResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context) => {
    const orgID = request.orgID.toLowerCase();
    const organization = context.user?.organizations.get(orgID);
    if (!organization) {
      throw new AuthorizationError();
    }

    const artifactConfiguration = getOrgConfiguration({ orgID, organizationTemplate: organization.template });
    return artifactConfiguration;
  },
);
