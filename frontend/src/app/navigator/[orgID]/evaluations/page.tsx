"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { css } from "styled-components";

import { fetchCancelEvaluation, fetchRecordRecipe } from "@/generated/serverEndpoints";
import type { ColumnDescriptor } from "@/generated/serverTypes";

import { useBinding, useStateObject } from "@/library/StateObject";
import useLocalStorageStateObject from "@/library/useLocalStorageStateObject";
import { usePagination } from "@/library/usePagination";

import type { ArtifactNode } from "@/model/artifactNode";
import { encodeArtifactPathPattern } from "@/model/artifactPath";
import type { Evaluation } from "@/model/evaluation";
import { useEvaluationModels } from "@/model/evaluationModels";
import { modelNamesForEvaluationFromArtifacts } from "@/model/evaluationRunModels";
import { deriveEvaluationStatus, type EvaluationStatus } from "@/model/evaluationStatus";
import { ItemNode, type SortDescriptor, sortItems } from "@/model/keyPath";

import { ContentHeader } from "@/components/ContentHeader";
import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import { RecipeContext } from "@/components/contexts/RecipeContext";
import { EvaluationCreationModal } from "@/components/EvaluationCreationModal";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { NavigationSidebar } from "@/components/NavigationSidebar";
import { Pagination } from "@/components/pagination/Pagination";
import {
  Font,
  NavigationContent,
  NavigationStack,
  type SidebarState,
  Size,
  Table,
  type TableActionHandler,
  type TableCellRenderer,
  Toolbar,
  ToolbarItem,
} from "@/components/ui";
import { Button } from "@/components/ui/Button";

import { invalidateContentArtifacts } from "@/app/navigator/_shared/artifacts";
import { ArtifactContext } from "@/app/navigator/_shared/context";
import { TooltipPopup } from "@/app/navigator/[orgID]/evaluations/[id]/MetricIconSelection";

// MARK: - Types

// MARK: - Constants

const AUTO_REFRESH_INTERVAL_MS = 10_000;

type EvaluationListItem = Evaluation & {
  datasets: string;
  metricSets: string;
  modelName: string;
  status: EvaluationStatus;
};

const creationTimestampColumKeyPaths = ["creationTimestamp.sortableDate"];

const defaultSortDescriptors: SortDescriptor[] = [
  { keyPaths: ["creationTimestamp.sortableDate"], order: "descending" },
];
const evaluationColumns: ColumnDescriptor[] = [
  {
    title: "Name",
    keyPaths: ["name"],
    width: "auto",
  },
  {
    title: "Datasets",
    keyPaths: ["datasets"],
    width: "auto",
  },
  {
    title: "Metric Sets",
    keyPaths: ["metricSets"],
    width: "auto",
  },
  {
    title: "Judge Model",
    keyPaths: ["modelName"],
    width: "auto",
  },
  {
    title: "Status",
    keyPaths: ["status"],
    width: 50,
  },
  {
    title: "Creation Date",
    keyPaths: creationTimestampColumKeyPaths,
    width: "auto",
  },
  {
    title: "",
    keyPaths: ["action"],
    width: 40,
  },
];

// MARK: - Contexts

// MARK: - Hooks

// MARK: - Styles

const TableContainer = styled.div`${() => css`
  position: relative;
  height: 100%;

  ${Table} {
    position: absolute;
    inset: 23px 20px 30px 20px;
  }
`}`;

const EmptyStateContainer = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  text-align: center;

  h3 {
      font-size: ${Size.fontSize.fontSize14};
      font-weight: 400;
      font-family: ${Font.ibmPlexSans};
      line-height: 1.2;
      max-width: 300px;
      text-wrap: balance;
      text-wrap: pretty;
      margin: 0px;
    }
`}`;

const StatusContainer = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const statusIconMap: Record<EvaluationStatus, { src: string; alt: string }> = {
  Done: {
    src: "/assets/adminPanel/eval-done-icon.svg",
    alt: "Done",
  },
  Failed: {
    src: "/assets/adminPanel/eval-fail-icon.svg",
    alt: "Failed",
  },
  Cancelled: {
    src: "/assets/status-dash.svg",
    alt: "Cancelled",
  },
  Evaluating: {
    src: "/assets/adminPanel/eval-evaluating-icon.svg",
    alt: "Evaluating",
  },
};

const TOOLTIP_DELAY_MS = 500;

const statusTooltipMap: Record<EvaluationStatus, string> = {
  Done: "Evaluation complete",
  Failed: "Evaluation failed",
  Cancelled: "Evaluation cancelled",
  Evaluating: "Evaluation in progress",
};

const StatusIcon = ({
  status,
  onShowTooltip,
  onHideTooltip,
}: {
  status: EvaluationStatus;
  onShowTooltip: (el: HTMLElement, text: string) => void;
  onHideTooltip: () => void;
}) => {
  const icon = statusIconMap[status];
  const tooltipText = statusTooltipMap[status];
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleEnter = () => onShowTooltip(el, tooltipText);
    const handleLeave = () => onHideTooltip();
    el.addEventListener("mouseenter", handleEnter);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mouseenter", handleEnter);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, [onShowTooltip, onHideTooltip, tooltipText]);

  if (!icon) return null;

  return (
    <StatusContainer ref={containerRef}>
      <Image src={icon.src} alt={icon.alt} width={20} height={20} />
    </StatusContainer>
  );
};

const Icon = styled.div<{ $iconPath: string }>`
  width: 18px;
  height: 18px;
  display: flex;
  justify-content: center;
  background-size: contain;
  background-image: url(${({ $iconPath }) => $iconPath});
  background-position: center;
  background-repeat: no-repeat;
  cursor: pointer;
`;

// MARK: - Helper Functions

// MARK: - Components

// MARK: - Page

const EvaluationPage = () => {
  /// Context

  const router = useRouter();

  const { currentOrganization, organizationSlug, kindConfigurationForPattern } = useContext(OrganizationContext);

  const context = useContext(ArtifactContext);
  if (!context) throw new Error("Component must be used within a ArtifactContextProvider");
  const { nodesByID } = context;

  const { recipeMap, evaluations, isLoading, refresh, recipeMetricSetForID, recipeMetricSetNodeForID } =
    useContext(RecipeContext);
  const { evaluationModels } = useEvaluationModels();

  /// State

  const selectionState = useStateObject<ItemNode<EvaluationListItem> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tooltipState, setTooltipState] = useState<{ top: number; left: number; text: string } | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = useCallback((el: HTMLElement, text: string) => {
    const rect = el.getBoundingClientRect();
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => {
      setTooltipState({ top: rect.bottom + 4, left: rect.left + rect.width / 2, text });
    }, TOOLTIP_DELAY_MS);
  }, []);

  const hideTooltip = useCallback(() => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setTooltipState(null);
  }, []);
  const deleteEvaluationDialogState = useStateObject(false);
  const [_isDeleteEvaluationDialogOpen, setDeleteEvaluationDialogOpen] = useBinding(deleteEvaluationDialogState);

  const sortDescriptorsState = useLocalStorageStateObject<SortDescriptor[]>(
    "evaluationsSortDescriptors",
    defaultSortDescriptors,
  );
  const [sortDescriptors] = useBinding(sortDescriptorsState);

  const navigationSidebarState = useStateObject<SidebarState>("open");
  const [currentNavigationSidebarState, setCurrentNavigationSidebarState] = useBinding(navigationSidebarState);

  /// Derived State
  const modelDisplayNameForID = useMemo(
    () => new Map(evaluationModels.map((model) => [model.id, model.displayName])),
    [evaluationModels],
  );

  const evaluationItems = useMemo(
    () =>
      evaluations.map((evaluation) => {
        const datasetNodesMap = new Map<string, ArtifactNode>();

        for (const pattern of evaluation.artifactPathPatterns) {
          const lastComponent = pattern.at(-1);
          if (!lastComponent || !("kind" in lastComponent) || lastComponent.kind !== "artifact" || lastComponent.id) {
            continue;
          }

          const encodedArtifactPath = encodeArtifactPathPattern(pattern.slice(0, pattern.length - 1));
          const node = nodesByID.get(encodedArtifactPath)?.at(0);
          if (!node) continue;

          datasetNodesMap.set(node.id, node);
        }

        const datasetNodes = Array.from(datasetNodesMap.values());

        const datasets = datasetNodes
          .map((node) => {
            const value = node.valueForKeyPaths(["metadata.name", "id"]).raw;
            if (typeof value === "string" && value.trim().length > 0) return value;
            return node.id;
          })
          .join(", ");

        const metricSets = evaluation.recipeIDs
          .flatMap((recipeID) => recipeMetricSetForID({ recipeID })?.recipe.name?.trim())
          .join(", ");
        const artifacts = datasetNodes.flatMap((datasetNode) =>
          Array.from(datasetNode.children.values()).flatMap((artifactNode) =>
            artifactNode.artifact ? [artifactNode.artifact] : [],
          ),
        );
        const modelNames = modelNamesForEvaluationFromArtifacts({
          evaluationGroupID: evaluation.id,
          artifacts,
          modelDisplayNameForID,
        });
        const modelName = modelNames.length > 0 ? modelNames.join(", ") : "";

        const status = deriveEvaluationStatus({
          evaluation,
          datasetNodes,
          recipeMetricSetNodeForID,
        });

        return new ItemNode<EvaluationListItem>({
          id: evaluation.id,
          item: { ...evaluation, datasets, metricSets, modelName, status },
        });
      }),
    [evaluations, modelDisplayNameForID, nodesByID, recipeMetricSetForID, recipeMetricSetNodeForID],
  );
  const hasEvaluatingEvaluation = useMemo(
    () => evaluationItems.some((item) => item.item?.status === "Evaluating"),
    [evaluationItems],
  );

  const sortedEvaluationItems = useMemo(
    () => sortItems({ items: evaluationItems, sortDescriptors }),
    [evaluationItems, sortDescriptors],
  );
  const { page, totalPages, paginatedItems, goToPage } = usePagination({
    items: sortedEvaluationItems,
    isLoading: isLoading,
  });
  useEffect(() => {
    if (!hasEvaluatingEvaluation) return;

    const abortController = new AbortController();

    const intervalID = window.setInterval(() => {
      void (async () => {
        await refresh();
        if (abortController.signal.aborted) return;
        if (currentOrganization?.id) {
          await invalidateContentArtifacts(currentOrganization.id);
        }
      })();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      abortController.abort();
      window.clearInterval(intervalID);
    };
  }, [hasEvaluatingEvaluation, refresh, currentOrganization]);

  /// Actions

  const toggleNavigationSidebar = useCallback(() => {
    setCurrentNavigationSidebarState((previous) => {
      if (previous === "open") return "collapsed";
      if (previous === "collapsed") return "open";
      return previous;
    });
  }, [setCurrentNavigationSidebarState]);

  const evaluationCreationModalState = useStateObject(false);
  const createEvaluation = useCallback(() => {
    evaluationCreationModalState.wrappedValue = true;
  }, [evaluationCreationModalState]);

  const deleteEvaluation = useCallback(async () => {
    const evaluationToDelete = selectionState.wrappedValue?.item;
    selectionState.wrappedValue = null;
    if (!evaluationToDelete || !currentOrganization) return;

    setIsDeleting(true);
    try {
      if (evaluationToDelete.status !== "Done" && evaluationToDelete.status !== "Cancelled") {
        await fetchCancelEvaluation({
          orgID: currentOrganization.id,
          evaluationGroupID: evaluationToDelete.id,
        });
      }

      const updatePromises = evaluationToDelete.recipeIDs.map(async (recipeID) => {
        const recipe = recipeMap.get(recipeID);
        if (!recipe) return;

        const triggerUpdates = recipe.triggers.flatMap((trigger) =>
          evaluationToDelete.id === trigger.evaluationGroupID ? [trigger.id] : [],
        );

        return await fetchRecordRecipe({
          orgID: currentOrganization.id,
          recipe: {
            id: recipe.id,
            triggerUpdates,
          },
        });
      });

      await Promise.allSettled(updatePromises);
      await refresh();
    } catch (error) {
      console.error("Error deleting recipe", error);
    } finally {
      setIsDeleting(false);
    }
  }, [selectionState, recipeMap, refresh, currentOrganization]);

  const navigateToEvaluation: TableActionHandler = useCallback(
    (itemNode) => {
      router.push(`/app/${organizationSlug}/evaluations/${itemNode.id}`);
    },
    [router, organizationSlug],
  );

  const emptyStateMessage = useMemo(() => {
    if (isLoading) return "Loading Evaluations…";
    const displayName = kindConfigurationForPattern([{ kind: "dataset" }, { kind: "artifact" }], "many").displayName;
    return (
      <EmptyStateContainer>
        <Button size="large" prominence="primary" action={createEvaluation}>
          Run First Evaluation
        </Button>
        <h3>Kick off an evaluation to see how your metrics perform across {displayName}.</h3>
      </EmptyStateContainer>
    );
  }, [isLoading, createEvaluation, kindConfigurationForPattern]);

  const cellRenderer: TableCellRenderer = (itemNode, column, _openItemAction) => {
    if (column.keyPaths === creationTimestampColumKeyPaths) {
      return itemNode?.valueForKeyPaths({
        keyPaths: ["creationTimestamp.localizedDate"],
      }).display;
    }

    if (column.keyPaths[0] === "status") {
      const status = itemNode?.valueForKeyPaths(["status"]).raw as EvaluationStatus | undefined;

      if (!status) return undefined;
      return <StatusIcon status={status} onShowTooltip={showTooltip} onHideTooltip={hideTooltip} />;
    }

    if (column.keyPaths[0] === "action" && itemNode) {
      return (
        <Icon
          $iconPath="/assets/adminPanel/trash.svg"
          onClick={(event) => {
            event.stopPropagation();
            if (isDeleting || !currentOrganization) return;
            selectionState.wrappedValue = itemNode as ItemNode<EvaluationListItem>;
            setDeleteEvaluationDialogOpen(true);
          }}
        />
      );
    }

    return undefined;
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
        <ToolbarItem title={"Evaluations"} edge="center">
          <ContentHeader>Evaluations</ContentHeader>
        </ToolbarItem>
        <ToolbarItem title="Create Evaluation" variant="primary" action={createEvaluation} edge="trailing" />
      </Toolbar>
      <NavigationSidebar sidebarState={navigationSidebarState} />
      <NavigationContent scrollsVertically>
        <TableContainer>
          <Table
            items={paginatedItems}
            columnsState={evaluationColumns}
            selectionState={selectionState}
            sortDescriptorsState={sortDescriptorsState}
            emptyStateComponent={emptyStateMessage}
            shouldNestItems={false}
            action={navigateToEvaluation}
            cellRenderer={cellRenderer}
          />
        </TableContainer>
        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
        />
      </NavigationContent>
      {tooltipState &&
        createPortal(
          <TooltipPopup style={{ top: tooltipState.top, left: tooltipState.left }}>{tooltipState.text}</TooltipPopup>,
          document.body,
        )}
      <EvaluationCreationModal isPresentedState={evaluationCreationModalState} />
      <ConfirmationDialog
        isPresentedState={deleteEvaluationDialogState}
        title="Delete Evaluation?"
        message=" Are you sure you want to delete this evaluation? Deleting this evaluation will remove it and all of its data. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={deleteEvaluation}
        isProcessing={isDeleting}
      />
    </NavigationStack>
  );
};

export default EvaluationPage;
