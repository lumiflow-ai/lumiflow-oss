import { z } from "zod";

import { installAPIExtensions } from "@/lib/apiGeneration";

installAPIExtensions();

// MARK: - Identifiers

export const ArtifactKindSchema = z.string().api("ArtifactKind");

export const ArtifactIDSchema = z.string().api("ArtifactID");

// MARK: - Artifact Path

export const ArtifactPathComponentSchema = z
  .object({
    kind: ArtifactKindSchema.nullish(),
    id: ArtifactIDSchema,
  })
  .api("ArtifactPathComponent");

export const ArtifactPathSchema = z.array(ArtifactPathComponentSchema).api("ArtifactPath");

// MARK: - Artifact Path Pattern

export const ArtifactPathPatternComponentSchema = z
  .union([
    /// Either a kind is specified with an optional ID…
    z.object({
      kind: ArtifactKindSchema,
      id: ArtifactIDSchema.nullish(),
    }),
    /// Or an explicit ID is specified.
    z.object({
      id: ArtifactIDSchema,
    }),
  ])
  .api("ArtifactPathPatternComponent");

export const ArtifactPathPatternSchema = z.array(ArtifactPathPatternComponentSchema).api("ArtifactPathPattern");
