import { createContext, type PropsWithChildren, useCallback, useContext, useMemo } from "react";

import { useRecipes } from "@/generated/serverEndpoints";
import {
  type CSSColor,
  type EvaluationGroupID,
  type KeyPathFilter,
  type MetricDefinition,
  type MetricID,
  type Recipe,
  type RecipeID,
  type RecipeStep,
  RecipeStepInputKind,
  RecipeStepKind,
  RecipeStepOutputKind,
  RecipeStepStatus,
  ValueFilterOperator,
} from "@/generated/serverTypes";

import { encodeArtifactPath } from "@/model/artifactPath";
import { type Evaluation, flattenRecipeEvaluations } from "@/model/evaluation";
import { ItemNode, type SortDescriptor } from "@/model/keyPath";

import { OrganizationContext } from "@/components/contexts/OrganizationContext";

// MARK: - Types

export type RecipeMetricSet = {
  id: RecipeID;

  recipe: Recipe;

  isVisible: boolean;
  isDeleted: boolean;
};

export type RecipeMetric = {
  id: string;

  metricID: MetricID;
  userPrompt: string;
  evaluationPaths: { [id: string]: boolean };

  recipe: Recipe;
  steps: Set<RecipeStep>;
  metricDefinition: MetricDefinition | null;
  color: CSSColor;

  /** Enabled metrics include only those that will actually execute. */
  isEnabled: boolean;
  /** Visible recipe metrics include enabled or disabled metrics only. */
  isVisible: boolean;
  /** Accessible recipe metrics include previously migrated metrics, ie. all non-deleted metrics. */
  isAccessible: boolean;
  /** Deleted metrics should no longer be shown in any part of the UI. */
  isDeleted: boolean;
};

export type RecipeMetricSetLookup = (_: { recipeID: RecipeID }) => RecipeMetricSet | null;
export type RecipeMetricSetNodeLookup = (_: { recipeID: RecipeID }) => ItemNode<RecipeMetricSet> | null;
export type RecipeMetricLookup = (_: { recipeID: RecipeID; metricID: MetricID }) => RecipeMetric | null;

// MARK: - Constants

export const recipeMetricVisibleFilter: KeyPathFilter = {
  keyPath: "isVisible",
  operator: ValueFilterOperator.equal,
  value: true,
};

export const recipeMetricAccessibleFilter: KeyPathFilter = {
  keyPath: "isAccessible",
  operator: ValueFilterOperator.equal,
  value: true,
};

export const recipeMetricSetSortedByName: SortDescriptor = {
  keyPaths: ["recipe.name", "id"],
  order: "ascending",
};

// MARK: - Helper Functions

export function isRecipeMetricSet(
  node: ItemNode<RecipeMetric> | ItemNode<RecipeMetricSet> | null | undefined,
): node is ItemNode<RecipeMetricSet>;
export function isRecipeMetricSet(item: RecipeMetric | RecipeMetricSet | null | undefined): item is RecipeMetricSet;
export function isRecipeMetricSet(
  nodeOrItem: ItemNode<RecipeMetric> | ItemNode<RecipeMetricSet> | RecipeMetric | RecipeMetricSet | null | undefined,
): nodeOrItem is ItemNode<RecipeMetricSet> | RecipeMetricSet {
  if (nodeOrItem instanceof ItemNode) return !!nodeOrItem.item && !("metricID" in nodeOrItem.item);
  return !!nodeOrItem && !("metricID" in nodeOrItem);
}

export function isRecipeMetric(
  node: ItemNode<RecipeMetric> | ItemNode<RecipeMetricSet> | null | undefined,
): node is ItemNode<RecipeMetric>;
export function isRecipeMetric(item: RecipeMetric | RecipeMetricSet | null | undefined): item is RecipeMetric;
export function isRecipeMetric(
  nodeOrItem: ItemNode<RecipeMetric> | ItemNode<RecipeMetricSet> | RecipeMetric | RecipeMetricSet | null | undefined,
): nodeOrItem is ItemNode<RecipeMetric> | RecipeMetric {
  if (nodeOrItem instanceof ItemNode) return !!nodeOrItem.item && "metricID" in nodeOrItem.item;
  return !!nodeOrItem && "metricID" in nodeOrItem;
}

export function generateRecipeMetricID({ recipeID, metricID }: { recipeID: RecipeID; metricID: MetricID }): string {
  return `${recipeID}-${metricID}`;
}

// MARK: - Context

export const RecipeContext = createContext<{
  /** All active (not deleted) recipes */
  recipes: Recipe[];
  /** Map of all recipes, including deleted ones */
  recipeMap: Map<RecipeID, Recipe>;
  /** All available evaluations **/
  evaluations: Evaluation[];
  /** Map of all evaluations */
  evaluationMap: Map<EvaluationGroupID, Evaluation>;
  /** A list of recipe Requirement nodes suitable for display */
  recipeMetricSetNodes: ItemNode<RecipeMetricSet>[];
  /** Lookup a recipe Requirement based on a recipe ID */
  recipeMetricSetNodeForID: RecipeMetricSetNodeLookup;
  /** Lookup a recipe Requirement based on a recipe ID */
  recipeMetricSetForID: RecipeMetricSetLookup;
  /** A list of recipe metric nodes suitable for display */
  recipeMetricNodes: ItemNode<RecipeMetric>[];
  /** Lookup a recipe metric based on a recipe ID and metric ID */
  recipeMetricForID: RecipeMetricLookup;
  error: Error | undefined;
  isLoading: boolean;
  refresh: () => Promise<{ recipes: Recipe[]; evaluations: Evaluation[] } | undefined>;
}>({
  recipes: [],
  recipeMap: new Map(),
  evaluations: [],
  evaluationMap: new Map(),
  recipeMetricSetNodes: [],
  recipeMetricSetNodeForID: () => null,
  recipeMetricSetForID: () => null,
  recipeMetricNodes: [],
  recipeMetricForID: () => null,
  error: new Error("Recipes can't be loaded."),
  isLoading: false,
  refresh() {
    throw new Error("Recipes can't be refreshed.");
  },
});

// MARK: - Component

export const RecipeContextProvider = ({ children }: PropsWithChildren) => {
  const { currentOrganization, metricDefinitionForID, metricColorForID, refreshMetrics } =
    useContext(OrganizationContext);

  const { response, error, isLoading, refresh } = useRecipes(currentOrganization && { orgID: currentOrganization.id });

  const localRefresh = useCallback(async () => {
    await refreshMetrics();
    const response = await refresh();
    if (!response) return undefined;
    return {
      recipes: response.recipes,
      evaluations: flattenRecipeEvaluations(response.recipes, new Set(response.cancelledEvaluationGroupIDs)),
    };
  }, [refresh, refreshMetrics]);

  const contextValue = useMemo(() => {
    const recipes = response?.recipes ?? [];
    const evaluations = flattenRecipeEvaluations(recipes, new Set(response?.cancelledEvaluationGroupIDs ?? []));

    const recipeMetricLookup = new Map<string, RecipeMetric>();
    const recipeMetricNodes: ItemNode<RecipeMetric>[] = [];
    const recipeMetricSetNodeLookup = new Map<RecipeID, ItemNode<RecipeMetricSet>>(
      recipes.map((recipe) => [
        recipe.id,
        new ItemNode<RecipeMetricSet>({
          id: recipe.id,
          item: {
            id: recipe.id,
            recipe,
            isVisible: !!recipe.name && !recipe.isDeleted,
            isDeleted: !!recipe.isDeleted,
          },
        }),
      ]),
    );

    const recipeMetricSetNodes = Array.from(recipeMetricSetNodeLookup.values());

    for (const recipe of recipes) {
      for (const step of recipe.steps) {
        if (step.kind !== RecipeStepKind.evaluate) continue;

        for (const output of step.outputs) {
          if (output.kind !== RecipeStepOutputKind.metric) continue;
          const metricID = output.output.metricID;
          const key = generateRecipeMetricID({ recipeID: recipe.id, metricID });
          const existingMetric = recipeMetricLookup.get(key);
          if (!existingMetric) {
            const recipeMetric: RecipeMetric = {
              id: key,
              metricID,
              userPrompt: step.userPrompt,
              evaluationPaths: Object.fromEntries(
                step.inputs.flatMap((input) => {
                  if (input.kind !== RecipeStepInputKind.artifact) return [];
                  if (input.input.keyPath !== "") return [];

                  return [[encodeArtifactPath(input.input.childArtifactPath), true]];
                }),
              ),
              recipe,
              steps: new Set([step]),
              metricDefinition: metricDefinitionForID(metricID),
              color: metricColorForID(metricID),
              isEnabled: step.status === RecipeStepStatus.enabled && !recipe.isDeleted,
              isVisible:
                (step.status === RecipeStepStatus.enabled || step.status === RecipeStepStatus.disabled) &&
                !recipe.isDeleted,
              isAccessible:
                step.status !== RecipeStepStatus.hidden &&
                step.status !== RecipeStepStatus.migrated &&
                !recipe.isDeleted,
              isDeleted: step.status === RecipeStepStatus.hidden || !!recipe.isDeleted,
            };
            recipeMetricLookup.set(key, recipeMetric);

            const node = new ItemNode({ id: recipeMetric.id, item: recipeMetric });
            recipeMetricNodes.push(node);

            recipeMetricSetNodeLookup.get(recipe.id)?.addChild(node);
          } else {
            existingMetric.userPrompt = step.userPrompt;
            for (const input of step.inputs) {
              if (input.kind !== RecipeStepInputKind.artifact) continue;
              if (input.input.keyPath !== "") continue;

              existingMetric.evaluationPaths[encodeArtifactPath(input.input.childArtifactPath)] = true;
            }
            existingMetric.steps.add(step);
            existingMetric.isEnabled =
              (existingMetric.isEnabled || step.status === RecipeStepStatus.enabled) && !recipe.isDeleted;
            existingMetric.isVisible =
              (existingMetric.isVisible ||
                step.status === RecipeStepStatus.enabled ||
                step.status === RecipeStepStatus.disabled) &&
              !recipe.isDeleted;
            existingMetric.isAccessible =
              (existingMetric.isAccessible ||
                (step.status !== RecipeStepStatus.hidden && step.status !== RecipeStepStatus.migrated)) &&
              !recipe.isDeleted;
            existingMetric.isDeleted =
              (existingMetric.isDeleted && step.status === RecipeStepStatus.hidden) || !!recipe.isDeleted;
          }
        }
      }
    }

    const recipeMetricSetNodeForID: RecipeMetricSetNodeLookup = ({ recipeID }) => {
      return recipeMetricSetNodeLookup.get(recipeID) ?? null;
    };

    const recipeMetricSetForID: RecipeMetricSetLookup = ({ recipeID }) => {
      return recipeMetricSetNodeForID({ recipeID })?.item ?? null;
    };

    const recipeMetricForID: RecipeMetricLookup = ({ recipeID, metricID }) => {
      const recipeMetric = recipeMetricLookup.get(generateRecipeMetricID({ recipeID, metricID }));
      if (recipeMetric?.recipe.id !== recipeID || recipeMetric.metricID !== metricID) return null;
      return recipeMetric;
    };

    return {
      recipes: recipes.filter((recipe) => !recipe.isDeleted),
      recipeMap: new Map(recipes.map((recipe) => [recipe.id, recipe])),
      evaluations,
      evaluationMap: new Map(evaluations.map((evaluation) => [evaluation.id, evaluation])),
      recipeMetricSetNodes,
      recipeMetricSetNodeForID,
      recipeMetricSetForID,
      recipeMetricNodes,
      recipeMetricForID,
      error,
      isLoading,
      refresh: localRefresh,
    };
  }, [response, metricDefinitionForID, metricColorForID, error, isLoading, localRefresh]);

  return <RecipeContext.Provider value={contextValue}>{children}</RecipeContext.Provider>;
};
RecipeContextProvider.displayName = "RecipeContextProvider";
