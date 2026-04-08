"use client"; // Putting this at the top level so it'll propagate all the way down for simplicity

import { type MouseEventHandler, use, useCallback, useContext, useEffect, useMemo, useState } from "react";
import styled, { css } from "styled-components";

import { fetchPreviewRecipe, fetchRecordMetricDefinition, fetchRecordRecipe } from "@/generated/serverEndpoints";
import { type ColumnDescriptor, type MetricDefinition, type RecipeStep, RecipeStepKind } from "@/generated/serverTypes";

import { useBinding, useStateObject } from "@/library/StateObject";
import useLocalStorage from "@/library/useLocalStorage";
import useLocalStorageStateObject from "@/library/useLocalStorageStateObject";
import { usePagination } from "@/library/usePagination";

import { decodeArtifactPathPattern } from "@/model/artifactPath";
import { useEvaluationModels } from "@/model/evaluationModels";
import { filterItems, ItemNode, type SortDescriptor, sortItems } from "@/model/keyPath";
import { METRICS_CSV_COLUMN_DEFINITIONS, parseMetricsCSV } from "@/model/metricsCsvTransform";

import { ContentHeader } from "@/components/ContentHeader";
import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import {
  isRecipeMetric,
  isRecipeMetricSet,
  RecipeContext,
  type RecipeMetric,
  type RecipeMetricSet,
  recipeMetricVisibleFilter,
} from "@/components/contexts/RecipeContext";
import { MetricCreationModal } from "@/components/MetricCreationModal";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { usePresentCreateMetricSetDialog } from "@/components/modals/CreateMetricSetDialog";
import { UploadCSVModal, type UploadCSVModalOnUpload } from "@/components/modals/UploadCSVModal";
import { NavigationSidebar } from "@/components/NavigationSidebar";
import { Pagination } from "@/components/pagination/Pagination";
import { RecipeMetricDetailsSidebar } from "@/components/sidebars/RecipeMetricDetailsSidebar";
import {
  Button,
  Color,
  Font,
  NavigationContent,
  NavigationStack,
  type SidebarState,
  Size,
  Table,
  type TableCellRenderer,
  Toolbar,
  ToolbarItem,
} from "@/components/ui";

import { ArtifactContext } from "@/app/navigator/_shared/context";

// MARK: - Types

type MetricTableItem = (RecipeMetricSet | RecipeMetric) & {
  metricCount?: number;
  evaluationModelDisplayName?: string;
};

// MARK: - Constants

const ColumnIDs = {
  name: ["metricDefinition.name", "metricID", "recipe.name", "id"],
  evaluationModel: ["evaluationModelDisplayName"],
  input: ["evaluationPaths.input"],
  output: ["evaluationPaths.output"],
};

const InputPath = decodeArtifactPathPattern("dataset:/artifact:/input");
const OutputPath = decodeArtifactPathPattern("dataset:/artifact:/output");

const defaultSortDescriptors: SortDescriptor[] = [
  { keyPaths: ["updateTimestamp"], order: "descending" },
  {
    keyPaths: ColumnIDs.name,
    order: "ascending",
  },
];

function evaluationModelIDForMetric(metric: RecipeMetric): string | null {
  for (const step of metric.steps) {
    if (step.kind !== RecipeStepKind.evaluate) continue;
    return step.model?.name ?? null;
  }
  return null;
}

function evaluationModelDisplayNameForMetric({
  metric,
  defaultEvaluationModelID,
  isEvaluationModelsLoading,
  evaluationModelDisplayNameByID,
}: {
  metric: RecipeMetric;
  defaultEvaluationModelID: string | null;
  isEvaluationModelsLoading: boolean;
  evaluationModelDisplayNameByID: Map<string, string>;
}) {
  if (isEvaluationModelsLoading || defaultEvaluationModelID === null) return "";

  const modelID = evaluationModelIDForMetric(metric);
  if (!modelID || modelID === defaultEvaluationModelID) return "";

  return evaluationModelDisplayNameByID.get(modelID) ?? modelID;
}

// MARK: - Styles

const ColorSwatch = styled.div`${() => css`
  position: relative;
  display: inline-block;
  width: 5px;
  height: 18px;
  border-radius: 3px;
  flex-shrink: 0;
  border: 0px;
  margin-top: -14px;
  margin-bottom: -4px;
  margin-right: 4px;

  &::after {
    content: "";
    position: absolute;
    inset: 0px;
    border-radius: inherit;
    outline: ${Size.line.thickness} solid ${Color.line};
    outline-offset: -1px;
    mix-blend-mode: plus-darker;
  }
`}`;

const TableContainer = styled.div`${() => css`
  position: relative;
  height: 100%;

  ${Table} {
    position: absolute;
    inset: 23px 20px 30px 20px;
  }

  tbody tr:has(td span.open) td,
  tbody tr:has(td span.open) {
    border-bottom: 0;

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

const Checkmark = styled.div<{ $checked: boolean }>`${({ $checked }) => css`
  width: 18px;
  height: 18px;
  mask-position: center;
  mask-repeat: no-repeat;
  align-self: center;
  mask-size: 18px;
  ${
    $checked
      ? css`
        background: rgba(0, 0, 0, 0.75);
        mask-image: url("/assets/checkmark-checked.svg");
    `
      : css`
        background: transparent;
    `
  }
`}`;

const NestedTableContainer = styled.div`${() => css`
  border: ${Size.line.thickness} solid ${Color.line};
  border-radius: 16px;
  box-shadow: 0px 0px 8px 0px rgba(0, 0, 0, 0.1);
  overflow: auto;
`}`;

const NestedTable = styled.table`${() => css`
  width: 100%;
  border-collapse: collapse;
`}`;

const NestedHeaderRow = styled.tr`${() => css`
  height: 36px;
  background: ${Color.tableSubHeader};
`}`;

const NestedHeaderCell = styled.th<{ $align?: "center" }>`${({ $align }) => css`
  padding: 0px 20px;
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 400;
  font-family: ${Font.inter};
  color: ${Color.textDark};
  text-align: ${$align === "center" ? "center" : "left"};
  -webkit-user-select: none;
  user-select: none;
  border-right: ${Size.line.thickness} solid ${Color.line};
  &:last-of-type { border-right: 0px; }
`}`;

const NestedBodyRow = styled.tr`${() => css`
  height: 47px;
  border-top: ${Size.line.thickness} solid ${Color.line};
  cursor: pointer;

  &[data-selected="true"],
  &:hover {
    background-color: ${Color.surfaceRowHover};
    text-shadow:
        0.15px 0 0 currentColor,
        -0.15px 0 0 currentColor;
  }
  &[data-selected="true"] {
    background-color: transparent;
  }
`}`;

const NestedBodyCell = styled.td<{ $align?: "center" }>`${({ $align }) => css`
  padding: 0px 20px;
  font-size: ${Size.fontSize.fontSize14};
  font-family: ${Font.inter};
  text-align: ${$align === "center" ? "center" : "left"};
  vertical-align: middle;
  border-right: ${Size.line.thickness} solid ${Color.line};
  &:last-of-type { border-right: 0px; }
  ${
    $align === "center" &&
    css`
    display: table-cell;
    text-align: center;
  `
  }
`}`;

const AddMetricButton = styled.button`${() => css`
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  font-size: ${Size.fontSize.fontSize14};
  font-family: ${Font.ibmPlexSans};
  border-radius: 6px;
  border: ${Size.line.thickness} solid ${Color.line};
  background: ${Color.contentSurface};
  color: ${Color.textDark};
  cursor: pointer;
  margin-left: 8px;
  &:hover { background: ${Color.tableHeader}; }
`}`;

const DisclosureButton = styled.span`${() => css`
  display:flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  cursor: pointer;
  font-weight: 400;
  width: stretch;
`}`;

const DisclosureButtonContent = styled.span`${() => css`
  display: flex;
  align-items: center;
  gap: 6px;
`}`;

const Icon = styled.div<{ $iconPath: string; $collapsed?: boolean }>`${({ $iconPath }) => css`
  width: 16px;
  height: 16px;
  display: flex;
  justify-content: center;
  background-size: contain;
  background-image: url(${$iconPath});
  background-position: center;
  background-repeat: no-repeat;
`}`;

const ButtonStack = styled.div`${() => css`
  display: flex;
  align-items: center;
  gap: 8px;
`}`;

// MARK: - Components
function NestedMetricsTable({
  node,
  inputLabel,
  outputLabel,
  onSelectMetric,
  onDeleteMetric,
  selectedID,
}: {
  node: ItemNode<MetricTableItem>;
  inputLabel: string;
  outputLabel: string;
  onSelectMetric: (child: ItemNode<MetricTableItem>) => void;
  onDeleteMetric: (child: ItemNode<MetricTableItem>) => void;
  selectedID: string | null;
}) {
  const metricNodes = node.orderedChildren as ItemNode<MetricTableItem>[];
  if (metricNodes.length === 0) return null;
  return (
    <tr>
      <td colSpan={2} style={{ padding: "0px 15px 15px" }}>
        <NestedTableContainer>
          <NestedTable>
            <thead>
              <NestedHeaderRow>
                <NestedHeaderCell style={{ width: 200 }}>Metric Name</NestedHeaderCell>
                <NestedHeaderCell>Metric Question</NestedHeaderCell>
                <NestedHeaderCell style={{ width: 135 }}>Judge Model override</NestedHeaderCell>
                <NestedHeaderCell $align="center" style={{ width: 80 }}>
                  {inputLabel}
                </NestedHeaderCell>
                <NestedHeaderCell $align="center" style={{ width: 60 }}>
                  {outputLabel}
                </NestedHeaderCell>
                <NestedHeaderCell $align="center" style={{ width: 40 }} />
              </NestedHeaderRow>
            </thead>
            <tbody>
              {metricNodes.map((child) => {
                const name = child.valueForKeyPaths(ColumnIDs.name).display ?? "";
                const question = child.valueForKeyPaths(["userPrompt"]).display ?? "";
                const hasInput = Boolean(child.valueForKeyPaths(ColumnIDs.input).raw);
                const hasOutput = Boolean(child.valueForKeyPaths(ColumnIDs.output).raw);
                const metricModelDisplayName = child.valueForKeyPaths(ColumnIDs.evaluationModel).display ?? "";
                const color =
                  "color" in child.item ? (child.item as RecipeMetric & { color?: string }).color : undefined;
                return (
                  <NestedBodyRow
                    key={child.id}
                    data-selected={selectedID === child.id}
                    onClick={() => onSelectMetric(child)}
                  >
                    <NestedBodyCell>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {color && (
                          <span
                            style={{
                              display: "inline-block",
                              width: 4,
                              height: 16,
                              borderRadius: 3,
                              backgroundColor: color,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        {name}
                      </span>
                    </NestedBodyCell>
                    <NestedBodyCell>{question}</NestedBodyCell>
                    <NestedBodyCell $align="center">{metricModelDisplayName}</NestedBodyCell>
                    <NestedBodyCell $align="center">
                      <span style={{ display: "flex", justifyContent: "center" }}>
                        <Checkmark $checked={hasInput} />
                      </span>
                    </NestedBodyCell>
                    <NestedBodyCell $align="center">
                      <span style={{ display: "flex", justifyContent: "center" }}>
                        <Checkmark $checked={hasOutput} />
                      </span>
                    </NestedBodyCell>
                    <NestedBodyCell $align="center">
                      <span style={{ display: "flex", justifyContent: "center" }}>
                        <Icon
                          $iconPath="/assets/adminPanel/trash.svg"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteMetric(child);
                          }}
                        />
                      </span>
                    </NestedBodyCell>
                  </NestedBodyRow>
                );
              })}
            </tbody>
          </NestedTable>
        </NestedTableContainer>
      </td>
    </tr>
  );
}
export default function MetricsList(props: { searchParams: Promise<{ sets?: string } | { set?: string }> }) {
  /// Context

  const searchParams = use(props.searchParams);
  const isMetricsMode = !("sets" in searchParams);

  const { currentOrganization, kindConfigurationForPattern } = useContext(OrganizationContext);

  const context = useContext(ArtifactContext);
  if (!context) throw new Error("Component must be used within a ArtifactContextProvider");
  const { nodesByKind } = context;

  const {
    recipeMetricSetNodes,
    recipeMetricNodes,
    isLoading: isRecipesLoading,
    refresh: refreshRecipes,
  } = useContext(RecipeContext);

  const presentCreateMetricSetDialog = usePresentCreateMetricSetDialog();

  /// State

  const [isWorking, setIsWorking] = useState(false);
  const [expandedSetIDs, setExpandedSetIDs] = useState<Set<string>>(new Set());
  const [toggledSetNode, setToggledSetNode] = useState<ItemNode<RecipeMetricSet> | null>(null);

  const navigationSidebarState = useStateObject<SidebarState>("open");
  const [currentNavigationSidebarState, setCurrentNavigationSidebarState] = useBinding(navigationSidebarState);

  const detailSidebarState = useStateObject<SidebarState>("open");
  const [currentDetailsSidebarState, setCurrentDetailsSidebarState] = useBinding(detailSidebarState);

  const selectionState = useStateObject<ItemNode<RecipeMetric | RecipeMetricSet> | null>(null);
  const [selection, setSelection] = useBinding(selectionState);
  const selectedMetricSetID = useMemo(() => selection?.item?.recipe?.id, [selection]);

  const selectedMetricSetName = useMemo(() => {
    const item = selection?.item;
    return isRecipeMetricSet(item) ? (item.recipe.name ?? "") : "";
  }, [selection]);

  const deleteMetricSetDialogState = useStateObject(false);
  const [_isDeleteMetricSetDialogOpen, setDeleteMetricSetDialogOpen] = useBinding(deleteMetricSetDialogState);
  const deleteMetricDialogState = useStateObject(false);
  const [_isDeleteMetricDialogOpen, setDeleteMetricDialogOpen] = useBinding(deleteMetricDialogState);

  const metricSetFilterState = useStateObject<string>("");
  const [metricSetFilter, setMetricSetFilter] = useBinding(metricSetFilterState);

  const isMetricCreationModalOpenState = useStateObject(false);
  const [_isMetricCreationModalOpen, setMetricCreationModalOpen] = useBinding(isMetricCreationModalOpenState);

  const uploadModalState = useStateObject(false);
  const [pendingMetricSetName, setPendingMetricSetName] = useState<string | undefined>(undefined);

  const artifactsForMetricCreation = useMemo(() => {
    // Keep the full candidate set here; MetricCreationModal applies its own per-dataset preview limit.
    return sortItems({
      items: nodesByKind.get("dataset:/artifact:") ?? [],
      sortDescriptors: [{ keyPaths: ["creationTimestamp"], order: "descending" }],
    });
  }, [nodesByKind]);

  const [, setStoredFilteredMetricsSet] = useLocalStorage<string | null>("filtered-metrics-set", "");

  useEffect(() => {
    const searchParamSet = "set" in searchParams && searchParams.set ? searchParams.set : "";
    setStoredFilteredMetricsSet("sets" in searchParams ? null : searchParamSet);
    setMetricSetFilter(searchParamSet);
  }, [searchParams, setStoredFilteredMetricsSet, setMetricSetFilter]);

  const sortDescriptorsState = useLocalStorageStateObject<SortDescriptor[]>(
    "metricsSortDescriptors",
    defaultSortDescriptors,
  );
  const [sortDescriptors] = useBinding(sortDescriptorsState);

  /// Derived State

  const { evaluationModels, defaultEvaluationModelID, isLoading: isEvaluationModelsLoading } = useEvaluationModels();
  const evaluationModelDisplayNameByID = useMemo(
    () => new Map(evaluationModels.map((model) => [model.id, model.displayName])),
    [evaluationModels],
  );

  const metricItemNodes: ItemNode<RecipeMetric | RecipeMetricSet>[] = useMemo(() => {
    if (isMetricsMode) {
      let items = filterItems({ items: recipeMetricNodes, filter: recipeMetricVisibleFilter });
      if (metricSetFilter) {
        items = items.filter((node) => node.item.recipe.id === metricSetFilter);
      }
      return items.map(
        (node) =>
          new ItemNode<MetricTableItem>({
            id: node.id,
            item: {
              ...node.item,
              evaluationModelDisplayName: evaluationModelDisplayNameForMetric({
                metric: node.item,
                defaultEvaluationModelID,
                isEvaluationModelsLoading,
                evaluationModelDisplayNameByID,
              }),
            },
          }),
      );
    }

    const items = filterItems({ items: recipeMetricSetNodes, filter: recipeMetricVisibleFilter });

    return items.map((node) => {
      const metricNodes = filterItems({ items: node.allChildren<RecipeMetric>(), filter: recipeMetricVisibleFilter });

      const newNode = new ItemNode<MetricTableItem>({
        id: node.id,
        item: {
          ...node.item,
          metricCount: metricNodes.length,
          evaluationModelDisplayName: "",
        },
      });

      for (const metricNode of metricNodes) {
        newNode.addChild(
          new ItemNode<MetricTableItem>({
            id: metricNode.id,
            item: {
              ...metricNode.item,
              metricCount: undefined,
              evaluationModelDisplayName: evaluationModelDisplayNameForMetric({
                metric: metricNode.item,
                defaultEvaluationModelID,
                isEvaluationModelsLoading,
                evaluationModelDisplayNameByID,
              }),
            },
          }),
        );
      }

      return newNode;
    });
  }, [
    isMetricsMode,
    recipeMetricNodes,
    metricSetFilter,
    recipeMetricSetNodes,
    defaultEvaluationModelID,
    isEvaluationModelsLoading,
    evaluationModelDisplayNameByID,
  ]);

  const sortedMetricSets = useMemo(() => {
    const sortedItems = sortItems({ items: metricItemNodes, sortDescriptors });
    for (const item of sortedItems) {
      item.orderChildren({ sortDescriptors });
    }
    return sortedItems;
  }, [metricItemNodes, sortDescriptors]);
  const { page, totalPages, paginatedItems, goToPage } = usePagination({
    items: sortedMetricSets,
    isLoading: isRecipesLoading,
  });

  const inputLabel = kindConfigurationForPattern(InputPath, "evaluate").displayName ?? "Input";
  const outputLabel = kindConfigurationForPattern(OutputPath, "evaluate").displayName ?? "Expected";
  const columns: ColumnDescriptor[] = useMemo(() => {
    if (isMetricsMode) {
      return [
        { title: "Label", keyPaths: ColumnIDs.name, width: "auto", alignment: "leading" },
        { title: "Question", keyPaths: ["userPrompt"], width: "auto", alignment: "leading" },
        { title: "Judge Model override", keyPaths: ColumnIDs.evaluationModel, width: "auto", alignment: "center" },
        { title: inputLabel, keyPaths: ColumnIDs.input, width: 80, alignment: "center" },
        { title: outputLabel, keyPaths: ColumnIDs.output, width: 80, alignment: "center" },
      ];
    }
    return [
      { title: "Metric Set", keyPaths: ColumnIDs.name, width: "auto", alignment: "leading" },
      { title: "#", keyPaths: ["metricCount"], width: 80, alignment: "center", textAlign: "center" },
    ];
  }, [isMetricsMode, inputLabel, outputLabel]);

  /// Actions

  const toggleNavigationSidebar = useCallback(() => {
    setCurrentNavigationSidebarState((previous) => {
      if (previous === "open") return "collapsed";
      if (previous === "collapsed") return "open";
      return previous;
    });
  }, [setCurrentNavigationSidebarState]);

  const toggleDetailSidebar: MouseEventHandler = useCallback(
    (event) => {
      setCurrentDetailsSidebarState((previous) => {
        if (previous === "open") return "collapsed";
        if (previous === "collapsed") return "open";
        return previous;
      });
      event.stopPropagation();
    },
    [setCurrentDetailsSidebarState],
  );
  const toggleSetExpansion = useCallback((node: ItemNode<RecipeMetricSet>) => {
    setToggledSetNode(node);
    setExpandedSetIDs((prev) => {
      const next = new Set(prev);
      if (prev.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!toggledSetNode) return;

    const isExpanded = expandedSetIDs.has(toggledSetNode.id);
    setSelection(isExpanded ? (toggledSetNode as unknown as ItemNode<RecipeMetric | RecipeMetricSet>) : null);
    setToggledSetNode(null);
  }, [expandedSetIDs, toggledSetNode, setSelection]);

  const createMetric = useCallback(() => setMetricCreationModalOpen(true), [setMetricCreationModalOpen]);

  const deleteMetric = useCallback(async () => {
    const selection = selectionState.wrappedValue?.item;
    if (!isRecipeMetric(selection)) return;
    if (!currentOrganization?.id || isWorking) return;

    // 1. Unselect first - sidebar will show "No Row Selected"
    setSelection(null);

    // 2. Delete
    setIsWorking(true);
    try {
      await fetchRecordRecipe({
        orgID: currentOrganization?.id,
        recipe: {
          id: selection.recipe.id,
          isDeleted:
            !selection.recipe.name && selection.recipe.steps.every((step) => step.status === "hidden")
              ? true
              : undefined,
          updateTimestamp: new Date().toISOString(),
          stepUpdates: selection.recipe.steps.map((step) => ({
            ...step,
            status: selection.steps.has(step) ? "hidden" : step.status,
          })),
        },
      });

      await fetchRecordMetricDefinition({
        orgID: currentOrganization.id,
        metricDefinition: {
          id: selection.metricID,
          isDeleted: true,
        },
      });

      // 3. Refresh
      await refreshRecipes();
    } finally {
      setIsWorking(false);
    }
  }, [currentOrganization?.id, selectionState, isWorking, refreshRecipes, setSelection]);

  const promptDeleteMetric = useCallback(
    (metricNode?: ItemNode<RecipeMetric> | null) => {
      if (isWorking) return;
      if (metricNode && isRecipeMetric(metricNode.item)) {
        setSelection(metricNode);
        setDeleteMetricDialogOpen(true);
        return;
      }
      if (!selection || !isRecipeMetric(selection.item)) return;
      setDeleteMetricDialogOpen(true);
    },
    [isWorking, selection, setDeleteMetricDialogOpen, setSelection],
  );

  const metricNodeForID = useCallback(
    (metricID: string) => {
      for (const setNode of recipeMetricSetNodes) {
        const found = setNode.allChildren<RecipeMetric>().find((node) => node.id === metricID);
        if (found) return found;
      }
      return null;
    },
    [recipeMetricSetNodes],
  );

  const selectMetricFromTable = useCallback(
    (child: ItemNode<MetricTableItem>) => {
      setSelection(metricNodeForID(child.id));
    },
    [metricNodeForID, setSelection],
  );

  const deleteMetricSet = useCallback(async () => {
    if (!currentOrganization?.id || !selection || !isRecipeMetricSet(selection.item) || isWorking) return;

    // 1. Unselect first - sidebar will show "No Row Selected"
    setSelection(null);

    // 2. Delete
    setIsWorking(true);
    try {
      await fetchRecordRecipe({
        orgID: currentOrganization.id,
        recipe: {
          id: selection.item.recipe.id,
          isDeleted: true,
          updateTimestamp: new Date().toISOString(),
        },
      });

      // 3. Refresh
      await refreshRecipes();
    } finally {
      setIsWorking(false);
    }
  }, [currentOrganization?.id, selection, isWorking, refreshRecipes, setSelection]);

  /// Clear the selection when the mode changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Using the dependency to control re-renders
  useEffect(() => {
    setSelection(null);
  }, [isMetricsMode, setSelection]);

  const openUploadModal = useCallback(
    (metricSetName?: string) => {
      setMetricCreationModalOpen(false);
      setPendingMetricSetName(metricSetName);
      uploadModalState.wrappedValue = true;
    },
    [setMetricCreationModalOpen, uploadModalState],
  );

  const openMetricSetCreationModal = useCallback(async () => {
    await presentCreateMetricSetDialog({
      orgID: currentOrganization?.id,
      isFirstMetricSet: recipeMetricSetNodes?.length === 0,
      onUploadCSVRequest: openUploadModal,
    });
  }, [presentCreateMetricSetDialog, currentOrganization?.id, recipeMetricSetNodes?.length, openUploadModal]);

  const onUpload = useCallback<UploadCSVModalOnUpload>(
    async ({ summary, parsed, errorRowIndices }) => {
      if (!currentOrganization?.id) return;

      setIsWorking(true);
      try {
        const recipeName =
          pendingMetricSetName ?? (summary.fileName.replace(/\.csv$/i, "").trim() || "Imported Metrics");
        const now = new Date().toISOString();
        const recipeID = crypto.randomUUID();

        const allMetricDefinitions: MetricDefinition[] = [];
        const allSteps: RecipeStep[] = [];
        const backendErrors: string[] = [];

        // Process each valid row (skip rows with validation errors)
        const rowProcessingTasks = [];
        for (let index = 0; index < parsed.length; index++) {
          if (errorRowIndices.has(index)) continue;

          const row = parsed[index];
          if (!row) continue;

          // Safe cast as previous parsing steps did validation, type checking, and converstion
          const metricName = row["Metric Name"] as string;
          const question = row["Metric Question"] as string;
          const input = row.Input as boolean;
          const output = row.Expected as boolean;

          rowProcessingTasks.push(
            (async () => {
              try {
                // Use backend to generate metric definition and steps
                const previewRecipeResponse = await fetchPreviewRecipe({
                  orgID: currentOrganization.id,
                  metricName,
                  question,
                  artifactSelectors: [], // No artifacts for CSV import
                  evaluateChildArtifactPaths: [
                    ...(input ? [[{ id: "input" }]] : []),
                    ...(output ? [[{ id: "output" }]] : []),
                  ],
                });

                // Preserve the row question as metric description while keeping backend-generated IDs/steps.
                return { success: true as const, data: previewRecipeResponse, question };
              } catch (error) {
                return {
                  success: false as const,
                  error: `Metric "${metricName}": Failed to process - ${error instanceof Error ? error.message : "Unknown error"}`,
                };
              }
            })(),
          );
        }

        const previewResults = await Promise.all(rowProcessingTasks);

        // Collect results and errors
        for (const result of previewResults) {
          if (result.success) {
            allMetricDefinitions.push({
              ...result.data.metricDefinition,
              description: result.question,
            });
            allSteps.push(...result.data.steps);
          } else {
            backendErrors.push(result.error);
          }
        }

        // Log backend errors if any
        if (backendErrors.length > 0) {
          console.error("CSV import backend errors:", backendErrors);
          // TODO: Show errors to user
        }

        // Save each metric definition with group set to recipe name in parallel
        await Promise.all(
          allMetricDefinitions.map((metricDefinition) =>
            fetchRecordMetricDefinition({
              orgID: currentOrganization.id,
              metricDefinition: {
                ...metricDefinition,
                group: recipeName,
              },
            }),
          ),
        );

        // Save the recipe with all steps
        if (allMetricDefinitions.length > 0) {
          await fetchRecordRecipe({
            orgID: currentOrganization.id,
            recipe: {
              id: recipeID,
              name: recipeName,
              creationTimestamp: now,
              stepUpdates: allSteps,
              triggerUpdates: [],
              updateTimestamp: now,
            },
          });
        }

        // Refresh recipes (modal will close itself)
        await refreshRecipes();
      } catch (error) {
        console.error("Error uploading CSV:", error);
        // TODO: Show error to user
      } finally {
        setIsWorking(false);
      }
    },
    [currentOrganization, refreshRecipes, pendingMetricSetName],
  );

  /// Rendering

  const cellRenderer: TableCellRenderer<ItemNode<MetricTableItem>> = useCallback((node, { keyPaths }) => {
    if (keyPaths === ColumnIDs.input || keyPaths === ColumnIDs.output) {
      return <Checkmark $checked={Boolean(node.valueForKeyPaths(keyPaths).raw)} />;
    }
    if (keyPaths === ColumnIDs.name && "color" in node.item) {
      return (
        <>
          <ColorSwatch style={{ backgroundColor: node.item.color }} />
          {node.valueForKeyPaths(keyPaths).display}
        </>
      );
    }
    const value = node.valueForKeyPaths(keyPaths);
    return value?.display ?? "";
  }, []);

  const emptyStateComponent = useMemo(() => {
    if (isRecipesLoading) return "Loading…";
    if (isMetricsMode) {
      const displayName = kindConfigurationForPattern([{ kind: "dataset" }, { kind: "artifact" }], "many").displayName;
      return (
        <EmptyStateContainer>
          <Button size="large" keyEquivalent="Upload" action={createMetric}>
            Add Metric
          </Button>
          <h3>Add a metric to start measuring {displayName}.</h3>
        </EmptyStateContainer>
      );
    }

    return (
      <EmptyStateContainer>
        <Button size="large" keyEquivalent="Upload" action={openMetricSetCreationModal}>
          Add Metric Set
        </Button>
        <h3>Add a metric set to group related metrics and reuse them across evaluations.</h3>
      </EmptyStateContainer>
    );
  }, [isRecipesLoading, isMetricsMode, kindConfigurationForPattern, createMetric, openMetricSetCreationModal]);

  /// Component

  return (
    <NavigationStack>
      <Toolbar>
        <ToolbarItem title={"Metrics"} edge="center">
          <ContentHeader>Metric Sets</ContentHeader>
        </ToolbarItem>
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
          title={currentDetailsSidebarState === "open" ? "Hide Details" : "Show Details"}
          icon={
            currentDetailsSidebarState === "open" ? "adminPanel/Side-bar-icon-close" : "adminPanel/Side-bar-icon-open"
          }
          action={toggleDetailSidebar}
          edge="trailing"
          ignoresSidebar
        />
        <ToolbarItem title="Create Metric Set" variant="primary" action={openMetricSetCreationModal} edge="trailing" />
      </Toolbar>
      <NavigationSidebar sidebarState={navigationSidebarState} />
      <NavigationContent scrollsVertically>
        <TableContainer>
          <Table
            items={paginatedItems}
            columnsState={columns}
            selectionState={selectionState}
            sortDescriptorsState={sortDescriptorsState}
            shouldNestItems={false}
            emptyStateComponent={emptyStateComponent}
            cellRenderer={(node, column, action) => {
              // Sets mode: name column gets caret + bold label
              if (!isMetricsMode && column.keyPaths === ColumnIDs.name) {
                const isOpen = expandedSetIDs.has(node.id);
                const hasChildren = node.orderedChildren.length > 0;
                return (
                  <DisclosureButton
                    onClick={
                      hasChildren
                        ? (e) => {
                            e.stopPropagation();
                            toggleSetExpansion(node as ItemNode<RecipeMetricSet>);
                          }
                        : undefined
                    }
                    style={{ cursor: hasChildren ? "pointer" : "default" }}
                    className={isOpen ? "open" : undefined}
                  >
                    <DisclosureButtonContent>
                      {hasChildren && (
                        <span
                          style={{
                            display: "inline-block",
                            width: 4,
                            height: 16,
                            borderRadius: 3,
                            backgroundColor: Color.emphasizedText,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      {node.valueForKeyPaths(ColumnIDs.name).display}
                    </DisclosureButtonContent>
                    <ButtonStack>
                      <AddMetricButton
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelection(node as unknown as ItemNode<RecipeMetric | RecipeMetricSet>);
                          createMetric();
                        }}
                        style={{ marginLeft: 8 }}
                      >
                        + Add Metric
                      </AddMetricButton>
                      <Icon
                        $iconPath="/assets/adminPanel/trash.svg"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelection(node as unknown as ItemNode<RecipeMetric | RecipeMetricSet>);
                          setDeleteMetricSetDialogOpen(true);
                        }}
                        style={{ marginLeft: 8, cursor: "pointer" }}
                      />
                    </ButtonStack>
                  </DisclosureButton>
                );
              }
              return cellRenderer(node as unknown as ItemNode<MetricTableItem>, column, action);
            }}
            expansionRenderer={
              !isMetricsMode
                ? (node) => {
                    if (!expandedSetIDs.has(node.id)) return null;
                    return (
                      <NestedMetricsTable
                        node={node as unknown as ItemNode<MetricTableItem>}
                        inputLabel={inputLabel}
                        outputLabel={outputLabel}
                        selectedID={selection?.id ?? null}
                        onSelectMetric={selectMetricFromTable}
                        onDeleteMetric={(child) => {
                          promptDeleteMetric(metricNodeForID(child.id));
                        }}
                      />
                    );
                  }
                : undefined
            }
          />
        </TableContainer>
        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
        />
      </NavigationContent>
      <RecipeMetricDetailsSidebar
        resizeIdentifier="metric-details"
        selectionState={selectionState}
        sidebarState={detailSidebarState}
      />
      <MetricCreationModal
        nodes={artifactsForMetricCreation}
        isPresentedState={isMetricCreationModalOpenState}
        refreshRecipes={refreshRecipes}
        onUploadCSVRequest={openUploadModal}
        defaultMetricSetID={selectedMetricSetID}
      />
      <ConfirmationDialog
        isPresentedState={deleteMetricDialogState}
        title="Delete Metric"
        message="Are you sure you want to delete this metric? If this metric is part of an evaluation, deleting it will affect your past evaluations. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={deleteMetric}
        isProcessing={isWorking}
      />
      <ConfirmationDialog
        isPresentedState={deleteMetricSetDialogState}
        title="Delete metric set"
        message={`Are you sure you want to delete the metric set "${selectedMetricSetName ?? ""}"? If this metric set is part of an evaluation, deleting it will affect your past evaluations. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={deleteMetricSet}
        isProcessing={isWorking}
      />
      <UploadCSVModal
        isPresentedState={uploadModalState}
        columnDefinitions={METRICS_CSV_COLUMN_DEFINITIONS}
        parseCSV={parseMetricsCSV}
        onUpload={onUpload}
        exampleRow="Politeness_Check, Did the agent say hello?, False, True"
      />
    </NavigationStack>
  );
}
