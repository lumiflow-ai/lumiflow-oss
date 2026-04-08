import type { Artifact, EvaluationGroupID } from "@/generated/serverTypes";

type ArtifactRunData = Pick<Artifact, "metrics" | "generations">;

export function modelNamesForEvaluationFromArtifacts({
  evaluationGroupID,
  artifacts,
  modelDisplayNameForID,
}: {
  evaluationGroupID: EvaluationGroupID;
  artifacts: ArtifactRunData[];
  modelDisplayNameForID?: Map<string, string>;
}): string[] {
  const modelNames = new Set<string>();

  for (const artifact of artifacts) {
    const generationIDs = new Set<string>();
    const fallbackRecipeRunIDs = new Set<string>();

    for (const metric of artifact.metrics ?? []) {
      for (const value of metric.values) {
        if (value.evaluationGroupID !== evaluationGroupID) continue;
        if (value.generationID) {
          generationIDs.add(value.generationID);
          continue;
        }
        if (!value.recipeRunID) continue;
        fallbackRecipeRunIDs.add(value.recipeRunID);
      }
    }

    if (generationIDs.size === 0 && fallbackRecipeRunIDs.size === 0) continue;

    for (const generation of artifact.generations ?? []) {
      const matchesGenerationID = generationIDs.has(generation.generationID);
      const matchesFallbackRecipeRunID = fallbackRecipeRunIDs.has(generation.recipeRunID);
      if (!matchesGenerationID && !matchesFallbackRecipeRunID) continue;
      const modelID = generation.modelID.trim();
      if (!modelID) continue;
      const displayName = modelDisplayNameForID?.get(modelID)?.trim();
      modelNames.add(displayName && displayName.length > 0 ? displayName : modelID);
    }
  }

  return Array.from(modelNames).sort((lhs, rhs) => lhs.localeCompare(rhs));
}
