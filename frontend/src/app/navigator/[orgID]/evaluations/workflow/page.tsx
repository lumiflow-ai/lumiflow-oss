"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { use, useCallback, useContext, useEffect, useMemo, useState } from "react";
import styled, { css } from "styled-components";

import { fetchRecordRecipe, fetchRunRecipes } from "@/generated/serverEndpoints";
import { type Metric, type MetricID, type RecipeID, RecipeTriggerKind } from "@/generated/serverTypes";

import { useBinding, useStateObject } from "@/library/StateObject";
import { useStepWorkflow, type WorkflowStep } from "@/library/useStepWorkflow";

import { decodeArtifactSelector, encodeArtifactPathPattern } from "@/model/artifactPath";
import { useDatasets } from "@/model/datasets";
import { useEvaluationModels } from "@/model/evaluationModels";
import { deriveEvaluationStatus, type EvaluationStatus } from "@/model/evaluationStatus";
import { filterItems, type ItemNode } from "@/model/keyPath";

import { ContentHeader } from "@/components/ContentHeader";
import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import { RecipeContext, type RecipeMetric, recipeMetricAccessibleFilter } from "@/components/contexts/RecipeContext";
import { DatasetSelect, type DatasetSelectState } from "@/components/DatasetSelect";
import { EvaluationContent } from "@/components/EvaluationContent";
import { EvaluationModelSelect, type EvaluationModelSelectState } from "@/components/EvaluationModelSelect";
import { EvaluationReport } from "@/components/EvaluationReport";
import { EvaluationStatusMessage } from "@/components/EvaluationStatus";
import { MetricSetSelect } from "@/components/MetricSetSelect";
import { NavigationSidebar } from "@/components/NavigationSidebar";
import {
  Button,
  Color,
  Font,
  NavigationContent,
  NavigationStack,
  type SidebarState,
  Size,
  TextField,
  Toolbar,
  ToolbarItem,
} from "@/components/ui";

import { invalidateContentArtifacts } from "@/app/navigator/_shared/artifacts";
import { ArtifactContext } from "@/app/navigator/_shared/context";

const AUTO_REFRESH_INTERVAL_MS = 10_000;
const stepParam = "step";
const evalNameParam = "name";
const datasetParam = "dataset";
const metricSetParam = "metricset";
const evalGroupParam = "evalGroup";

const Page = styled.div`${() => css`
  height: 100%;
  margin-bottom: 40px;
`}`;

const PageContent = styled.div`${() => css`
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 6%;
  height: 100%;
`}`;
const ReviewContainer = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  height: 100%;
`}`;

const StepPanel = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  width: 392px;
  text-align: center;
  overflow: visible;
`}`;

const StepMessage = styled.div`${() => css`
  font-size: ${Size.fontSize.fontSize12};
  color: ${Color.mutedText};
  font-family: ${Font.ibmPlexSans};
  margin: 10px 20px;
`}`;

const ButtonInner = styled.span`${() => css`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`}`;

const IconContainer = styled.div`${() => css`
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background: ${Color.surfaceOffWhite};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  align-self: center;
`}`;

const Title = styled.h2`${() => css`
  font-size: ${Size.fontSize.fontSize20};
  font-weight: 400;
  line-height: 1.1;
  margin: 0;
  color: ${Color.textDark};
  font-family: ${Font.inter};
`}`;

const Subtitle = styled.p`${() => css`
  font-family: ${Font.ibmPlexSans};
  font-size: ${Size.fontSize.fontSize16};
  color: ${Color.textDark};
  font-weight: 400;
  line-height: 1.3;
  margin:0px 0px 12px;
`}`;

const Info = styled.p`${() => css`
  font-size: ${Size.fontSize.fontSize12};
  color: ${Color.buttonNeutralFill.background};
  font-weight: 500;
  line-height: 1.1;
  margin:0px 0px 4px;
`}`;

const Separator = styled.div`${() => css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin: 8px 0px;
`}`;

const Or = styled.p`${() => css`
  font-size: ${Size.fontSize.fontSize12};
  color: ${Color.buttonNeutralFill.background};
  font-weight: 500;
  line-height: 1.1;
  margin: 0;
`}`;

const LineBreak = styled.div`${() => css`
  width: 171.5px;
  border: 0.5px solid ${Color.tableHeader};
`}`;

const BottomHStack = styled.div`${() => css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  width: 100%;
`}`;

const TextVStack = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  width: 100%;
`}`;

const TextContainer = styled.div`${() => css`
  width: 100%;
  height: 40px;
  background-color: ${Color.surfaceOffWhite};
  border: 1px solid ${Color.line};
  display: flex;
  align-items: center;
  justify-content: start;
  border-radius: 12px;
  `}`;

const ReviewText = styled.p`${() => css`
  color: ${Color.mutedText};
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 400;
  line-height: 1.1;
  padding: 10px 12px;
`}`;
const ReviewLabel = styled.p`${() => css`
  color: ${Color.textDark};
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 500;
  line-height: 1.1;
  margin: 0px;
  align-self: start;
`}`;

const ReportDateLabel = styled.div`${() => css`
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 500;
  line-height: 1.2;
  color: ${Color.textDark};
  background: ${Color.surfaceOffWhite};
  padding: 12px 12px;
  border-radius: 6px;
`}`;

const ReportDate = styled.span`${() => css`
  color: ${Color.mutedText};
`}`;

const createNoOp = () => {};

export default function EvaluationWorkflowPage(props: {
  searchParams: Promise<{
    step?: string;
    name?: string;
    dataset?: string;
    metricset?: string;
    evalGroup?: string;
  }>;
}) {
  const router = useRouter();
  const searchParams = use(props.searchParams);
  const stepFromURL = Number(searchParams[stepParam] ?? -1);
  const datasetName = useDatasets();

  // MARK: - Context

  const { currentOrganization, organizationSlug, kindConfigurationForPattern, metricDefinitionForID } =
    useContext(OrganizationContext);

  const artifactsContext = useContext(ArtifactContext);
  if (!artifactsContext) throw new Error("Component must be used within a ArtifactContextProvider");
  const { isLoading: isLoadingArtifacts, nodesByID } = artifactsContext;

  const {
    recipes: availableRecipes,
    recipeMap,
    evaluationMap,
    isLoading: isLoadingRecipes,
    refresh,
    recipeMetricSetNodeForID,
  } = useContext(RecipeContext);
  const { evaluationModels } = useEvaluationModels();

  // MARK: - State: Layout and Navigation

  const navigationSidebarState = useStateObject<SidebarState>("open");
  const [currentNavigationSidebarState, setCurrentNavigationSidebarState] = useBinding(navigationSidebarState);
  const modelDisplayNameForID = useMemo(
    () => new Map(evaluationModels.map((model) => [model.id, model.displayName])),
    [evaluationModels],
  );

  // MARK: - State: Step 1 (Name)

  const evaluationNameState = useStateObject(searchParams[evalNameParam] ?? "");
  const [evaluationName] = useBinding(evaluationNameState);
  const [hasStartedWorkflow, setHasStartedWorkflow] = useState(
    Boolean(searchParams[evalNameParam] || searchParams[evalGroupParam]),
  );

  // MARK: - State: Step 2 (Dataset)

  const datasetSelectionState = useStateObject<DatasetSelectState>(() => {
    const dataset = searchParams[datasetParam];
    if (!dataset) {
      return {
        kind: "placeholder",
        value: null,
        artifactCount: 0,
      };
    }
    return {
      kind: "valid",
      value: dataset,
      artifactCount: 0,
    };
  });
  const [datasetSelection] = useBinding(datasetSelectionState);

  // MARK: - State: Step 3 (Metric Sets)

  const metricSetSelectionState = useStateObject<Set<RecipeID>>(() => {
    if (!searchParams[metricSetParam]) return new Set();
    return new Set(searchParams[metricSetParam]?.split(",") as RecipeID[]);
  });
  const [selectedMetricSetIDs] = useBinding(metricSetSelectionState);
  const evaluationModelSelectionState = useStateObject<EvaluationModelSelectState>({
    kind: "placeholder",
    value: null,
    model: null,
  });

  // MARK: - State: Step 4 & 5 (Content & Report)
  const generatedAt = useMemo(() => new Date(), []);

  // Evaluation Execution
  const [isRunningEvaluation, setIsRunningEvaluation] = useState(false);
  const [createdEvaluationGroupID, setCreatedEvaluationGroupID] = useState<string | null>(
    searchParams[evalGroupParam] ?? null,
  );

  // Content selection
  const selectedItemNodeState = useStateObject<ItemNode | null>(null);
  const selectedMetricsState = useStateObject<Map<MetricID, Metric>>(() => new Map());
  const lastSelectedMetricsState = useStateObject<MetricID[]>([]);

  // Reset Content/Report Selections on Evaluation Change

  useEffect(() => {
    if (!createdEvaluationGroupID) return;
    selectedItemNodeState.wrappedValue = null;
    selectedMetricsState.wrappedValue = new Map();
    lastSelectedMetricsState.wrappedValue = [];
  }, [createdEvaluationGroupID, selectedItemNodeState, selectedMetricsState, lastSelectedMetricsState]);

  const evaluation = createdEvaluationGroupID ? evaluationMap.get(createdEvaluationGroupID) : undefined;
  // Evaluation Data for Content/Report Steps

  const datasets = useMemo(
    () =>
      (evaluation?.artifactPathPatterns ?? []).flatMap((pattern) => {
        const lastComponent = pattern.at(-1);
        if (!lastComponent || !("kind" in lastComponent) || lastComponent.kind !== "artifact" || lastComponent.id) {
          return [];
        }

        const encodedArtifactPath = encodeArtifactPathPattern(pattern.slice(0, pattern.length - 1));
        const node = nodesByID.get(encodedArtifactPath)?.at(0);
        return node ? [node] : [];
      }),
    [evaluation?.artifactPathPatterns, nodesByID],
  );

  const artifacts = useMemo(
    () => datasets.flatMap((datasetNode) => Array.from(datasetNode.children.values())),
    [datasets],
  );
  const selectedDatasetName = useMemo(() => {
    if (datasetSelection.kind !== "valid") return null;
    return datasetName.find((d) => d.encodedArtifactPath === datasetSelection.value)?.name;
  }, [datasetName, datasetSelection]);
  const evaluationRecipeIDs = evaluation?.recipeIDs ?? [];
  const evaluationRecipes = useMemo(
    () =>
      evaluationRecipeIDs.flatMap((recipeID) => {
        const recipe = recipeMap.get(recipeID);
        return recipe ? [recipe] : [];
      }),
    [evaluationRecipeIDs, recipeMap],
  );

  const recipeMetricNodes = useMemo(
    () =>
      evaluationRecipeIDs.flatMap(
        (recipeID) => recipeMetricSetNodeForID({ recipeID })?.allChildren<RecipeMetric>() ?? [],
      ),
    [evaluationRecipeIDs, recipeMetricSetNodeForID],
  );
  const isReviewLoading = useMemo(() => {
    return (
      datasetSelection.kind === "valid" &&
      (!datasetName?.length || !availableRecipes?.length || datasetSelection.artifactCount === 0)
    );
  }, [datasetName, availableRecipes, datasetSelection]);

  useEffect(() => {
    if (datasetSelection.kind !== "valid") return;

    const datasetPath = decodeArtifactSelector(datasetSelection.value).artifactPath;
    const encodedPath = encodeArtifactPathPattern(datasetPath);

    const datasetNode = nodesByID.get(encodedPath)?.[0];

    if (!datasetNode) return;

    const count = datasetNode.children.size;

    if (datasetSelection.artifactCount !== count) {
      datasetSelectionState.wrappedValue = {
        ...datasetSelection,
        artifactCount: count,
      };
    }
  }, [datasetSelection, nodesByID, datasetSelectionState]);
  const availableRecipeMetrics = useMemo(
    () =>
      filterItems({
        items: recipeMetricNodes,
        filter: recipeMetricAccessibleFilter,
      }).map(({ item }) => item),
    [recipeMetricNodes],
  );

  const metricDefinitions = useMemo(
    () => availableRecipeMetrics.flatMap(({ metricDefinition }) => (metricDefinition ? [metricDefinition] : [])),
    [availableRecipeMetrics],
  );
  const totalSelectedMetrics = useMemo(() => {
    let count = 0;
    for (const recipeID of selectedMetricSetIDs) {
      const setNode = recipeMetricSetNodeForID({ recipeID });
      if (!setNode) continue;
      for (const child of setNode.allChildren<RecipeMetric>()) {
        if (child.item?.isEnabled) count++;
      }
    }
    return count;
  }, [selectedMetricSetIDs, recipeMetricSetNodeForID]);

  const evaluationStatus = useMemo<EvaluationStatus>(() => {
    if (isLoadingArtifacts || isLoadingRecipes || !evaluation) return "Evaluating";

    return deriveEvaluationStatus({
      datasetNodes: datasets,
      evaluation,
      recipeMetricSetNodeForID,
    });
  }, [datasets, evaluation, isLoadingArtifacts, isLoadingRecipes, recipeMetricSetNodeForID]);

  // Auto-Refresh While Evaluation Is Running
  useEffect(() => {
    if (evaluationStatus !== "Evaluating") return;
    if (!createdEvaluationGroupID) return;

    const timeoutID = window.setTimeout(() => {
      void (async () => {
        await refresh();
        if (currentOrganization?.id) {
          await invalidateContentArtifacts(currentOrganization.id);
        }
      })();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearTimeout(timeoutID);
    };
  }, [createdEvaluationGroupID, currentOrganization, evaluationStatus, refresh]);

  // MARK: - State: Workflow Progression

  const [_workflowResetCounter, setWorkflowResetCounter] = useState(0);
  const workflowSteps = useMemo<WorkflowStep[]>(
    () => [
      {
        id: "prepare",
        title: "Prepare",
        description: "Add your Data",
        icon: "/assets/adminPanel/prepare-nav-icon.svg",
        condition: () => datasetSelection.kind === "valid",
      },
      {
        id: "measure",
        title: "Measure",
        description: "Define your Requirements",
        icon: "/assets/adminPanel/measure-nav-icon.svg",
        condition: () => selectedMetricSetIDs.size > 0,
      },
      {
        id: "evaluate",
        title: "Evaluate",
        description: "Run AI Evaluation",
        icon: "/assets/adminPanel/evaluate-nav-icon.svg",
        condition: () => selectedMetricSetIDs.size > 0,
      },
      {
        id: "review",
        title: "Review",
        description: "Human in the Loop Review",
        icon: "/assets/adminPanel/review-nav-icon.svg",
      },
      {
        id: "report",
        title: "Report",
        description: "View your Report",
        icon: "/assets/adminPanel/report-nav-icon.svg",
      },
      {
        id: "complete",
        title: "",
        description: "Completed",
        condition: () => evaluationStatus === "Done",
        icon: "/assets/adminPanel/complete-nav-icon.svg",
      },
    ],
    [datasetSelection, evaluationStatus, selectedMetricSetIDs.size],
  );

  const {
    currentStep,
    currentStepIndex,
    isOnLastStep,
    isConditionMetForStep,
    moveToPreviousStep,
    moveToNextStep,
    canMoveToPreviousStep,
    canMoveToNextStep,
  } = useStepWorkflow({
    steps: workflowSteps,
    initialStepIndex: stepFromURL >= 0 ? stepFromURL : -1,
  });

  const evaluateStepIndex = workflowSteps.findIndex((step) => step.id === "evaluate");
  const reviewStepIndex = workflowSteps.findIndex((step) => step.id === "review");
  const workflowLineCurrentStepIndex =
    evaluationStatus === "Evaluating" && reviewStepIndex >= 0 && currentStepIndex >= reviewStepIndex
      ? evaluateStepIndex
      : currentStepIndex;

  // MARK: - Actions: Global Controls

  const resetWorkflow = useCallback(() => {
    evaluationNameState.wrappedValue = "";
    datasetSelectionState.wrappedValue = {
      kind: "placeholder",
      value: null,
      artifactCount: 0,
    };
    metricSetSelectionState.wrappedValue = new Set();
    evaluationModelSelectionState.wrappedValue = {
      kind: "placeholder",
      value: null,
      model: null,
    };
    selectedItemNodeState.wrappedValue = null;
    selectedMetricsState.wrappedValue = new Map();
    lastSelectedMetricsState.wrappedValue = [];
    setCreatedEvaluationGroupID(null);
    setIsRunningEvaluation(false);
    setHasStartedWorkflow(false);
    setWorkflowResetCounter((previous) => previous + 1);
    router.replace(window.location.pathname, { scroll: false });
  }, [
    datasetSelectionState,
    evaluationNameState,
    evaluationModelSelectionState,
    lastSelectedMetricsState,
    metricSetSelectionState,
    selectedItemNodeState,
    selectedMetricsState,
    router,
  ]);

  const toggleNavigationSidebar = useCallback(() => {
    setCurrentNavigationSidebarState((previous) => {
      if (previous === "open") return "collapsed";
      if (previous === "collapsed") return "open";
      return previous;
    });
  }, [setCurrentNavigationSidebarState]);

  // MARK: - Actions: Step 3 (Run Evaluation)

  const runEvaluation = useCallback(async () => {
    if (isRunningEvaluation) return null;
    if (!currentOrganization) {
      console.error("Missing organization for evaluation creation");
      return null;
    }

    if (!evaluationName.trim() || datasetSelection.kind !== "valid" || selectedMetricSetIDs.size === 0) {
      return null;
    }

    const selectedRecipes = availableRecipes.filter((recipe) => selectedMetricSetIDs.has(recipe.id));
    if (selectedRecipes.length === 0) {
      console.error("No matching requirements found for evaluation creation.");
      return null;
    }

    const evaluationModelSelection = evaluationModelSelectionState.wrappedValue;
    const evaluationModelID = evaluationModelSelection.kind === "valid" ? evaluationModelSelection.value : undefined;

    setIsRunningEvaluation(true);

    try {
      const selectedDatasetPath = decodeArtifactSelector(datasetSelection.value).artifactPath;
      const artifactPathPattern = [...selectedDatasetPath, { kind: "artifact" }];
      const timestamp = new Date().toISOString();
      const evaluationGroupID = crypto.randomUUID();
      const newTrigger = {
        id: crypto.randomUUID(),
        evaluationGroupID,
        name: evaluationName.trim(),
        kind: RecipeTriggerKind.artifactPath,
        artifactPathPattern,
        creationTimestamp: timestamp,
        updateTimestamp: timestamp,
      };

      await Promise.all(
        selectedRecipes.map(async (recipe) => {
          return await fetchRecordRecipe({
            orgID: currentOrganization.id,
            recipe: {
              id: recipe.id,
              triggerUpdates: [newTrigger],
            },
          });
        }),
      );

      await refresh();

      try {
        await fetchRunRecipes({
          orgID: currentOrganization.id,
          recipeIDs: selectedRecipes.map((recipe) => recipe.id),
          evaluationGroupIDs: [evaluationGroupID],
          evaluationModelID,
        });
      } catch (error) {
        console.warn("Failed to schedule some recipes for evaluation:", error);
      }

      setCreatedEvaluationGroupID(evaluationGroupID);
      const params = new URLSearchParams(window.location.search);
      params.set(evalGroupParam, evaluationGroupID);
      const query = params.toString();
      router.replace(query ? `?${query}` : "", { scroll: false });
      return evaluationGroupID;
    } catch (error) {
      console.error("Failed to create evaluation:", error);
      return null;
    } finally {
      setIsRunningEvaluation(false);
    }
  }, [
    availableRecipes,
    currentOrganization,
    datasetSelection,
    evaluationName,
    evaluationModelSelectionState,
    refresh,
    selectedMetricSetIDs,
    isRunningEvaluation,
    router.replace,
  ]);

  // MARK: - Actions: Navigation Between Steps

  const goToEvaluations = useCallback(() => {
    if (!organizationSlug) return;
    if (createdEvaluationGroupID) {
      router.push(`/app/${organizationSlug}/evaluations/${createdEvaluationGroupID}`);
      return;
    }
    router.push(`/app/${organizationSlug}/evaluations`);
  }, [createdEvaluationGroupID, organizationSlug, router]);

  const currentStepID = currentStep?.id;

  const handleNext = useCallback(async () => {
    if ((!canMoveToNextStep && !isOnLastStep) || !isConditionMetForStep()) return;

    if (currentStepID === "evaluate" && !createdEvaluationGroupID) {
      const evaluationID = await runEvaluation();
      if (!evaluationID) return;
    }

    if (isOnLastStep) {
      goToEvaluations();
      return;
    }

    moveToNextStep();
  }, [
    canMoveToNextStep,
    createdEvaluationGroupID,
    currentStepID,
    goToEvaluations,
    isOnLastStep,
    isConditionMetForStep,
    moveToNextStep,
    runEvaluation,
  ]);
  const handleBack = useCallback(() => {
    if (isRunningEvaluation) return;
    if (currentStepIndex === 0) {
      setHasStartedWorkflow(false);
      return;
    }
    if (canMoveToPreviousStep) {
      moveToPreviousStep();
    }
  }, [currentStepIndex, canMoveToPreviousStep, isRunningEvaluation, moveToPreviousStep]);
  const isNextEnabled =
    !isRunningEvaluation && isConditionMetForStep() && (isOnLastStep ? !!createdEvaluationGroupID : canMoveToNextStep);
  const nextLabel = isOnLastStep
    ? "Done"
    : currentStepID === "evaluate" && !createdEvaluationGroupID
      ? isRunningEvaluation
        ? "Running..."
        : "Run"
      : "Next";
  useEffect(() => {
    if (!hasStartedWorkflow || currentStepIndex < 0) return;
    const params = new URLSearchParams(window.location.search);
    params.set(stepParam, String(currentStepIndex));
    if (evaluationName.trim()) {
      params.set(evalNameParam, evaluationName);
    }
    if (datasetSelection.kind === "valid") {
      params.set(datasetParam, datasetSelection.value);
    } else {
      params.delete(datasetParam);
    }

    if (selectedMetricSetIDs.size > 0) {
      params.set(metricSetParam, Array.from(selectedMetricSetIDs).join(","));
    }
    if (createdEvaluationGroupID) {
      params.set(evalGroupParam, createdEvaluationGroupID);
    } else {
      params.delete(evalGroupParam);
    }

    const query = params.toString();
    router.replace(query ? `?${query}` : "", { scroll: false });
  }, [
    currentStepIndex,
    evaluationName,
    datasetSelection,
    selectedMetricSetIDs,
    createdEvaluationGroupID,
    hasStartedWorkflow,
    router,
  ]);
  // MARK: - Rendering: Step Content

  const renderStepContent = () => {
    if (!hasStartedWorkflow) {
      return (
        <PageContent>
          <StepPanel>
            <IconContainer>
              <Image src="/assets/adminPanel/start-icon.svg" alt="Evaluations" width={40} height={40} />
            </IconContainer>
            <Title>Evaluations</Title>
            <Subtitle>Let's start by giving your evaluation a name.</Subtitle>
            <TextField
              valueState={evaluationNameState}
              placeholder="Evaluation Name"
              autoCapitalize="words"
              style={{
                backgroundColor: Color.surfaceOffWhite,
                height: "40px",
                padding: "10px 12px",
                width: "100%",
              }}
            />
            <Button
              style={{ width: "100%" }}
              prominence="primary"
              size="large"
              action={() => {
                setHasStartedWorkflow(true);
              }}
              isEnabled={evaluationName.trim().length > 0}
            >
              <ButtonInner>
                Create Evaluation
                <Image width={20} height={20} src="/assets/adminPanel/guide-arrow-right.svg" alt="Arrow Right" />
              </ButtonInner>
            </Button>
          </StepPanel>
        </PageContent>
      );
    }

    if (currentStepID === "prepare") {
      return (
        <PageContent>
          <StepPanel>
            <IconContainer>
              <Image src="/assets/adminPanel/prepare-icon.svg" alt="Evaluations" width={40} height={40} />
            </IconContainer>
            <Title>Select a Dataset</Title>
            <Subtitle>Choose the data you want to evaluate.</Subtitle>
            <DatasetSelect showLabel={false} selectionState={datasetSelectionState} />
            <BottomHStack>
              <Button style={{ width: "50%" }} size="large" keyEquivalent="Escape" action={handleBack}>
                Back
              </Button>
              <Button
                style={{ width: "50%" }}
                size="large"
                prominence="primary"
                action={handleNext}
                isEnabled={datasetSelection.kind === "valid"}
              >
                <ButtonInner>
                  Continue
                  <Image width={20} height={20} src="/assets/adminPanel/guide-arrow-right.svg" alt="Arrow Right" />
                </ButtonInner>
              </Button>
            </BottomHStack>
          </StepPanel>
        </PageContent>
      );
    }

    if (currentStepID === "measure") {
      return (
        <PageContent style={{ alignItems: "flex-start", paddingTop: "15%" }}>
          <StepPanel>
            <IconContainer>
              <Image src="/assets/adminPanel/measure-icon.svg" alt="Evaluations" width={40} height={40} />
            </IconContainer>
            <Title>Select Evaluation Metrics</Title>
            <Subtitle>Use an existing metric set.</Subtitle>
            <MetricSetSelect selectionState={metricSetSelectionState} artifactCount={datasetSelection.artifactCount} />
            <BottomHStack>
              <Button style={{ width: "50%" }} size="large" keyEquivalent="Escape" action={handleBack}>
                Back
              </Button>
              <Button
                style={{ width: "50%" }}
                size="large"
                prominence="primary"
                action={handleNext}
                isEnabled={selectedMetricSetIDs.size > 0}
              >
                <ButtonInner>
                  Continue
                  <Image width={20} height={20} src="/assets/adminPanel/guide-arrow-right.svg" alt="Arrow Right" />
                </ButtonInner>
              </Button>
            </BottomHStack>
          </StepPanel>
        </PageContent>
      );
    }
    if (currentStepID === "evaluate") {
      return (
        <PageContent>
          <StepPanel>
            <IconContainer>
              <Image src="/assets/adminPanel/evaluate-icon.svg" alt="Evaluations" width={40} height={40} />
            </IconContainer>
            <Title>Review Evaluation Setup</Title>
            <Subtitle>Confirm your setup before running the evaluation.</Subtitle>
            <TextVStack>
              <ReviewLabel>Evaluation Name</ReviewLabel>
              <TextContainer>
                <ReviewText>{evaluationName || "Untitled Evaluation"}</ReviewText>
              </TextContainer>

              <ReviewLabel>Dataset</ReviewLabel>
              <TextContainer>
                <ReviewText>
                  {isReviewLoading ? "Loading dataset..." : selectedDatasetName || "No Dataset Selected"}
                </ReviewText>
              </TextContainer>

              <ReviewLabel>Metric Sets</ReviewLabel>
              <TextContainer>
                <ReviewText>
                  {isReviewLoading
                    ? "Loading metrics..."
                    : selectedMetricSetIDs.size > 0
                      ? availableRecipes
                          .filter((recipe) => selectedMetricSetIDs.has(recipe.id))
                          .map((recipe) => recipe.name)
                          .join(", ")
                      : "No Metrics Selected"}
                </ReviewText>
              </TextContainer>
              <ReviewLabel>Judge Model (optional)</ReviewLabel>
              <EvaluationModelSelect
                showLabel={false}
                selectionState={evaluationModelSelectionState}
                isEnabled={!isRunningEvaluation}
              />
            </TextVStack>
            <Info>
              {isReviewLoading
                ? "Loading evaluation details..."
                : `Evaluating ${datasetSelection.artifactCount} ${datasetSelection.artifactCount === 1 ? "artifact" : "artifacts"} & ${totalSelectedMetrics} ${totalSelectedMetrics === 1 ? "metric" : "metrics"}`}
            </Info>
            <BottomHStack>
              <Button style={{ width: "50%" }} size="large" keyEquivalent="Escape" action={handleBack}>
                Back
              </Button>
              <Button
                style={{ width: "50%" }}
                prominence="primary"
                size="large"
                action={handleNext}
                isEnabled={!isRunningEvaluation}
              >
                <ButtonInner>
                  {isRunningEvaluation ? "Running Evaluation..." : "Run Evaluation"}
                  {!isRunningEvaluation && (
                    <Image width={20} height={20} src="/assets/adminPanel/guide-arrow-right.svg" alt="Arrow Right" />
                  )}
                </ButtonInner>
              </Button>
            </BottomHStack>
          </StepPanel>
        </PageContent>
      );
    }
    if (currentStepID === "review") {
      if (!createdEvaluationGroupID || !evaluation) {
        return <StepMessage>Run the evaluation to load this step.</StepMessage>;
      }

      return (
        <ReviewContainer>
          <EvaluationContent
            selectedItemNodeState={selectedItemNodeState}
            isLoading={isLoadingArtifacts || isLoadingRecipes}
            artifacts={artifacts}
            metricDefinitions={metricDefinitions}
            evaluationGroupID={createdEvaluationGroupID}
            recipes={evaluationRecipes}
            canCreateTicket={false}
            createTicket={createNoOp}
            nodesByID={nodesByID}
            selectedMetricsState={selectedMetricsState}
            lastSelectedMetricsState={lastSelectedMetricsState}
          />
        </ReviewContainer>
      );
    }

    if (currentStepID === "report") {
      if (!createdEvaluationGroupID || !evaluation) {
        return <StepMessage>Run and finish the evaluation to see the report.</StepMessage>;
      }

      return (
        <ReviewContainer>
          <EvaluationReport
            evaluation={evaluation}
            artifacts={artifacts}
            metricDefinitions={metricDefinitions}
            metricDefinitionForID={metricDefinitionForID}
            kindConfigurationForPattern={kindConfigurationForPattern}
            evaluationGroupID={createdEvaluationGroupID}
            modelDisplayNameForID={modelDisplayNameForID}
            recipes={evaluationRecipes}
            hideHeader={false}
          />
        </ReviewContainer>
      );
    }
    if (currentStepID === "complete") {
      return (
        <PageContent>
          <StepPanel>
            <IconContainer>
              <Image src="/assets/adminPanel/complete-icon.svg" alt="Evaluations" width={40} height={40} />
            </IconContainer>
            <Title>Completed!</Title>
            <BottomHStack>
              <Button style={{ width: "100%" }} size="large" keyEquivalent="Escape" action={goToEvaluations}>
                View Evaluation
              </Button>
            </BottomHStack>
            <Separator>
              <LineBreak />
              <Or>Or</Or>
              <LineBreak />
            </Separator>
            <BottomHStack>
              <Button style={{ width: "50%" }} size="large" keyEquivalent="Escape" action={handleBack}>
                Back to Report
              </Button>
              <Button style={{ width: "100%" }} size="large" prominence="secondary" action={resetWorkflow}>
                Start New Evaluation
              </Button>
            </BottomHStack>
          </StepPanel>
        </PageContent>
      );
    }
    return null;
  };

  return (
    <NavigationStack>
      <Toolbar>
        <ToolbarItem
          title={currentNavigationSidebarState === "open" ? "Hide Navigation" : "Show Navigation"}
          icon={
            currentNavigationSidebarState === "open"
              ? "adminPanel/left-Side-bar-icon-close"
              : "adminPanel/left-Side-bar-icon-open"
          }
          action={toggleNavigationSidebar}
          edge="leading"
          ignoresSidebar
        />
        {currentStepID === "review" && (
          <ToolbarItem title="Continue" edge="center">
            {
              <ContentHeader>
                <EvaluationStatusMessage status={evaluationStatus} circleSize={20} />
              </ContentHeader>
            }
          </ToolbarItem>
        )}
        {currentStepID === "review" && evaluationStatus === "Done" && (
          <ToolbarItem title="Continue" edge="trailing">
            <Button size="regular" prominence="primary" action={handleNext}>
              <ButtonInner>
                View Report
                <Image width={20} height={20} src="/assets/adminPanel/guide-arrow-right.svg" alt="Arrow Right" />
              </ButtonInner>
            </Button>
          </ToolbarItem>
        )}
        {currentStepID === "report" && (
          <ToolbarItem title="Continue" edge="center">
            <ContentHeader>Evaluation Report</ContentHeader>
          </ToolbarItem>
        )}
        {currentStepID === "report" && (
          <ToolbarItem title="Continue" edge="trailing">
            <Button size="regular" prominence="primary" action={handleNext}>
              <ButtonInner>
                Continue
                <Image width={20} height={20} src="/assets/adminPanel/guide-arrow-right.svg" alt="Arrow Right" />
              </ButtonInner>
            </Button>
          </ToolbarItem>
        )}
        {currentStepID === "report" && (
          <ToolbarItem title="Continue" edge="trailing">
            <Button size="regular" keyEquivalent="Escape" action={handleBack}>
              Back
            </Button>
          </ToolbarItem>
        )}
        {currentStepID === "report" && (
          <ToolbarItem title="Continue" edge="trailing">
            <ReportDateLabel>
              Report Generated On: <ReportDate>{generatedAt.toLocaleString()}</ReportDate>
            </ReportDateLabel>
          </ToolbarItem>
        )}
      </Toolbar>
      <NavigationSidebar
        sidebarState={navigationSidebarState}
        workflowLine={
          hasStartedWorkflow
            ? {
                steps: workflowSteps,
                currentStepIndex: workflowLineCurrentStepIndex,
                controls: {
                  onPrevious: moveToPreviousStep,
                  previousEnabled: canMoveToPreviousStep && !isRunningEvaluation,
                  onNext: () => void handleNext(),
                  nextEnabled: isNextEnabled,
                  nextLabel,
                  showRestart: isOnLastStep,
                  onRestart: resetWorkflow,
                  restartEnabled: !isRunningEvaluation,
                },
              }
            : undefined
        }
      />
      <NavigationContent>
        <Page>{renderStepContent()}</Page>
      </NavigationContent>
    </NavigationStack>
  );
}
