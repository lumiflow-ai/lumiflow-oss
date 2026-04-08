import { useRouter } from "next/navigation";
import { useCallback, useContext, useMemo, useState } from "react";
import styled, { css } from "styled-components";

import { fetchRecordRecipe, fetchRunRecipes } from "@/generated/serverEndpoints";
import { type RecipeID, RecipeTriggerKind } from "@/generated/serverTypes";

import { type StateObject, useBinding, useStateObject } from "@/library/StateObject";

import { decodeArtifactSelector } from "@/model/artifactPath";
import { filterItems } from "@/model/keyPath";

import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import { RecipeContext, recipeMetricVisibleFilter } from "@/components/contexts/RecipeContext";
import { DatasetSelect, type DatasetSelectState } from "@/components/DatasetSelect";
import { EvaluationModelSelect, type EvaluationModelSelectState } from "@/components/EvaluationModelSelect";
import { MetricSetSelect } from "@/components/MetricSetSelect";
import {
  Button,
  Color,
  ControlContainer,
  Font,
  Label,
  LabeledControl,
  ModalPanel,
  Size,
  TextField,
} from "@/components/ui";

// MARK: - Styles

const Title = styled.h1`${() => css`
  margin: -2px 0px;
  font-size: ${Size.fontSize.fontSize16};
  font-weight: 400;
`}`;

const Message = styled.p`${() => css`
  font-size: ${Size.fontSize.fontSize14};
  font-family:${Font.ibmPlexSans}
`}`;

const ButtonHStack = styled.div`${() => css`
  display: flex;
  flex-direction: row;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 6px;

  
  ${Button} {
    min-width: 80px;
  }
`}`;

const CreateEvaluationContainer = styled(ControlContainer)`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 24px;
  overflow-y: auto;
  box-sizing: border-box;
  max-width: 450px;
  border-radius: 24px;

  ${LabeledControl} {
    margin-bottom: 12px;
  }
`}`;

const NoQuestionsWarningContainer = styled(ControlContainer)`${() => css`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 20px;
  max-width: 450px;
  box-sizing: border-box;
  overflow-y: auto;
`}`;

export const EvaluationCreationModal = ({ isPresentedState }: { isPresentedState: StateObject<boolean> }) => {
  const { currentOrganization, organizationSlug } = useContext(OrganizationContext);

  const { recipes: maybeRecipes, recipeMetricSetNodes, isLoading: recipesLoading, refresh } = useContext(RecipeContext);
  const recipes = maybeRecipes ?? [];

  const evaluationNameState = useStateObject("");
  const datasetSelectionState = useStateObject<DatasetSelectState>({
    kind: "placeholder",
    value: null,
    artifactCount: 0,
  });
  const evaluationModelSelectionState = useStateObject<EvaluationModelSelectState>({
    kind: "placeholder",
    value: null,
    model: null,
  });
  const metricSetSelectionState = useStateObject<Set<RecipeID>>(() => new Set());
  const [selectedMetricSetIDs] = useBinding(metricSetSelectionState);
  const [isWorking, setIsWorking] = useState(false);
  const [availableMetricSetIDs, setAvailableMetricSetIDs] = useState<Set<RecipeID>>(new Set());
  const router = useRouter();

  const visibleRecipeMetricSets = useMemo(
    () => filterItems({ items: recipeMetricSetNodes, filter: recipeMetricVisibleFilter }),
    [recipeMetricSetNodes],
  );
  const resetMetricSelection = useCallback(() => {
    metricSetSelectionState.wrappedValue = new Set(availableMetricSetIDs);
  }, [availableMetricSetIDs, metricSetSelectionState]);

  const closeModal = useCallback(() => {
    isPresentedState.wrappedValue = false;
    evaluationNameState.wrappedValue = "";
    datasetSelectionState.wrappedValue = { kind: "placeholder", value: null, artifactCount: 0 };
    evaluationModelSelectionState.wrappedValue = { kind: "placeholder", value: null, model: null };
    resetMetricSelection();
    setIsWorking(false);
  }, [
    isPresentedState,
    evaluationNameState,
    datasetSelectionState,
    evaluationModelSelectionState,
    resetMetricSelection,
  ]);

  const goToMetrics = useCallback(() => {
    if (!organizationSlug) return;
    router.push(`/app/${organizationSlug}/metrics`);
    closeModal();
  }, [organizationSlug, router, closeModal]);

  const createEvaluation = useCallback(async () => {
    if (!currentOrganization) {
      console.error("Missing organization for evaluation creation");
      return;
    }

    if (selectedMetricSetIDs.size === 0) {
      console.error("You must select at least one metric set before creating an evaluation.");
      return;
    }

    const datasetSelection = datasetSelectionState.wrappedValue;
    if (datasetSelection.kind !== "valid") {
      console.error("You must select a valid dataset before creating an evaluation.");
      return;
    }

    setIsWorking(true);

    try {
      // Get the selected dataset's artifact path pattern
      const selectedDatasetPath = decodeArtifactSelector(datasetSelection.value).artifactPath;
      // Match all artifacts within the dataset
      const artifactPathPattern = [...selectedDatasetPath, { kind: "artifact" }];

      const timestamp = new Date().toISOString();
      // Step 3: Create triggers for each recipe
      const newTrigger = {
        id: crypto.randomUUID(),
        evaluationGroupID: crypto.randomUUID(),
        name: evaluationNameState.wrappedValue,
        kind: RecipeTriggerKind.artifactPath,
        artifactPathPattern,
        creationTimestamp: timestamp,
        updateTimestamp: timestamp,
      };

      const selectedRecipes = recipes.filter((recipe) => selectedMetricSetIDs.has(recipe.id));
      if (selectedRecipes.length === 0) {
        console.error("No matching metric sets found for evaluation creation.");
        return;
      }

      const updatePromises = selectedRecipes.map(async (recipe) => {
        return await fetchRecordRecipe({
          orgID: currentOrganization.id,
          recipe: {
            id: recipe.id,
            triggerUpdates: [newTrigger],
          },
        });
      });

      await Promise.all(updatePromises);
      await refresh();

      // Schedule recipes for evaluation on matching artifacts
      try {
        const evaluationModelSelection = evaluationModelSelectionState.wrappedValue;
        const evaluationModelID =
          evaluationModelSelection.kind === "valid" ? evaluationModelSelection.value : undefined;

        await fetchRunRecipes({
          orgID: currentOrganization.id,
          recipeIDs: selectedRecipes.map((recipe) => recipe.id),
          evaluationGroupIDs: [newTrigger.evaluationGroupID],
          evaluationModelID,
        });
      } catch (error) {
        console.warn("Failed to schedule some recipes for evaluation:", error);
        // Don't fail evaluation creation if scheduling fails
      }

      closeModal();
    } catch (error) {
      console.error("Failed to create evaluation:", error);
    } finally {
      setIsWorking(false);
    }
  }, [
    currentOrganization,
    recipes,
    refresh,
    evaluationNameState,
    datasetSelectionState,
    evaluationModelSelectionState,
    selectedMetricSetIDs,
    closeModal,
  ]);

  const canCreate =
    !!evaluationNameState.wrappedValue.trim() &&
    datasetSelectionState.wrappedValue.kind === "valid" &&
    selectedMetricSetIDs.size > 0 &&
    !isWorking;

  return (
    <ModalPanel isPresentedState={isPresentedState} presentation="dialog">
      {!recipesLoading && visibleRecipeMetricSets.length === 0 ? (
        <NoQuestionsWarningContainer prominence="primary">
          <Title>No Metrics Available</Title>
          <Message>
            You need to create at least one metric before you can create an evaluation. Metrics define what will be
            measured when running evaluations on your datasets.
          </Message>
          <ButtonHStack>
            <Button action={closeModal} keyEquivalent="Escape">
              Cancel
            </Button>
            <Button action={goToMetrics} keyEquivalent="Enter">
              Go to Metrics
            </Button>
          </ButtonHStack>
        </NoQuestionsWarningContainer>
      ) : (
        <CreateEvaluationContainer isEnabled={!isWorking && !recipesLoading} prominence="primary">
          <Title>Create New Evaluation</Title>
          <Message>
            Name your evaluation, and choose a set of metrics, dataset, and model to run the evaluation against.
          </Message>
          <LabeledControl>
            <Label>Evaluation Name</Label>
            <TextField
              valueState={evaluationNameState}
              placeholder="Evaluation Name"
              autoCapitalize="words"
              style={{ backgroundColor: Color.surfaceOffWhite, height: "40px", padding: "10px 12px" }}
            />
          </LabeledControl>
          <DatasetSelect selectionState={datasetSelectionState} />
          <EvaluationModelSelect label="Judge Model (optional)" selectionState={evaluationModelSelectionState} />
          <MetricSetSelect
            selectionState={metricSetSelectionState}
            onAvailableMetricSetIDsChange={setAvailableMetricSetIDs}
            artifactCount={datasetSelectionState.wrappedValue.artifactCount}
          />
          <ButtonHStack>
            <Button action={closeModal} isEnabled keyEquivalent="Escape">
              Cancel
            </Button>
            <Button action={createEvaluation} isEnabled={canCreate} keyEquivalent="Enter">
              Run
            </Button>
          </ButtonHStack>
        </CreateEvaluationContainer>
      )}
    </ModalPanel>
  );
};
