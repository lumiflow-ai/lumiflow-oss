import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import styled, { css } from "styled-components";

import type {
  ArtifactSelector,
  CSSColor,
  Dashboard,
  Metric,
  MetricDefinition,
  MetricID,
  Widget,
} from "@/generated/serverTypes";

import { StateObject } from "@/library/StateObject";

import type { ArtifactNode } from "@/model/artifactNode";

import type { ArtifactAnnotationSelection } from "@/components/ArtifactAnnotation";
import type { KindConfigurationLookup } from "@/components/contexts/OrganizationContext";
import { WidgetComponent } from "@/components/widgets";

// MARK: - Constants

const Constants = {
  paddingTop: 4,
  paddingRight: 15,
  paddingBottom: 0,
  paddingLeft: 15,
};

// MARK: - Types

type WidgetRow = {
  id: string;
  startOffset: number;
  endOffset: number;
  lastOffset: number;
  maxHeight: number;
  widgets: Widget[];
};

// MARK: - Styles

const WidgetContainer = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  justify-content: stretch;
  flex-grow: 1;
  width: 100%;
  box-sizing: border-box;
  padding: ${Constants.paddingTop}px ${Constants.paddingRight}px ${Constants.paddingBottom}px ${Constants.paddingLeft}px;
  z-index: 0;
`}`;

const WidgetRowContainer = styled.div`${() => css`
  position: relative;
  display: block;
  width: 100%;
  flex-grow: 1;
`}`;

const emptyMetricsState = new StateObject(new Map<string, Metric>());

export const DashboardRenderer = ({
  dashboard,
  currentNode,
  artifactSelector,
  activeEventSummaryID,
  nodes,
  nodesByID,
  currentSelectionState,
  selectedMetricsState = emptyMetricsState,
  organizationSlug,
  metricDefinitionForID,
  metricColorForID,
  kindConfigurationForPattern,
  autoScrollToFirstHighlight = false,
  emptyState,
  showAnnotations,
  pendingAnnotationSelection,
  activeAnnotationSelections,
  onAnnotationSelection,
  onDeleteArtifact,
}: {
  dashboard: Dashboard | undefined;
  currentNode: ArtifactNode | null;
  artifactSelector?: ArtifactSelector | null;
  activeEventSummaryID?: string | null;
  nodes: ArtifactNode[] | null;
  nodesByID: Map<string, ArtifactNode[]>;
  currentSelectionState: StateObject<ArtifactNode | null>;
  selectedMetricsState?: StateObject<Map<string, Metric>>;
  organizationSlug: string | null;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
  metricColorForID: (id: MetricID) => CSSColor;
  kindConfigurationForPattern: KindConfigurationLookup;
  autoScrollToFirstHighlight?: boolean;
  emptyState?: ReactNode;
  showAnnotations?: boolean;
  pendingAnnotationSelection?: ArtifactAnnotationSelection | null;
  activeAnnotationSelections?: ArtifactAnnotationSelection[];
  onAnnotationSelection?: (selection: ArtifactAnnotationSelection) => void;
  onDeleteArtifact?: (node: ArtifactNode) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.style.setProperty(
      "--cell-size",
      `${(container.clientWidth - Constants.paddingLeft - Constants.paddingRight) / 12}px`,
    );
    container.style.setProperty(
      "--available-height",
      `${container.clientHeight - Constants.paddingTop - Constants.paddingBottom}px`,
    );

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        container.style.setProperty("--cell-size", `${entry.contentBoxSize[0].inlineSize / 12}px`);
        container.style.setProperty(
          "--available-height",
          `${container.clientHeight - Constants.paddingTop - Constants.paddingBottom}px`,
        );
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const widgetRows = useMemo(() => {
    if (!dashboard?.widgets) return [];

    const rows: WidgetRow[] = [];
    for (const widget of dashboard?.widgets ?? []) {
      const matchingRows: number[] = [];
      let insertionIndex = 0;
      // TODO: If we ever get more than 64 widgets, turn this into a binary search.
      for (const row of rows) {
        if (widget.y < row.startOffset && widget.y + widget.height <= row.startOffset) {
          /// If widget is completely _before_ this row, we need to insert it, so stop here.
          break;
        }
        if (widget.y < row.endOffset) {
          /// If widget starts before the end of the row, mark the row as containing it and keep checking other rows.
          matchingRows.push(insertionIndex);
        }
        /// Otherwise, widget starts after the row, so continue to the next row and repeat the check.
        insertionIndex += 1;
      }

      /// One or multiple rows matched, merge them.
      const newRow: WidgetRow = {
        id: "",
        startOffset: widget.y,
        endOffset: widget.y + widget.height,
        lastOffset: 0,
        maxHeight:
          widget.maxHeight === undefined
            ? widget.height
            : widget.maxHeight === null
              ? Number.POSITIVE_INFINITY
              : widget.maxHeight,
        widgets: [widget],
      };

      if (matchingRows.length > 0) {
        /// Integrate the matching rows with the new one we've just created, and delete the old ones we've integrated
        for (const rowIndex of matchingRows.toReversed()) {
          const existingRow = rows[rowIndex];
          const isHeightMismatched =
            newRow.startOffset !== existingRow.startOffset || newRow.endOffset !== existingRow.endOffset;
          newRow.startOffset = Math.min(newRow.startOffset, existingRow.startOffset);
          newRow.endOffset = Math.max(newRow.endOffset, existingRow.endOffset);
          newRow.maxHeight = isHeightMismatched
            ? newRow.endOffset - newRow.startOffset
            : Math.max(Math.min(newRow.maxHeight, existingRow.maxHeight), newRow.endOffset - newRow.startOffset);
          newRow.widgets = existingRow.widgets.concat(newRow.widgets);

          /// Remove the row we've integrated, and update the insertion index
          rows.splice(rowIndex, 1);
          insertionIndex = rowIndex;
        }
      }

      /// Insert the new row back into the array
      rows.splice(insertionIndex, 0, newRow);
    }

    let id = 0;
    let lastOffset = 0;
    for (const row of rows) {
      row.id = `row-${id}`;
      row.lastOffset = lastOffset;
      lastOffset = row.endOffset;
      id += 1;
    }
    return rows;
  }, [dashboard?.widgets]);

  return (
    <WidgetContainer ref={containerRef}>
      {widgetRows.map((widgetRow) => (
        <WidgetRowContainer
          key={widgetRow.id}
          style={{
            marginTop: `calc(var(--cell-size) * ${widgetRow.startOffset - widgetRow.lastOffset})`,
            height: `calc(var(--cell-size) * ${widgetRow.endOffset - widgetRow.startOffset})`,
            maxHeight: `calc(var(--cell-size) * ${widgetRow.maxHeight})`,
          }}
        >
          {widgetRow.widgets.map((widget) => (
            <WidgetComponent
              key={widget.id}
              widget={widget}
              containerStartOffset={widgetRow.startOffset}
              containerEndOffset={widgetRow.endOffset}
              canGrow={widgetRow.maxHeight > widgetRow.endOffset - widgetRow.startOffset}
              currentNode={currentNode}
              artifactSelector={artifactSelector ?? null}
              activeEventSummaryID={activeEventSummaryID ?? null}
              nodes={nodes}
              nodesByID={nodesByID}
              currentSelectionState={currentSelectionState}
              selectedMetricsState={selectedMetricsState}
              commonArtifactPath={undefined}
              organizationSlug={organizationSlug}
              metricDefinitionForID={metricDefinitionForID}
              metricColorForID={metricColorForID}
              kindConfigurationForPattern={kindConfigurationForPattern}
              autoScrollToFirstHighlight={autoScrollToFirstHighlight}
              emptyState={emptyState}
              showAnnotations={showAnnotations}
              pendingAnnotationSelection={pendingAnnotationSelection}
              activeAnnotationSelections={activeAnnotationSelections}
              onAnnotationSelection={onAnnotationSelection}
              onDeleteArtifact={onDeleteArtifact}
            />
          ))}
        </WidgetRowContainer>
      ))}
    </WidgetContainer>
  );
};
DashboardRenderer.displayName = "DashboardRenderer";
