import { z } from "zod";

import { installAPIExtensions } from "@/lib/apiGeneration";

import { OrganizationIDSchema } from "@/routes/orgs/definitions";

import { ArtifactPathPatternSchema } from "@/definitions/artifactPath";
import { DisplayNameSchema } from "@/definitions/displayName";

installAPIExtensions();

// MARK: - Configurations

export const ArtifactPatternConfigurationSchema = z
  .object({
    pattern: ArtifactPathPatternSchema,
    displayName: DisplayNameSchema,
    allowCreation: z.boolean().optional(),
  })
  .api("ArtifactPatternConfiguration");

// MARK: - HTTP

export const OrgConfigurationRequestSchema = z
  .object({
    orgID: OrganizationIDSchema,
  })
  .api("OrgConfigurationRequest");

export const OrgConfigurationResponseSchema = z
  .object({
    artifactPatterns: z.array(ArtifactPatternConfigurationSchema),
    genericArtifactName: DisplayNameSchema,
  })
  .api("OrgConfigurationResponse");
