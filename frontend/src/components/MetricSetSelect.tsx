import { useContext, useEffect, useMemo } from "react";
import styled, { css } from "styled-components";

import type { RecipeID } from "@/generated/serverTypes";

import { type StateObject, useBinding, useDerivedState } from "@/library/StateObject";

import { filterItems, type ItemNode, sortItems } from "@/model/keyPath";

import {
  RecipeContext,
  type RecipeMetric,
  type RecipeMetricSet,
  recipeMetricSetSortedByName,
  recipeMetricVisibleFilter,
} from "@/components/contexts/RecipeContext";
import {
  CheckboxButton,
  type CheckboxState,
  Color,
  Label,
  LabeledControl,
  Size,
  TruncatingText,
} from "@/components/ui";

// MARK: - Styles

const Constants = {
  metricSetRowHeight: 32,
};

const MetricSetsList = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  max-height: ${Constants.metricSetRowHeight * 5.5}px;
  overflow-y: auto;
  overflow-x: hidden;
  border-radius: 12px;
  border: ${Size.line.thickness} solid ${Color.line};
  background-color: ${Color.contentSurface};
  scrollbar-width: thin;
`}`;

const MetricSetListItem = styled.div`${() => css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  background-color: ${Color.contentSurface};
  min-height: ${Constants.metricSetRowHeight}px;

  &:first-of-type {
    background-color: ${Color.tableHeader};
    position: sticky;
    top: 0px;
    z-index: 1;
  }

  ${CheckboxButton} {
    flex: 1;
    gap: 0px;
  }
`}`;

const MetricCount = styled.span`${() => css`
  font-size: ${Size.fontSize.fontSize12};
  color: ${Color.textDark};
  white-space: nowrap;
  flex-shrink: 0;
`}`;

const MetricSummary = styled.div`${() => css`
  margin-top: 8px;
  font-size: ${Size.fontSize.fontSize12};
  color: ${Color.textDark};
  text-align: right;
  padding-right: 10px;
`}`;

// MARK: - Components

const formatMetricCount = (count: number) => `${count} Metric${count === 1 ? "" : "s"}`;
const formatArtifactCount = (count: number) => `${count} Artifact${count === 1 ? "" : "s"}`;
const MetricSetCheckboxRow = ({
  metricSet,
  selectionState,
  metricCount,
}: {
  metricSet: RecipeMetricSet;
  selectionState: StateObject<Set<RecipeID>>;
  metricCount: number;
}) => {
  const checkboxState = useDerivedState(
    selectionState,
    {
      get: (selection): CheckboxState => (selection.has(metricSet.id) ? "on" : "off"),
      set: (selection, newValue) => {
        const nextSelection = new Set(selection);
        const shouldSelect = newValue !== "off";
        if (shouldSelect) {
          nextSelection.add(metricSet.id);
        } else {
          nextSelection.delete(metricSet.id);
        }
        return nextSelection;
      },
    },
    [metricSet.id],
  );

  return (
    <MetricSetListItem>
      <CheckboxButton selectionState={checkboxState}>
        <TruncatingText $lineLimit={1}>{metricSet.recipe.name}</TruncatingText>
      </CheckboxButton>
      <MetricCount>{formatMetricCount(metricCount)}</MetricCount>
    </MetricSetListItem>
  );
};

const AllMetricSetsCheckboxRow = ({
  availableMetricSetIDs,
  selectionState,
  metricCount,
}: {
  availableMetricSetIDs: Set<RecipeID>;
  selectionState: StateObject<Set<RecipeID>>;
  metricCount: number;
}) => {
  const checkboxState = useDerivedState(
    selectionState,
    {
      get: (selection) => {
        if (availableMetricSetIDs.size === 0 || selection.size === 0) return "off";
        return availableMetricSetIDs.intersection(selection).size === availableMetricSetIDs.size ? "on" : "mixed";
      },
      set: (selection, newValue) => {
        const nextSelection = new Set(selection);
        const shouldSelect = newValue !== "off";
        for (const id of availableMetricSetIDs) {
          if (shouldSelect) {
            nextSelection.add(id);
          } else {
            nextSelection.delete(id);
          }
        }
        return nextSelection;
      },
    },
    [availableMetricSetIDs],
  );

  return (
    <MetricSetListItem>
      <CheckboxButton selectionState={checkboxState}>All Metric Sets</CheckboxButton>
      <MetricCount>{formatMetricCount(metricCount)}</MetricCount>
    </MetricSetListItem>
  );
};

const OtherMetricsCheckboxRow = ({
  sortedOtherRecipeMetrics,
  selectionState,
  metricCount,
}: {
  sortedOtherRecipeMetrics: RecipeMetric[];
  selectionState: StateObject<Set<RecipeID>>;
  metricCount: number;
}) => {
  const availableIDSet = useMemo(
    () => new Set(sortedOtherRecipeMetrics.map(({ recipe }) => recipe.id)),
    [sortedOtherRecipeMetrics],
  );

  const checkboxState = useDerivedState(
    selectionState,
    {
      get: (selection) => {
        if (availableIDSet.size === 0 || selection.size === 0) return "off";
        return availableIDSet.intersection(selection).size === availableIDSet.size ? "on" : "mixed";
      },
      set: (selection, newValue) => {
        const nextSelection = new Set(selection);
        const shouldSelect = newValue !== "off";
        for (const id of availableIDSet) {
          if (shouldSelect) {
            nextSelection.add(id);
          } else {
            nextSelection.delete(id);
          }
        }
        return nextSelection;
      },
    },
    [availableIDSet],
  );

  return (
    <MetricSetListItem>
      <CheckboxButton selectionState={checkboxState}>Other Metrics</CheckboxButton>
      <MetricCount>{formatMetricCount(metricCount)}</MetricCount>
    </MetricSetListItem>
  );
};

type MetricSetSelectProps = {
  selectionState: StateObject<Set<RecipeID>>;
  onAvailableMetricSetIDsChange?: (availableIDs: Set<RecipeID>) => void;
  label?: string;
  artifactCount?: number;
};

export const MetricSetSelect = ({
  selectionState,
  onAvailableMetricSetIDsChange,
  label = "Metric Sets",
  artifactCount = 0,
}: MetricSetSelectProps) => {
  const { recipeMetricSetNodes } = useContext(RecipeContext);
  const [selectedMetricSetIDs] = useBinding(selectionState);

  const visibleRecipeMetricSets = useMemo(
    () => filterItems({ items: recipeMetricSetNodes, filter: recipeMetricVisibleFilter }),
    [recipeMetricSetNodes],
  );

  const sortedRecipeMetricSets = useMemo(
    () => sortItems({ items: visibleRecipeMetricSets, sortDescriptors: [recipeMetricSetSortedByName] }),
    [visibleRecipeMetricSets],
  );

  const otherRecipeMetricSets = useMemo(
    () => recipeMetricSetNodes.filter((metricSet) => !metricSet.item.recipe.name && !metricSet.item.isDeleted),
    [recipeMetricSetNodes],
  );

  const sortedOtherRecipeMetrics = useMemo(
    () =>
      sortItems({
        items: filterItems({
          items: otherRecipeMetricSets.flatMap(
            ({ children }) => Array.from(children.values()) as ItemNode<RecipeMetric>[],
          ),
          filter: recipeMetricVisibleFilter,
        }),
        sortDescriptors: [recipeMetricSetSortedByName],
      }).map(({ item }) => item),
    [otherRecipeMetricSets],
  );

  const availableMetricSetIDs = useMemo(
    () =>
      new Set(
        visibleRecipeMetricSets.map((node) => node.item.id).concat(otherRecipeMetricSets.map((node) => node.item.id)),
      ),
    [visibleRecipeMetricSets, otherRecipeMetricSets],
  );

  const metricCountByRecipeID = useMemo(() => {
    const map = new Map<RecipeID, number>();
    for (const node of visibleRecipeMetricSets) {
      const metricNodes = node.allChildren<RecipeMetric>();
      let enabledCount = 0;
      for (const metricNode of metricNodes) {
        if (metricNode.item?.isEnabled) enabledCount += 1;
      }
      map.set(node.item.id, enabledCount);
    }
    for (const node of otherRecipeMetricSets) {
      const metricNodes = node.allChildren<RecipeMetric>();
      let enabledCount = 0;
      for (const metricNode of metricNodes) {
        if (metricNode.item?.isEnabled) enabledCount += 1;
      }
      map.set(node.item.id, enabledCount);
    }
    return map;
  }, [visibleRecipeMetricSets, otherRecipeMetricSets]);

  const totalMetricsAcrossAll = useMemo(() => {
    let sum = 0;
    for (const count of metricCountByRecipeID.values()) sum += count;
    return sum;
  }, [metricCountByRecipeID]);

  const totalOtherMetrics = sortedOtherRecipeMetrics.length;

  const totalSelectedMetrics = useMemo(() => {
    let sum = 0;
    for (const id of selectedMetricSetIDs) {
      const count = metricCountByRecipeID.get(id);
      if (typeof count === "number") sum += count;
    }
    return sum;
  }, [metricCountByRecipeID, selectedMetricSetIDs]);

  useEffect(() => {
    const selection = selectionState.wrappedValue;
    const filteredIDs: RecipeID[] = [];
    let removed = false;
    for (const id of selection) {
      if (availableMetricSetIDs.has(id)) {
        filteredIDs.push(id);
      } else {
        removed = true;
      }
    }

    if (removed) {
      selectionState.wrappedValue = new Set(filteredIDs);
    }
  }, [availableMetricSetIDs, selectionState]);

  useEffect(() => {
    onAvailableMetricSetIDsChange?.(availableMetricSetIDs);
  }, [availableMetricSetIDs, onAvailableMetricSetIDsChange]);

  return (
    <LabeledControl>
      <Label>{label}</Label>
      <MetricSetsList>
        <AllMetricSetsCheckboxRow
          availableMetricSetIDs={availableMetricSetIDs}
          selectionState={selectionState}
          metricCount={totalMetricsAcrossAll}
        />
        {sortedRecipeMetricSets.map((node) => (
          <MetricSetCheckboxRow
            key={node.item.id}
            metricSet={node.item}
            selectionState={selectionState}
            metricCount={metricCountByRecipeID.get(node.item.id) ?? 0}
          />
        ))}
        {totalOtherMetrics > 0 && (
          <OtherMetricsCheckboxRow
            sortedOtherRecipeMetrics={sortedOtherRecipeMetrics}
            selectionState={selectionState}
            metricCount={totalOtherMetrics}
          />
        )}
      </MetricSetsList>
      <MetricSummary>
        {`Evaluating ${formatArtifactCount(artifactCount)} and ${formatMetricCount(totalSelectedMetrics)}`}
      </MetricSummary>
    </LabeledControl>
  );
};
