"use client";

import { useRouter } from "next/navigation";
import { use, useCallback, useContext, useEffect, useMemo, useState } from "react";
import styled, { css } from "styled-components";

import { fetchCancelEvaluation, useOrgUsers } from "@/generated/serverEndpoints";
import type { Metric, MetricID } from "@/generated/serverTypes";

import { useBinding, useStateObject } from "@/library/StateObject";
import useLocalStorageStateObject from "@/library/useLocalStorageStateObject";
import { useOpenLinearIssue } from "@/library/useOpenLinearIssue";

import { ArtifactNode } from "@/model/artifactNode";
import { encodeArtifactPathPattern } from "@/model/artifactPath";
import { useEvaluationModels } from "@/model/evaluationModels";
import { modelNamesForEvaluationFromArtifacts } from "@/model/evaluationRunModels";
import { deriveEvaluationStatus, type EvaluationStatus } from "@/model/evaluationStatus";
import { filterItems, type ItemNode } from "@/model/keyPath";

import { ContentHeader } from "@/components/ContentHeader";
import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import {
  RecipeContext,
  type RecipeMetric,
  type RecipeMetricSetNodeLookup,
  recipeMetricAccessibleFilter,
} from "@/components/contexts/RecipeContext";
import { EvaluationContent } from "@/components/EvaluationContent";
import { EvaluationReport } from "@/components/EvaluationReport";
import { EvaluationMetadata, EvaluationStatusMessage } from "@/components/EvaluationStatus";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { NavigationSidebar } from "@/components/NavigationSidebar";
import {
  ModalPanel,
  NavigationContent,
  NavigationStack,
  type SidebarState,
  Toolbar,
  ToolbarItem,
} from "@/components/ui";

import { invalidateContentArtifacts } from "@/app/navigator/_shared/artifacts";
import { ArtifactContext } from "@/app/navigator/_shared/context";

// MARK: - Types

// MARK: - Constants

const artifactQueryParam = "artifactPath";
const metricQueryParam = "metric";
const reportQueryParam = "openReport";

// MARK: - Contexts

// MARK: - Hooks

// MARK: - Styles

const EvaluationHeader = styled.div`${() => css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`}`;

const EvaluationTitle = styled(ContentHeader)`${() => css`
  margin: 0;
`}`;

const EvaluationTitleContainer = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`}`;

// MARK: - Helper Functions
const useAccessibleRecipeMetrics = (recipeIDs: string[], recipeMetricSetNodeForID: RecipeMetricSetNodeLookup) => {
  const recipeMetricNodes: ItemNode<RecipeMetric>[] = useMemo(
    () => recipeIDs.flatMap((recipeID) => recipeMetricSetNodeForID({ recipeID })?.allChildren() ?? []),
    [recipeIDs, recipeMetricSetNodeForID],
  );

  const availableRecipeMetrics = useMemo(
    () =>
      filterItems({
        items: recipeMetricNodes,
        filter: recipeMetricAccessibleFilter,
      }).map(({ item }) => item),
    [recipeMetricNodes],
  );

  return availableRecipeMetrics;
};

// MARK: - Components

// MARK: - Page

const EvaluationPage = (props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ artifactPath?: string; metric?: string; openReport?: string }>;
}) => {
  const searchParams = use(props.searchParams);

  /// Context

  const { id } = use(props.params);
  const router = useRouter();

  const searchArtifactPath = searchParams.artifactPath;
  const searchMetricID = searchParams.metric;
  const searchOpenReport = searchParams.openReport;

  const { currentOrganization, organizationSlug, kindConfigurationForPattern, metricDefinitionForID } =
    useContext(OrganizationContext);

  const context = useContext(ArtifactContext);
  if (!context) throw new Error("Component must be used within a ArtifactContextProvider");
  const { isLoading: isLoadingArtifacts, nodesByID } = context;

  const { evaluationMap, isLoading, recipeMap, recipeMetricSetNodeForID, refresh } = useContext(RecipeContext);
  const { evaluationModels } = useEvaluationModels();

  /// State

  const navigationSidebarState = useStateObject<SidebarState>("open");
  const [currentNavigationSidebarState, setCurrentNavigationSidebarState] = useBinding(navigationSidebarState);

  const lastSelectedMetricsState = useLocalStorageStateObject<MetricID[]>("selectedMetrics-dataset:/artifact:", []);
  const selectedMetricsState = useStateObject<Map<MetricID, Metric>>(() => new Map());
  const [selectedMetrics] = useBinding(selectedMetricsState);
  const selectedMetricID = useMemo(
    () => (selectedMetrics.size > 0 ? (selectedMetrics.keys().next().value ?? null) : null),
    [selectedMetrics],
  );

  const openLinearIssue = useOpenLinearIssue();
  const reportModalState = useStateObject(false);
  const cancelEvaluationDialogState = useStateObject(false);
  const [isReportOpen, setIsReportOpen] = useBinding(reportModalState);
  const [_isCancelEvaluationDialogOpen, setIsCancelEvaluationDialogOpen] = useBinding(cancelEvaluationDialogState);
  const [isStopping, setIsStopping] = useState(false);
  const openReportModal = useCallback(() => {
    setIsReportOpen(true);
  }, [setIsReportOpen]);

  const orgUsersLoader = useOrgUsers(
    currentOrganization && isReportOpen ? { orgID: currentOrganization.id } : undefined,
  );
  const reviewerNameByID = useMemo(
    () => new Map((orgUsersLoader.response?.users ?? []).map((user) => [user.id, user.fullName || user.email])),
    [orgUsersLoader.response?.users],
  );
  const selectedItemNodeState = useStateObject<ItemNode | null>(null);
  const [selectedItemNode] = useBinding(selectedItemNodeState);
  const selectedArtifactNode = useMemo(
    () => (selectedItemNode instanceof ArtifactNode ? selectedItemNode : null),
    [selectedItemNode],
  );
  const modelDisplayNameForID = useMemo(
    () => new Map(evaluationModels.map((model) => [model.id, model.displayName])),
    [evaluationModels],
  );

  /// Derived State

  /// Use URL query parameters to set the selected artifact and metric.
  useEffect(() => {
    const artifactNodeFromQuery = searchArtifactPath ? (nodesByID.get(searchArtifactPath)?.at(0) ?? null) : null;
    if (selectedItemNodeState.wrappedValue !== artifactNodeFromQuery) {
      selectedItemNodeState.wrappedValue = artifactNodeFromQuery;
    }

    if (!searchMetricID && selectedMetricsState.wrappedValue.size > 0) {
      selectedMetricsState.wrappedValue = new Map();
    } else if (searchMetricID && artifactNodeFromQuery) {
      const metricFromQuery = artifactNodeFromQuery.metricForID({ id: searchMetricID, activeEventSummaryID: null });
      if (metricFromQuery) {
        const currentMetric = selectedMetricsState.wrappedValue.get(metricFromQuery.id);
        const hasSingleMetricSelected = selectedMetricsState.wrappedValue.size === 1 && currentMetric;
        if (!hasSingleMetricSelected) {
          selectedMetricsState.wrappedValue = new Map([[metricFromQuery.id, metricFromQuery]]);
          lastSelectedMetricsState.wrappedValue = [metricFromQuery.id];
        }
      }
    }
  }, [
    nodesByID,
    selectedItemNodeState,
    selectedMetricsState,
    lastSelectedMetricsState,
    searchArtifactPath,
    searchMetricID,
  ]);

  /// Keep the report modal in sync with the URL query parameter.
  useEffect(() => {
    const shouldOpenReport = searchOpenReport === "true";
    setIsReportOpen(shouldOpenReport);
  }, [searchOpenReport, setIsReportOpen]);

  /// Update the URL query parameters when the selected artifact or metric changes.
  useEffect(() => {
    // CRITICAL: Skip URL updates while data is loading to prevent race condition
    // where empty state gets written to URL before initialization completes
    if (isLoadingArtifacts || isLoading) {
      return;
    }

    const selectedArtifactID = selectedArtifactNode?.id ?? null;

    const url = new URL(window.location.href);

    if (selectedArtifactID !== url.searchParams.get(artifactQueryParam)) {
      if (selectedArtifactID) {
        url.searchParams.set(artifactQueryParam, selectedArtifactID);
      } else {
        url.searchParams.delete(artifactQueryParam);
      }
    }

    if (selectedMetricID !== url.searchParams.get(metricQueryParam)) {
      if (selectedMetricID) {
        url.searchParams.set(metricQueryParam, selectedMetricID);
      } else {
        url.searchParams.delete(metricQueryParam);
      }
    }

    const shouldReportBeOpen = url.searchParams.get(reportQueryParam) === "true";
    if (isReportOpen !== shouldReportBeOpen) {
      if (isReportOpen) {
        url.searchParams.set(reportQueryParam, "true");
      } else {
        url.searchParams.delete(reportQueryParam);
      }
    }

    router.replace(url.toString());
  }, [router, selectedArtifactNode, selectedMetricID, isReportOpen, isLoadingArtifacts, isLoading]);

  const evaluation = evaluationMap.get(id);

  const datasets = useMemo(
    () =>
      (evaluation?.artifactPathPatterns ?? []).flatMap((pattern) => {
        const lastComponent = pattern.at(-1);
        /// Make sure the pattern points to artifact types
        if (!lastComponent || !("kind" in lastComponent) || lastComponent.kind !== "artifact" || lastComponent.id) {
          return [];
        }

        /// Encode it and treat it as a path.
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
  const artifactRuns = useMemo(
    () => artifacts.flatMap((artifactNode) => (artifactNode.artifact ? [artifactNode.artifact] : [])),
    [artifacts],
  );
  const evaluationModelName = useMemo(() => {
    const modelNames = modelNamesForEvaluationFromArtifacts({
      evaluationGroupID: id,
      artifacts: artifactRuns,
      modelDisplayNameForID,
    });
    return modelNames.length > 0 ? modelNames.join(", ") : null;
  }, [id, artifactRuns, modelDisplayNameForID]);

  const evaluationStatus = useMemo<EvaluationStatus | null>(() => {
    if (isLoadingArtifacts || isLoading || !evaluation) return null;

    return deriveEvaluationStatus({
      datasetNodes: datasets,
      evaluation,
      recipeMetricSetNodeForID,
    });
  }, [datasets, evaluation, isLoadingArtifacts, isLoading, recipeMetricSetNodeForID]);

  const recipeIDs = evaluation?.recipeIDs ?? [];
  const recipes = useMemo(
    () =>
      recipeIDs.flatMap((recipeID) => {
        const recipe = recipeMap.get(recipeID);
        return recipe ? [recipe] : [];
      }),
    [recipeIDs, recipeMap],
  );

  const availableRecipeMetrics = useAccessibleRecipeMetrics(recipeIDs, recipeMetricSetNodeForID);

  const metricDefinitions = useMemo(
    () => availableRecipeMetrics.flatMap(({ metricDefinition }) => (metricDefinition ? [metricDefinition] : [])),
    [availableRecipeMetrics],
  );
  /// Actions

  const toggleNavigationSidebar = useCallback(() => {
    setCurrentNavigationSidebarState((previous) => {
      if (previous === "open") return "collapsed";
      if (previous === "collapsed") return "open";
      return previous;
    });
  }, [setCurrentNavigationSidebarState]);

  const createTicket = useCallback(() => {
    if (!evaluation) return;
    const title = `Evaluation: ${evaluation.name} Flagged for Review`;
    const description =
      "[This evaluation](%url%) flagged potential accuracy concerns. Please review for correctness and assess whether the issue reflects model or data behavior.";
    openLinearIssue({ title, description });
  }, [evaluation, openLinearIssue]);

  const selectMetricFromReport = useCallback(
    (artifactNode: ArtifactNode, metricID: string) => {
      const metric = artifactNode.metricForID({ id: metricID, activeEventSummaryID: null });
      if (!metric) return;
      selectedItemNodeState.wrappedValue = artifactNode;
      selectedMetricsState.wrappedValue = new Map([[metric.id, metric]]);
      lastSelectedMetricsState.wrappedValue = [metric.id];
      setIsReportOpen(false);
    },
    [lastSelectedMetricsState, selectedItemNodeState, selectedMetricsState, setIsReportOpen],
  );

  const canCreateTicket = !!evaluation && !!organizationSlug;
  const canCancelEvaluation =
    !!evaluation &&
    !!currentOrganization &&
    evaluationStatus !== "Done" &&
    evaluationStatus !== "Cancelled" &&
    !isStopping;
  const shouldShowCancelEvaluation =
    !!evaluation && !evaluation.isCancelled && (isStopping || evaluationStatus !== "Done");

  const promptCancelEvaluation = useCallback(() => {
    if (!canCancelEvaluation) return;
    setIsCancelEvaluationDialogOpen(true);
  }, [canCancelEvaluation, setIsCancelEvaluationDialogOpen]);

  const cancelEvaluation = useCallback(async () => {
    if (!evaluation || !currentOrganization || !canCancelEvaluation) return;

    setIsStopping(true);
    try {
      await fetchCancelEvaluation({
        orgID: currentOrganization.id,
        evaluationGroupID: evaluation.id,
      });
      await refresh();
      await invalidateContentArtifacts(currentOrganization.id);
    } catch (error) {
      console.error("Failed to cancel evaluation:", error);
    } finally {
      setIsStopping(false);
    }
  }, [canCancelEvaluation, currentOrganization, evaluation, refresh]);

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
        <ToolbarItem
          title={isLoading ? "Loading Evaluation…" : evaluation ? evaluation.name : "No Evaluation Found"}
          edge="center"
        >
          <EvaluationHeader>
            <EvaluationTitleContainer>
              <EvaluationTitle>
                {isLoading ? "Loading Evaluation…" : evaluation ? evaluation.name : "No Evaluation Found"}
              </EvaluationTitle>
              {evaluationModelName || evaluation ? (
                <EvaluationMetadata>
                  {evaluationModelName ? <span>Judge Model: {evaluationModelName}&nbsp;&nbsp;&nbsp;</span> : null}
                  {evaluation && evaluationStatus ? (
                    <EvaluationStatusMessage status={evaluationStatus} circleSize={15} />
                  ) : null}
                </EvaluationMetadata>
              ) : null}
            </EvaluationTitleContainer>
          </EvaluationHeader>
        </ToolbarItem>
        {shouldShowCancelEvaluation ? (
          <ToolbarItem
            title={isStopping ? "Cancelling…" : "Cancel Eval"}
            variant="default"
            action={promptCancelEvaluation}
            edge="trailing"
            isEnabled={canCancelEvaluation}
          />
        ) : null}
        <ToolbarItem title="View Report" variant="default" action={openReportModal} edge="trailing" />
        <ToolbarItem
          title="Create Ticket"
          variant="primary"
          action={createTicket}
          edge="trailing"
          isEnabled={canCreateTicket}
        />
      </Toolbar>
      <NavigationSidebar sidebarState={navigationSidebarState} />
      <NavigationContent scrollsVertically>
        <EvaluationContent
          evaluationGroupID={id}
          artifacts={artifacts}
          nodesByID={nodesByID}
          metricDefinitions={metricDefinitions}
          modelDisplayNameForID={modelDisplayNameForID}
          recipes={recipes}
          isLoading={isLoadingArtifacts || isLoading}
          canCreateTicket={canCreateTicket}
          createTicket={createTicket}
          selectedItemNodeState={selectedItemNodeState}
          selectedMetricsState={selectedMetricsState}
          lastSelectedMetricsState={lastSelectedMetricsState}
        />
      </NavigationContent>
      <ModalPanel isPresentedState={reportModalState} presentation="fullscreen">
        <EvaluationReport
          evaluation={evaluation}
          artifacts={artifacts}
          metricDefinitions={metricDefinitions}
          metricDefinitionForID={metricDefinitionForID}
          kindConfigurationForPattern={kindConfigurationForPattern}
          evaluationGroupID={id}
          modelDisplayNameForID={modelDisplayNameForID}
          reviewerNameByID={reviewerNameByID}
          recipes={recipes}
          hideHeader={true}
          onSelectMetric={selectMetricFromReport}
        />
      </ModalPanel>
      <ConfirmationDialog
        isPresentedState={cancelEvaluationDialogState}
        title="Cancel Evaluation?"
        message="Are you sure you want to cancel this evaluation? Any in-progress work will stop, and this action cannot be undone."
        confirmLabel="Cancel Eval"
        onConfirm={cancelEvaluation}
        isProcessing={isStopping}
      />
    </NavigationStack>
  );
};

export default EvaluationPage;
