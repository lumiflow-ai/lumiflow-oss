import type { ArtifactPathPattern, EvaluationGroupID, Recipe, RecipeID } from "@/generated/serverTypes";

import { encodeArtifactPathPattern } from "@/model/artifactPath";

/**
 * A type representing the aggregated set of recipe triggers that have the same Evaluation GroupID.
 */
export type Evaluation = {
  /** The identifier shared between several recipe triggers that represent, as a whole, an evaluation. */
  id: EvaluationGroupID;
  /** The name of the evaluation, presented to the user. */
  name: string;
  /** The earliest creation timestamp of the evaluation. */
  creationTimestamp: Date;
  /** The list of artifact path patterns the evaluation works against. */
  artifactPathPatterns: ArtifactPathPattern[];
  /** The list of recipe IDs that specify this evaluation as a trigger. */
  recipeIDs: RecipeID[];
  /** Whether the evaluation has been explicitly cancelled by a user. */
  isCancelled: boolean;
};

export function flattenRecipeEvaluations(
  recipes: Recipe[],
  cancelledEvaluationGroupIDs: ReadonlySet<EvaluationGroupID> = new Set(),
): Evaluation[] {
  type IntermediateEvaluation = {
    id: EvaluationGroupID;
    name: string;
    creationTimestamp: Date;
    artifactPathPatterns: Map<string, ArtifactPathPattern>;
    recipeIDs: Set<RecipeID>;
    isCancelled: boolean;
  };
  const evaluationsMap = new Map<EvaluationGroupID, IntermediateEvaluation>();

  for (const recipe of recipes) {
    for (const trigger of recipe.triggers ?? []) {
      const triggerTimestamp = new Date(trigger.creationTimestamp);
      const artifactPathPatternKey = encodeArtifactPathPattern(trigger.artifactPathPattern);
      const evaluation = evaluationsMap.get(trigger.evaluationGroupID);

      if (!evaluation) {
        /// Create a new evaluation
        evaluationsMap.set(trigger.evaluationGroupID, {
          id: trigger.evaluationGroupID,
          name: trigger.name,
          creationTimestamp: triggerTimestamp,
          artifactPathPatterns: new Map([[artifactPathPatternKey, trigger.artifactPathPattern]]),
          recipeIDs: new Set([recipe.id]),
          isCancelled: cancelledEvaluationGroupIDs.has(trigger.evaluationGroupID),
        });
      } else {
        /// Use the earliest timestamp.
        if (triggerTimestamp.getTime() < evaluation.creationTimestamp.getTime()) {
          evaluation.creationTimestamp = triggerTimestamp;
        }
        /// Merge Artifact Path Patterns
        evaluation.artifactPathPatterns.set(artifactPathPatternKey, trigger.artifactPathPattern);
        /// Merge RecipeIDs
        evaluation.recipeIDs.add(recipe.id);
        evaluation.isCancelled = evaluation.isCancelled || cancelledEvaluationGroupIDs.has(trigger.evaluationGroupID);
      }
    }
  }

  /// Transform the intermediate format into Evaluations
  return Array.from(
    evaluationsMap,
    ([_, { id, name, creationTimestamp, artifactPathPatterns, recipeIDs, isCancelled }]) => ({
      id,
      name,
      creationTimestamp,
      artifactPathPatterns: Array.from(artifactPathPatterns.values()),
      recipeIDs: Array.from(recipeIDs),
      isCancelled,
    }),
  );
}
