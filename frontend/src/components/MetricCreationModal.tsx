import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { css } from "styled-components";

import { fetchPreviewRecipe, fetchRecordMetricDefinition, fetchRecordRecipe } from "@/generated/serverEndpoints";
import {
  type ContentWidget,
  type Metric,
  type MetricDefinition,
  type MetricID,
  type Recipe,
  type RecipeID,
  RecipeStepInputKind,
  WidgetKind,
} from "@/generated/serverTypes";

import { type StateObject, useBinding, useStateObject } from "@/library/StateObject";

import type { ArtifactNode } from "@/model/artifactNode";
import { artifactPathMatchesPattern, decodeArtifactSelector, encodeArtifactPath } from "@/model/artifactPath";
import { useEvaluationModels } from "@/model/evaluationModels";
import { filterItems, sortItems } from "@/model/keyPath";
import { valueForMetricKeyPath } from "@/model/metrics";

import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import {
  RecipeContext,
  recipeMetricSetSortedByName,
  recipeMetricVisibleFilter,
} from "@/components/contexts/RecipeContext";
import { DatasetSelect, type DatasetSelectState } from "@/components/DatasetSelect";
import { EvaluationModelSelect, type EvaluationModelSelectState } from "@/components/EvaluationModelSelect";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { usePresentCreateMetricSetDialog } from "@/components/modals/CreateMetricSetDialog";
import {
  Button,
  type CheckboxActionHandler,
  CheckboxButton,
  type CheckboxState,
  Color,
  ControlContainer,
  Label,
  LabeledControl,
  ModalPanel,
  PopupButton,
  PopupDivider,
  PopupItem,
  Size,
  TextField,
} from "@/components/ui";
import { WidgetComponent } from "@/components/widgets";

import { ArtifactContext } from "@/app/navigator/_shared/context";

export const metricModalMaxWidth = 1400;

const Constants = {
  resultHeight: 17.0,
  resultPadding: 2.0,
  previewArtifactsLimit: 5,
};

// MARK: - Styles

const ButtonHStack = styled.div`${() => css`
  display: flex;
  flex-direction: row;
  gap: 8px;
  justify-content: end;
  align-items: center;


`}`;

const AnswerValue = styled.span`${() => css`
  border-radius: ${Constants.resultHeight}px;
  padding: ${Constants.resultPadding}px 8px;
  height: ${Constants.resultHeight}px;
`}`;

const AnswerContainer = styled.div`${() => css`
  display: flex;
  flex-direction: row;
  gap: 10px;
`}`;

const CarouselButton = styled.button`${() => css`
  position: absolute;
  width: 30px;
  height: 30px;
  top: 50%;
  z-index: 10;
  background-color: ${Color.buttonfilled.background};
  border: 1px solid ${Color.line};
  padding: 4px;
  border-radius: 12px;
  font-size: ${Size.fontSize.fontSize14};
  color: ${Color.buttonfilled.text};
  cursor: pointer;

  &:not([disabled]):hover {
    color: ${Color.buttonfilled.hover.text};
  }

  &:not([disabled]):active:hover {
    background-color: ${Color.buttonfilled.hover.background};
  }
`}`;

const WidgetContainer = styled.div`${() => css`
  display: flex;
  position: relative;
  box-sizing: border-box;
  flex-grow: 1;
  margin: -6px;
  
  h2 {
    display: none;
  }

  & > div > div {
    outline: ${Size.line.thickness} solid ${Color.line};
  }
`}`;

const ContentColumn = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 1;
  flex-grow: 1;
`}`;

const VStack = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 1;
  flex-grow: 1;
  min-width: 0;
`}`;

const QuestionColumn = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 1;
  flex-grow: 0.3;
  margin:18px 0px;

`}`;

const HStack = styled.div`${() => css`
  display: flex;
  flex-direction: row;
  gap: 20px;
  flex-grow: 1;
  
`}`;

const GridStack = styled.div`${() => css`
  display: grid;
  grid-template-columns: 0.5fr 1fr;
  gap: 20px;
  flex-grow: 1;
  
`}`;

const CreateMetricContainer = styled(ControlContainer)`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 24px;
  gap: 10px;
  align-items: stretch;
  overflow-y: auto;
  box-sizing: border-box;
  width: 100%;
  max-width: auto;
  height: 100%;
  
  h2 {
    margin: 0;
    font-size: ${Size.fontSize.fontSize16};
    font-weight: 400;
  }
`}`;

const HelpIcon = styled.span`${() => css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  box-sizing: border-box;
  top: -1px;
  padding-top: 1px;
  margin-left: 4px;
  border-radius: 50%;
  background-color: ${Color.hover};
  color: ${Color.textDark};
  font-size: ${Size.fontSize.fontSize12};
  -webkit-user-select: none;
  position: relative;

  &::before {
    content: "?";
  }

  &:hover::after {
    content: attr(data-tooltip);
    position: absolute;
    left: 20px;
    color: ${Color.textDark};
    outline: ${Size.line.thickness} solid ${Color.line};
    background-color: ${Color.contentSurface};
    border-radius: 4px;
    padding: 2px 8px 1px;
    font-size: ${Size.fontSize.fontSize12};
    font-weight: 400;
    white-space: nowrap;
    z-index: 1;
    pointer-events: none;
  }
`}`;

// MARK: - Components

export type OnUploadCSVRequest = (metricSetName?: string) => void;

type MetricCreationModalBaseProps = {
  isPresentedState: StateObject<boolean>;
  refreshRecipes?: () => void;
  onUploadCSVRequest?: OnUploadCSVRequest;
  defaultMetricSetID?: RecipeID;
};

type MetricCreationModalProps =
  | ({
      node: ArtifactNode | null;
      eventSummaryID?: string | null;
    } & MetricCreationModalBaseProps)
  | ({ nodes: ArtifactNode[] } & MetricCreationModalBaseProps);

export const MetricCreationModal = (props: MetricCreationModalProps) => {
  const { refreshRecipes, onUploadCSVRequest } = props;

  const { currentOrganization, kindConfigurationForPattern, metricColorForID } = useContext(OrganizationContext);
  const { recipeMetricSetNodes, recipeMetricSetForID } = useContext(RecipeContext);
  const presentCreateMetricSetDialog = usePresentCreateMetricSetDialog();

  const context = useContext(ArtifactContext);
  if (!context) throw new Error("Component must be used within a ArtifactContextProvider");
  const { nodesByID } = context;

  const visibleRecipeMetricSets = useMemo(
    () => filterItems({ items: recipeMetricSetNodes, filter: recipeMetricVisibleFilter }),
    [recipeMetricSetNodes],
  );

  const sortedRecipeMetricSets = useMemo(
    () => sortItems({ items: visibleRecipeMetricSets, sortDescriptors: [recipeMetricSetSortedByName] }),
    [visibleRecipeMetricSets],
  );

  const hasMetricSets = useMemo(() => sortedRecipeMetricSets.length > 0, [sortedRecipeMetricSets]);

  const artifactObjects = useMemo(() => {
    if ("nodes" in props) {
      return props.nodes.flatMap((node) => {
        const artifactPath = node.artifact?.artifactPath;
        const inputNode = node.children?.get("input") ?? null;
        const outputNode = node.children?.get("output") ?? null;
        const eventSummaryID = node.artifact?.snapshots.at(-1)?.eventSummaryID;
        const outputContent = outputNode?.artifact?.snapshots.findLast(
          ({ eventSummaryID: id }) => id === eventSummaryID,
        )?.content;
        if (!artifactPath || !inputNode || !outputNode) return [];
        return [{ node, artifactPath, inputNode, outputNode, outputContent, eventSummaryID }];
      });
    }
    const artifactPath = props.node?.artifact?.artifactPath;
    const inputNode = props.node?.children?.get("input") ?? null;
    const outputNode = props.node?.children?.get("output") ?? null;
    const eventSummaryID = props.eventSummaryID ?? props.node?.artifact?.snapshots.at(-1)?.eventSummaryID;
    const outputContent = outputNode?.artifact?.snapshots.findLast(
      ({ eventSummaryID: id }) => id === eventSummaryID,
    )?.content;
    if (!artifactPath || !inputNode || !outputNode) return [];
    return [{ node: props.node, artifactPath, inputNode, outputNode, outputContent, eventSummaryID }];
  }, [props]);

  const [currentArtifactIndex, setCurrentArtifactIndex] = useState<number>(0);

  const goToPreviousArtifact = useCallback(() => {
    if (currentArtifactIndex > 0) {
      setCurrentArtifactIndex(currentArtifactIndex - 1);
    }
  }, [currentArtifactIndex]);

  const recipeMetricSetIDSelectionState = useStateObject<RecipeID>("");
  const [recipeMetricSetIDSelection] = useBinding(recipeMetricSetIDSelectionState);
  const recipeMetricSetSelection = useMemo(
    () => recipeMetricSetForID({ recipeID: recipeMetricSetIDSelection }),
    [recipeMetricSetForID, recipeMetricSetIDSelection],
  );

  const metricNameState = useStateObject("");
  const metricQuestionState = useStateObject("");
  const datasetSelectionState = useStateObject<DatasetSelectState>({
    kind: "placeholder",
    value: null,
    artifactCount: 0,
  });
  const [datasetSelection] = useBinding(datasetSelectionState);
  const selectedDatasetValue = datasetSelection.kind === "valid" ? datasetSelection.value : null;
  const evaluationModelSelectionState = useStateObject<EvaluationModelSelectState>({
    kind: "placeholder",
    value: null,
    model: null,
  });
  const [evaluationModelSelection] = useBinding(evaluationModelSelectionState);
  const selectedEvaluationModelValue =
    evaluationModelSelection.kind === "valid" ? evaluationModelSelection.value : null;
  const { defaultEvaluationModelID } = useEvaluationModels();
  const includeInput = useStateObject<CheckboxState>("off");
  const includeOutput = useStateObject<CheckboxState>("on");
  const isInputEvaluationDisabledDialogPresentedState = useStateObject(false);
  const [isInputEvaluationDisabledDialogPresented] = useBinding(isInputEvaluationDisabledDialogPresentedState);
  const disableEvaluateInput: CheckboxActionHandler = useCallback(
    (_previousValue, newValue) => {
      if (newValue !== "on") return;
      includeInput.wrappedValue = "off";
      isInputEvaluationDisabledDialogPresentedState.wrappedValue = true;
    },
    [includeInput, isInputEvaluationDisabledDialogPresentedState],
  );

  type PreviewFormValues = {
    metricQuestion: string;
    selectedDatasetValue: string | null;
    selectedEvaluationModelValue: string | null;
    previewEvaluationModelValue: string | null;
    includeInput: CheckboxState;
    includeOutput: CheckboxState;
  };
  const [previewFormValues, setPreviewFormValues] = useState<PreviewFormValues | null>(null);

  const [isWorking, setIsWorking] = useState(false);

  const [metricDefinition, setMetricDefinition] = useState<MetricDefinition | null>(null);
  const selectedMetricsState = useStateObject<Map<string, Metric>>(() => new Map());
  const [selectedMetrics] = useBinding(selectedMetricsState);

  const shouldAutoScrollToFirstHighlight = selectedMetrics.size > 0;

  const metricDefinitionForID = useCallback(
    (id: MetricID) => (metricDefinition?.id === id ? metricDefinition : null),
    [metricDefinition],
  );

  const [previewRecipe, setPreviewRecipe] = useState<Recipe | null>(null);
  const [metricsMap, setMetricsMap] = useState<Map<string, Metric>>(new Map());
  const previewArtifactObjects = useMemo(() => {
    const selectedDataset = selectedDatasetValue ? decodeArtifactSelector(selectedDatasetValue) : null;
    const selectedDatasetArtifactPattern = selectedDataset
      ? [...selectedDataset.artifactPath, { kind: "artifact" as const }]
      : [];

    const filteredArtifacts =
      selectedDatasetArtifactPattern.length === 0
        ? []
        : artifactObjects.filter(({ artifactPath }) =>
            artifactPathMatchesPattern(artifactPath, selectedDatasetArtifactPattern),
          );

    return filteredArtifacts.slice(0, Constants.previewArtifactsLimit);
  }, [artifactObjects, selectedDatasetValue]);

  const previousSelectedDatasetValueRef = useRef<string | null>(selectedDatasetValue);
  useEffect(() => {
    if (previousSelectedDatasetValueRef.current === selectedDatasetValue) return;
    previousSelectedDatasetValueRef.current = selectedDatasetValue;
    setCurrentArtifactIndex(0);
  }, [selectedDatasetValue]);

  const goToNextArtifact = useCallback(() => {
    if (currentArtifactIndex < previewArtifactObjects.length - 1) {
      setCurrentArtifactIndex(currentArtifactIndex + 1);
    }
  }, [currentArtifactIndex, previewArtifactObjects.length]);

  const previewMetric = useCallback(async () => {
    if (currentOrganization && metricQuestionState.wrappedValue && previewArtifactObjects.length > 0) {
      setIsWorking(true);
      const metricName = metricNameState.wrappedValue.trim() || undefined;
      const previewEvaluationModelValue = selectedEvaluationModelValue ?? defaultEvaluationModelID;
      try {
        const previewRecipeResponse = await fetchPreviewRecipe({
          orgID: currentOrganization?.id,
          metricName,
          question: metricQuestionState.wrappedValue,
          evaluationModelID: previewEvaluationModelValue ?? undefined,
          artifactSelectors: previewArtifactObjects.map(({ artifactPath, eventSummaryID }) => ({
            tags: [],
            artifactPath: artifactPath,
            eventSummaryIDs: eventSummaryID ? [eventSummaryID] : [],
            generationIDs: [],
          })),
          evaluateChildArtifactPaths: [
            ...(includeInput.wrappedValue === "on" ? [[{ id: "input" }]] : []),
            ...(includeOutput.wrappedValue === "on" ? [[{ id: "output" }]] : []),
          ],
        });
        const recipeName = metricName || previewRecipeResponse.metricDefinition.name;
        metricNameState.wrappedValue = recipeName;

        const now = new Date().toISOString();
        setPreviewRecipe(
          recipeMetricSetSelection
            ? {
                ...recipeMetricSetSelection.recipe,
                updateTimestamp: now,
                steps: recipeMetricSetSelection.recipe.steps.concat(previewRecipeResponse.steps),
              }
            : {
                id: crypto.randomUUID(),
                name: "",
                creationTimestamp: now,
                updateTimestamp: now,
                triggers: [],
                steps: previewRecipeResponse.steps,
              },
        );
        setMetricDefinition(previewRecipeResponse.metricDefinition);

        setMetricsMap(
          new Map<string, Metric>(
            previewRecipeResponse.metrics?.map(([artifactPath, metric]) => [encodeArtifactPath(artifactPath), metric]),
          ),
        );

        setPreviewFormValues({
          metricQuestion: metricQuestionState.wrappedValue,
          selectedDatasetValue,
          selectedEvaluationModelValue,
          previewEvaluationModelValue,
          includeInput: includeInput.wrappedValue,
          includeOutput: includeOutput.wrappedValue,
        });
      } finally {
        setIsWorking(false);
      }
    }
  }, [
    currentOrganization,
    includeInput,
    includeOutput,
    metricNameState,
    metricQuestionState,
    previewArtifactObjects,
    recipeMetricSetSelection,
    defaultEvaluationModelID,
    selectedDatasetValue,
    selectedEvaluationModelValue,
  ]);

  useEffect(() => {
    const metric = metricsMap.get(
      encodeArtifactPath(previewArtifactObjects.at(currentArtifactIndex)?.artifactPath ?? []),
    );
    if (!metric) return undefined;
    selectedMetricsState.wrappedValue = new Map([[metric.id, metric]]);
  }, [currentArtifactIndex, metricsMap, selectedMetricsState, previewArtifactObjects]);

  const contentWidget: ContentWidget = {
    id: "",
    kind: WidgetKind.content,
    x: 0,
    y: 0,
    width: 12,
    height: 6,
    showsContext: true,
    // We can re-use this widget for both input and output content because of empty `childArtifactPath`
    childArtifactPath: [],
  };

  const [isPresented, setIsPresented] = useBinding(props.isPresentedState);

  const resetAllValues = useCallback(() => {
    setPreviewFormValues(null);
    metricNameState.wrappedValue = "";
    metricQuestionState.wrappedValue = "";
    datasetSelectionState.wrappedValue = { kind: "placeholder", value: null, artifactCount: 0 };
    evaluationModelSelectionState.wrappedValue = { kind: "placeholder", value: null, model: null };
    includeInput.wrappedValue = "off";
    includeOutput.wrappedValue = "on";
    isInputEvaluationDisabledDialogPresentedState.wrappedValue = false;
    setCurrentArtifactIndex(0);
    selectedMetricsState.wrappedValue = new Map();
    setMetricDefinition(null);
    setPreviewRecipe(null);
    setMetricsMap(new Map());
    recipeMetricSetIDSelectionState.wrappedValue = "";
  }, [
    includeInput,
    includeOutput,
    datasetSelectionState,
    evaluationModelSelectionState,
    metricNameState,
    metricQuestionState,
    selectedMetricsState,
    recipeMetricSetIDSelectionState,
    isInputEvaluationDisabledDialogPresentedState,
  ]);

  useEffect(() => {
    if (!isPresented) {
      resetAllValues();
    }
  }, [isPresented, resetAllValues]);

  useEffect(() => {
    if (!isPresented) return;
    recipeMetricSetIDSelectionState.wrappedValue = props.defaultMetricSetID ?? "";
  }, [isPresented, props.defaultMetricSetID, recipeMetricSetIDSelectionState]);

  const isPreviewFresh = useMemo(() => {
    if (!previewFormValues || !previewRecipe) return false;
    return (
      previewFormValues.metricQuestion.trim() === metricQuestionState.wrappedValue.trim() &&
      previewFormValues.selectedDatasetValue === selectedDatasetValue &&
      previewFormValues.selectedEvaluationModelValue === selectedEvaluationModelValue &&
      previewFormValues.includeInput === includeInput.wrappedValue &&
      previewFormValues.includeOutput === includeOutput.wrappedValue
    );
  }, [
    previewFormValues,
    previewRecipe,
    metricQuestionState.wrappedValue,
    selectedDatasetValue,
    selectedEvaluationModelValue,
    includeInput.wrappedValue,
    includeOutput.wrappedValue,
  ]);

  const saveMetric = useCallback(async () => {
    if (isInputEvaluationDisabledDialogPresentedState.wrappedValue) return;
    if (!currentOrganization?.id) return;
    setIsWorking(true);
    const metricName = metricNameState.wrappedValue.trim();
    try {
      let currentMetricDefinition = metricDefinition;
      let currentPreviewRecipe = previewRecipe;

      if (!isPreviewFresh) {
        const previewRecipeResponse = await fetchPreviewRecipe({
          orgID: currentOrganization.id,
          metricName: metricName || undefined,
          question: metricQuestionState.wrappedValue,
          evaluationModelID: selectedEvaluationModelValue ?? undefined,
          artifactSelectors: previewArtifactObjects.map(({ artifactPath, eventSummaryID }) => ({
            tags: [],
            artifactPath,
            eventSummaryIDs: eventSummaryID ? [eventSummaryID] : [],
            generationIDs: [],
          })),
          evaluateChildArtifactPaths: [
            ...(includeInput.wrappedValue === "on" ? [[{ id: "input" }]] : []),
            ...(includeOutput.wrappedValue === "on" ? [[{ id: "output" }]] : []),
          ],
        });
        currentMetricDefinition = previewRecipeResponse.metricDefinition;
        const now = new Date().toISOString();
        currentPreviewRecipe = recipeMetricSetSelection
          ? {
              ...recipeMetricSetSelection.recipe,
              updateTimestamp: now,
              steps: recipeMetricSetSelection.recipe.steps.concat(previewRecipeResponse.steps),
            }
          : {
              id: crypto.randomUUID(),
              name: "",
              creationTimestamp: now,
              updateTimestamp: now,
              triggers: [],
              steps: previewRecipeResponse.steps,
            };
      }

      if (!currentMetricDefinition || !currentPreviewRecipe) return;

      const recipeName = metricName || currentMetricDefinition.name;
      metricNameState.wrappedValue = recipeName;

      await fetchRecordMetricDefinition({
        orgID: currentOrganization.id,
        metricDefinition: {
          ...currentMetricDefinition,
          name: recipeName,
          description: metricQuestionState.wrappedValue,
          group: currentPreviewRecipe.name,
        },
      });

      const steps = currentPreviewRecipe.steps.filter(
        (step) =>
          (step.inputs.some(
            (input) =>
              input.kind === RecipeStepInputKind.artifact && input.input?.childArtifactPath?.at(0)?.id === "input",
          ) &&
            includeInput.wrappedValue === "on") ||
          (step.inputs.some(
            (input) =>
              input.kind === RecipeStepInputKind.artifact && input.input?.childArtifactPath?.at(0)?.id === "output",
          ) &&
            includeOutput.wrappedValue === "on"),
      );

      await fetchRecordRecipe({
        orgID: currentOrganization.id,
        recipe: {
          id: currentPreviewRecipe.id,
          name: currentPreviewRecipe.name,
          creationTimestamp: currentPreviewRecipe.creationTimestamp,
          stepUpdates: steps,
          triggerUpdates: currentPreviewRecipe.triggers,
          updateTimestamp: new Date().toISOString(),
        },
      });
      setIsPresented(false);
    } catch (error) {
      console.error("Error saving metric:", error);
    } finally {
      refreshRecipes?.();
      setIsWorking(false);
    }
  }, [
    setIsPresented,
    currentOrganization,
    refreshRecipes,
    metricNameState,
    metricQuestionState,
    includeInput,
    includeOutput,
    selectedEvaluationModelValue,
    previewArtifactObjects,
    recipeMetricSetSelection,
    isPreviewFresh,
    previewRecipe,
    metricDefinition,
    isInputEvaluationDisabledDialogPresentedState,
  ]);

  const createMetricSet = useCallback(
    async (previousRecipeID: string) => {
      if (!currentOrganization?.id) return;
      const recipe = await presentCreateMetricSetDialog({
        orgID: currentOrganization.id,
        isFirstMetricSet: !hasMetricSets,
      });
      if (!recipe) {
        recipeMetricSetIDSelectionState.wrappedValue = previousRecipeID;
        return;
      }
      recipeMetricSetIDSelectionState.wrappedValue = recipe.id;
    },
    [currentOrganization?.id, presentCreateMetricSetDialog, hasMetricSets, recipeMetricSetIDSelectionState],
  );

  const canEvaluate =
    !!metricQuestionState.wrappedValue.trim() &&
    previewArtifactObjects.length > 0 &&
    !isWorking &&
    (includeInput.wrappedValue === "on" || includeOutput.wrappedValue === "on");

  const canSave: boolean = useMemo(
    () =>
      !isWorking &&
      !isInputEvaluationDisabledDialogPresented &&
      !!metricNameState.wrappedValue.trim() &&
      !!metricQuestionState.wrappedValue.trim() &&
      !!selectedDatasetValue &&
      (includeInput.wrappedValue === "on" || includeOutput.wrappedValue === "on"),
    [
      isWorking,
      isInputEvaluationDisabledDialogPresented,
      metricNameState.wrappedValue,
      metricQuestionState.wrappedValue,
      selectedDatasetValue,
      includeInput.wrappedValue,
      includeOutput.wrappedValue,
    ],
  );

  const inputKindName = useMemo(
    () =>
      kindConfigurationForPattern([{ kind: "dataset" }, { kind: "artifact" }, { id: "input" }], "evaluate").displayName,
    [kindConfigurationForPattern],
  );
  const outputKindName = useMemo(
    () =>
      kindConfigurationForPattern([{ kind: "dataset" }, { kind: "artifact" }, { id: "output" }], "evaluate")
        .displayName,
    [kindConfigurationForPattern],
  );

  return (
    <ModalPanel isPresentedState={props.isPresentedState} presentation="fullscreen">
      <CreateMetricContainer isEnabled={!isWorking} prominence="primary">
        <h2>Create New Metric</h2>
        <GridStack>
          <QuestionColumn>
            <DatasetSelect
              selectionState={datasetSelectionState}
              label="Dataset to Preview"
              placeholder="Choose a Dataset"
            />
            <EvaluationModelSelect label={"Judge Model (optional)"} selectionState={evaluationModelSelectionState} />
            <LabeledControl>
              <Label>
                Metric Set
                <HelpIcon
                  data-tooltip={"Metric sets help you group similar metrics so they can be evaluated together."}
                />
              </Label>
              <PopupButton size="large" selectionState={recipeMetricSetIDSelectionState}>
                <PopupItem title="None" value="" />
                {hasMetricSets && <PopupDivider />}
                {sortedRecipeMetricSets.map((node) => (
                  <PopupItem key={node.id} value={node.item.recipe.id} title={node.item.recipe.name} />
                ))}
                <PopupDivider />
                <PopupItem title="Create Metric Set…" action={createMetricSet} />
              </PopupButton>
            </LabeledControl>
            <LabeledControl>
              <Label>Metric Display Label</Label>
              <TextField
                style={{
                  backgroundColor: Color.surfaceOffWhite,
                }}
                valueState={metricNameState}
                placeholder="Give your new metric a name"
                autoCapitalize="words"
              />
            </LabeledControl>
            <LabeledControl>
              <Label>Metric Question</Label>
              <TextField
                style={{
                  backgroundColor: Color.surfaceOffWhite,
                }}
                valueState={metricQuestionState}
                placeholder='Input a single yes/no question.
                Example: Does the summary include the vital signs? or "Is the clinical note in SOAP format?"'
                isMultiline
              />
            </LabeledControl>
          </QuestionColumn>
          <VStack>
            <HStack>
              <ContentColumn>
                <CheckboxButton selectionState={includeInput} action={disableEvaluateInput}>
                  {inputKindName}
                </CheckboxButton>
                <WidgetContainer>
                  {previewArtifactObjects.length > 1 && (
                    <CarouselButton style={{ left: "-10px" }} onClick={goToPreviousArtifact}>
                      &lt;
                    </CarouselButton>
                  )}
                  <WidgetComponent
                    key={previewArtifactObjects.at(currentArtifactIndex)?.inputNode?.id}
                    widget={contentWidget}
                    currentNode={previewArtifactObjects.at(currentArtifactIndex)?.inputNode ?? null}
                    artifactSelector={null}
                    activeEventSummaryID={previewArtifactObjects.at(currentArtifactIndex)?.eventSummaryID ?? null}
                    nodes={null}
                    nodesByID={nodesByID}
                    currentSelectionState={undefined}
                    selectedMetricsState={selectedMetricsState}
                    commonArtifactPath={previewArtifactObjects.at(currentArtifactIndex)?.artifactPath}
                    organizationSlug={null}
                    metricDefinitionForID={metricDefinitionForID}
                    metricColorForID={metricColorForID}
                    kindConfigurationForPattern={kindConfigurationForPattern}
                    autoScrollToFirstHighlight={shouldAutoScrollToFirstHighlight}
                  />
                </WidgetContainer>
              </ContentColumn>
              <ContentColumn>
                <CheckboxButton selectionState={includeOutput}>{outputKindName}</CheckboxButton>
                <WidgetContainer>
                  {previewArtifactObjects.length > 1 && (
                    <CarouselButton style={{ right: "-10px" }} onClick={goToNextArtifact}>
                      &gt;
                    </CarouselButton>
                  )}
                  <WidgetComponent
                    key={previewArtifactObjects.at(currentArtifactIndex)?.outputNode?.id}
                    widget={contentWidget}
                    currentNode={previewArtifactObjects.at(currentArtifactIndex)?.outputNode ?? null}
                    artifactSelector={null}
                    activeEventSummaryID={previewArtifactObjects.at(currentArtifactIndex)?.eventSummaryID ?? null}
                    nodes={null}
                    nodesByID={nodesByID}
                    currentSelectionState={undefined}
                    selectedMetricsState={selectedMetricsState}
                    commonArtifactPath={previewArtifactObjects.at(currentArtifactIndex)?.artifactPath}
                    organizationSlug={null}
                    metricDefinitionForID={metricDefinitionForID}
                    metricColorForID={metricColorForID}
                    kindConfigurationForPattern={kindConfigurationForPattern}
                    autoScrollToFirstHighlight={shouldAutoScrollToFirstHighlight}
                  />
                </WidgetContainer>
              </ContentColumn>
            </HStack>
          </VStack>
        </GridStack>
        {Array.from(selectedMetricsState.wrappedValue.values()).map((metric) => (
          <AnswerContainer key={metric.id}>
            <Label>Answer</Label>
            <AnswerValue>{valueForMetricKeyPath({ metric, metricDefinitionForID }).display ?? "None"}</AnswerValue>
          </AnswerContainer>
        ))}
        <ButtonHStack>
          {isWorking && <progress style={{ width: "100%" }} />}
          {onUploadCSVRequest && (
            <Button action={onUploadCSVRequest} prominence="secondary" isEnabled={!isWorking}>
              Bulk upload
            </Button>
          )}
          <Button action={previewMetric} prominence="secondary" isEnabled={canEvaluate && !isWorking}>
            Preview Results
          </Button>
          <Button
            action={saveMetric}
            keyEquivalent={isInputEvaluationDisabledDialogPresented ? undefined : "Enter"}
            isEnabled={canSave}
          >
            Save Metric
          </Button>
        </ButtonHStack>
      </CreateMetricContainer>
      {typeof window !== "undefined" &&
        createPortal(
          <ConfirmationDialog
            isPresentedState={isInputEvaluationDisabledDialogPresentedState}
            title="Evaluate Input is currently unavailable"
            message="Evaluating input or both and expected is not available in the open sourced version."
            cancelLabel="Close"
            confirmLabel="OK"
            isDangerous={false}
          />,
          document.body,
        )}
    </ModalPanel>
  );
};
