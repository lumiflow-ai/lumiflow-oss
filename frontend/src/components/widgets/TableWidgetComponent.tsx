import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useLayoutEffect, useMemo } from "react";
import styled, { css } from "styled-components";

import {
  type ArtifactSelector,
  type CSSColor,
  type MetricDefinition,
  type MetricID,
  TableContents,
  type TableWidget,
} from "@/generated/serverTypes";

import { type StateObject, useBinding, useStateObject } from "@/library/StateObject";
import useLocalStorageStateObject from "@/library/useLocalStorageStateObject";
import { usePagination } from "@/library/usePagination";

import type { ArtifactNode } from "@/model/artifactNode";
import { encodeArtifactSelector } from "@/model/artifactPath";
import { filterItems, isPrimitiveValue, type SortDescriptor, sortItems } from "@/model/keyPath";
import { groupNodesByKind } from "@/model/kinds";

import type { KindConfigurationLookup } from "@/components/contexts/OrganizationContext";
import { Pagination } from "@/components/pagination/Pagination";
import {
  Table,
  type TableActionHandler,
  type TableCellRenderer,
  type TableColumnDescriptor,
  type TableInteractionHandler,
  TableLink,
  TableUserIntent,
} from "@/components/ui/Table";

// MARK: - Constants

const defaultSortDescriptors: SortDescriptor[] = [{ keyPaths: ["id"], order: "ascending" }];

// MARK: - Styles

const Container = styled.div`${css`
  display: flex;
  flex-direction: column;
  height: 100%;
`}`;

const TableContainer = styled.div`${css`
  position: relative;
  flex-grow: 1;

  ${Table} {
    position: absolute;
    inset: 0px 0px -1px 0px;
    overflow: auto;
    min-height: auto;

    outline: 0px;
  }
`}`;

const Icon = styled.div<{ $iconPath: string }>`
  width: 18px;
  height: 18px;
  display: flex;
  justify-content: center;
  background-size: contain;
  background-image: url(${({ $iconPath }) => $iconPath});
  background-position: center;
  background-repeat: no-repeat;
`;

// MARK: - Helper Components

// MARK: - Table Widget Component

export const TableWidgetComponent = ({
  widget,
  currentNode,
  artifactSelector,
  activeEventSummaryID,
  nodes,
  currentSelectionState,
  organizationSlug,
  metricDefinitionForID,
  kindConfigurationForPattern,
  emptyState,
  onDeleteArtifact,
}: {
  widget: TableWidget;
  currentNode: ArtifactNode | null;
  artifactSelector: ArtifactSelector | null;
  activeEventSummaryID: string | null;
  nodes: ArtifactNode[] | null;
  currentSelectionState?: StateObject<ArtifactNode | null>;
  organizationSlug: string | null;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
  metricColorForID: (id: MetricID) => CSSColor;
  kindConfigurationForPattern: KindConfigurationLookup;
  emptyState?: ReactNode;
  onDeleteArtifact?: (node: ArtifactNode) => void;
}) => {
  /// Context
  const ENABLE_HIERARCHY = false;
  const router = useRouter();

  /// State

  const sortDescriptorsState = useLocalStorageStateObject("sortDescriptors", defaultSortDescriptors);
  const [sortDescriptors] = useBinding(sortDescriptorsState);

  const snapshotSelectionState = useStateObject<ArtifactNode | null>(null);

  const contentsMode = widget.contents;
  const baseNodeList = useMemo(() => {
    if (currentNode) {
      switch (contentsMode) {
        case TableContents.type:
          return Array.from(groupNodesByKind(currentNode).children.values());
        case TableContents.snapshot:
          return Array.from(currentNode.splitIntoSnapshotNodes().children.values());
        case TableContents.artifact:
          return Array.from(currentNode.children.values());
        default:
          return Array.from(currentNode.children.values());
      }
    }
    if (nodes) {
      switch (contentsMode) {
        case TableContents.type:
          return Array.from(groupNodesByKind(nodes).children.values());
        case TableContents.snapshot:
          return nodes.flatMap((node) => Array.from(node.splitIntoSnapshotNodes().children.values()));
        case TableContents.artifact:
          return nodes;
        default:
          return nodes;
      }
    }
    return undefined;
  }, [currentNode, nodes, contentsMode]);

  const isSplitBySnapshot = contentsMode === TableContents.snapshot;
  /// Only pass an event summary ID if we aren't splitting contents based on snapshot.
  const selectedEventSummaryID = isSplitBySnapshot ? null : activeEventSummaryID;

  const filter = widget.filter;
  const filteredNodes = useMemo(() => {
    return filterItems({
      items: baseNodeList,
      filter,
      activeEventSummaryID: selectedEventSummaryID,
      metricDefinitionForID,
      kindConfigurationForPattern,
    });
  }, [baseNodeList, filter, selectedEventSummaryID, metricDefinitionForID, kindConfigurationForPattern]);

  const sortedDisplayNodes = useMemo(() => {
    if (!filteredNodes) return undefined;
    return sortItems({
      items: filteredNodes,
      sortDescriptors,
      activeEventSummaryID: selectedEventSummaryID,
      metricDefinitionForID,
      kindConfigurationForPattern,
    });
  }, [filteredNodes, sortDescriptors, selectedEventSummaryID, metricDefinitionForID, kindConfigurationForPattern]);

  const { page, totalPages, paginatedItems, goToPage } = usePagination({
    items: sortedDisplayNodes ?? [],
  });

  /// When displaying snapshots, modify the current selection to track the current snapshot rather than the current artifact.
  useLayoutEffect(() => {
    if (!isSplitBySnapshot) return;
    snapshotSelectionState.wrappedValue = filteredNodes?.find(({ id }) => id === activeEventSummaryID) ?? null;
  }, [isSplitBySnapshot, snapshotSelectionState, filteredNodes, activeEventSummaryID]);
  const selectionState = isSplitBySnapshot ? snapshotSelectionState : currentSelectionState;

  const columns = useMemo(() => {
    if (!onDeleteArtifact) return widget.columns;
    return [
      ...widget.columns,
      {
        title: "",
        keyPaths: ["_action"],
        width: 40,
        alignment: "center",
      } satisfies TableColumnDescriptor,
    ];
  }, [widget.columns, onDeleteArtifact]);

  /// Actions

  const interactionHandler: TableInteractionHandler = useCallback(() => {
    if (isSplitBySnapshot) return TableUserIntent.handleAction;
    return TableUserIntent.auto;
  }, [isSplitBySnapshot]);

  const openArtifact: TableActionHandler<ArtifactNode> = useCallback(
    (node) => {
      if (node.artifact?.artifactPath) {
        const snapshotEventSummaryID = node.artifact?.snapshots.at(-1)?.eventSummaryID ?? selectedEventSummaryID;

        const linkID = encodeArtifactSelector({
          tags: artifactSelector?.tags ?? [],
          eventSummaryIDs: snapshotEventSummaryID
            ? [snapshotEventSummaryID]
            : (artifactSelector?.eventSummaryIDs ?? []),
          generationIDs: artifactSelector?.generationIDs ?? [],
          artifactPath: node.artifact.artifactPath,
        });

        router.push(`/app/${organizationSlug}/artifacts/${linkID}`);
      } else {
        router.push(`/app/${organizationSlug}/artifacts?kind=${node.id}`);
      }
    },
    [artifactSelector, selectedEventSummaryID, router, organizationSlug],
  );

  const cellRenderer: TableCellRenderer<ArtifactNode> = useCallback(
    (node, column, action) => {
      if (column.keyPaths[0] === "_action" && onDeleteArtifact) {
        return (
          <Icon
            $iconPath="/assets/adminPanel/trash.svg"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteArtifact(node);
            }}
          />
        );
      }

      if (
        Array.isArray(column.keyPaths) &&
        column.keyPaths.length === 1 &&
        column.keyPaths[0] === "creationTimestamp.sortableDate"
      ) {
        return node?.valueForKeyPaths({
          keyPaths: ["creationTimestamp.localizedDate"],
        }).display;
      }
      const displayValue = node.valueForKeyPaths({
        keyPaths: column.keyPaths,
        activeEventSummaryID: isSplitBySnapshot ? null : activeEventSummaryID,
        metricDefinitionForID,
        kindConfigurationForPattern,
      }).display;
      if (node.isMockedValueForKeyPaths(column.keyPaths)) {
        return (
          <TableLink $status={null} className="fakeData" onClick={action}>
            {displayValue}
          </TableLink>
        );
      }

      /// If the value can be rendered as a string, let the table component deal with it.
      if (isPrimitiveValue(displayValue)) return displayValue;
      /// Otherwise, wrap it in a link so interactions work as needed
      return action ? (
        <TableLink $status={null} onClick={action}>
          {displayValue}
        </TableLink>
      ) : (
        displayValue
      );
    },
    [isSplitBySnapshot, activeEventSummaryID, metricDefinitionForID, kindConfigurationForPattern, onDeleteArtifact],
  );

  /// Component

  return (
    <Container>
      <TableContainer>
        <Table
          items={paginatedItems}
          columnsState={columns}
          selectionState={selectionState}
          sortDescriptorsState={sortDescriptorsState}
          action={openArtifact}
          interactionHandler={interactionHandler}
          shouldNestItems={ENABLE_HIERARCHY && widget.showsNestedArtifacts}
          emptyStateComponent={sortedDisplayNodes === null ? "Loading…" : emptyState || "No Artifacts"}
          cellRenderer={cellRenderer}
        />
      </TableContainer>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => goToPage(page - 1)}
        onNext={() => goToPage(page + 1)}
      />
    </Container>
  );
};
TableWidgetComponent.displayName = "TableWidgetComponent";
