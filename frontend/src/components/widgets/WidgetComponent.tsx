import type { ReactNode } from "react";
import styled from "styled-components";

import {
  type ArtifactPath,
  type ArtifactSelector,
  type CSSColor,
  type Metric,
  type MetricDefinition,
  type MetricID,
  type Widget,
  WidgetKind,
} from "@/generated/serverTypes";

import type { StateObject } from "@/library/StateObject";

import type { ArtifactNode } from "@/model/artifactNode";

import type { ArtifactAnnotationSelection } from "@/components/ArtifactAnnotation";
import type { KindConfigurationLookup } from "@/components/contexts/OrganizationContext";
import { Color, Size } from "@/components/ui";
import { ChartWidgetComponent } from "@/components/widgets/ChartWidgetComponent";
import { ContentWidgetComponent } from "@/components/widgets/ContentWidgetComponent";
import { MetricsListWidgetComponent } from "@/components/widgets/MetricsListWidgetComponent";
import { MetricsWidgetComponent } from "@/components/widgets/MetricsWidgetComponent";
import { TableWidgetComponent } from "@/components/widgets/TableWidgetComponent";

const WidgetOuterContainer = styled.div`
  position: absolute;
  display: block;
`;

const WidgetInnerContainer = styled.div<{ $isTable?: boolean }>`
  container-type: size;
  position: absolute;
  inset: 19px 5px 30px 5px;
  outline: ${Size.line.thickness} solid ${Color.line};
  overflow: hidden;
  background-color: white;
  
  border-radius: 16px;

  @media (max-width: 600px) {
   inset: 40px 0px;
  }
`;

function componentForWidget({
  widget,
  currentNode,
  artifactSelector,
  activeEventSummaryID,
  nodes,
  nodesByID,
  currentSelectionState,
  selectedMetricsState,
  commonArtifactPath,
  organizationSlug,
  metricDefinitionForID,
  metricColorForID,
  kindConfigurationForPattern,
  autoScrollToFirstHighlight,
  emptyState,
  showAnnotations,
  pendingAnnotationSelection,
  activeAnnotationSelections,
  onAnnotationSelection,
  onDeleteArtifact,
}: {
  widget: Widget;
  currentNode: ArtifactNode | null;
  artifactSelector: ArtifactSelector | null;
  activeEventSummaryID: string | null;
  nodes: ArtifactNode[] | null;
  nodesByID: Map<string, ArtifactNode[]>;
  currentSelectionState?: StateObject<ArtifactNode | null>;
  selectedMetricsState: StateObject<Map<string, Metric>>;
  commonArtifactPath: ArtifactPath | undefined;
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
}) {
  switch (widget.kind) {
    case WidgetKind.chart:
      return (
        <ChartWidgetComponent
          widget={widget}
          artifactSelector={artifactSelector}
          activeEventSummaryID={activeEventSummaryID}
          nodes={nodes}
          nodesByID={nodesByID}
          currentSelectionState={currentSelectionState}
          organizationSlug={organizationSlug}
          metricDefinitionForID={metricDefinitionForID}
          metricColorForID={metricColorForID}
          kindConfigurationForPattern={kindConfigurationForPattern}
        />
      );
    case WidgetKind.content:
      return (
        <ContentWidgetComponent
          widget={widget}
          currentNode={currentNode}
          artifactSelector={artifactSelector}
          activeEventSummaryID={activeEventSummaryID}
          nodes={nodes}
          nodesByID={nodesByID}
          currentSelectionState={currentSelectionState}
          selectedMetricsState={selectedMetricsState}
          commonArtifactPath={commonArtifactPath}
          organizationSlug={organizationSlug}
          metricDefinitionForID={metricDefinitionForID}
          metricColorForID={metricColorForID}
          kindConfigurationForPattern={kindConfigurationForPattern}
          autoScrollToFirstHighlight={autoScrollToFirstHighlight}
          showAnnotations={showAnnotations}
          pendingAnnotationSelection={pendingAnnotationSelection}
          activeAnnotationSelections={activeAnnotationSelections}
          onAnnotationSelection={onAnnotationSelection}
        />
      );
    case WidgetKind.metrics:
      return (
        <MetricsWidgetComponent
          widget={widget}
          currentNode={currentNode}
          artifactSelector={artifactSelector}
          activeEventSummaryID={activeEventSummaryID}
          nodes={nodes}
          nodesByID={nodesByID}
          currentSelectionState={currentSelectionState}
          organizationSlug={organizationSlug}
          metricDefinitionForID={metricDefinitionForID}
          metricColorForID={metricColorForID}
          kindConfigurationForPattern={kindConfigurationForPattern}
        />
      );
    case WidgetKind.metricsList:
      return (
        <MetricsListWidgetComponent
          widget={widget}
          currentNode={currentNode}
          artifactSelector={artifactSelector}
          activeEventSummaryID={activeEventSummaryID}
          nodes={nodes}
          nodesByID={nodesByID}
          currentSelectionState={currentSelectionState}
          selectedMetricsState={selectedMetricsState}
          organizationSlug={organizationSlug}
          metricDefinitionForID={metricDefinitionForID}
          metricColorForID={metricColorForID}
        />
      );
    case WidgetKind.table:
      return (
        <TableWidgetComponent
          widget={widget}
          currentNode={currentNode}
          artifactSelector={artifactSelector}
          activeEventSummaryID={activeEventSummaryID}
          nodes={nodes}
          currentSelectionState={currentSelectionState}
          organizationSlug={organizationSlug}
          metricDefinitionForID={metricDefinitionForID}
          metricColorForID={metricColorForID}
          kindConfigurationForPattern={kindConfigurationForPattern}
          emptyState={emptyState}
          onDeleteArtifact={onDeleteArtifact}
        />
      );
    default:
      return;
    // no-default
  }
}

export const WidgetComponent = ({
  widget,
  containerStartOffset,
  containerEndOffset,
  canGrow,
  currentNode,
  artifactSelector,
  activeEventSummaryID,
  nodes,
  nodesByID,
  currentSelectionState,
  selectedMetricsState,
  commonArtifactPath,
  organizationSlug,
  metricDefinitionForID,
  metricColorForID,
  kindConfigurationForPattern,
  autoScrollToFirstHighlight,
  emptyState,
  showAnnotations,
  pendingAnnotationSelection,
  activeAnnotationSelections,
  onAnnotationSelection,
  onDeleteArtifact,
}: {
  widget: Widget;
  containerStartOffset?: number;
  containerEndOffset?: number;
  canGrow?: boolean;
  currentNode: ArtifactNode | null;
  artifactSelector: ArtifactSelector | null;
  activeEventSummaryID: string | null;
  nodes: ArtifactNode[] | null;
  nodesByID: Map<string, ArtifactNode[]>;
  currentSelectionState: StateObject<ArtifactNode | null> | undefined;
  selectedMetricsState: StateObject<Map<string, Metric>>;
  commonArtifactPath: ArtifactPath | undefined;
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
  return (
    <WidgetOuterContainer
      style={{
        borderRadius: "16px",
        left: `calc(var(--cell-size, calc(100% / 12)) * ${widget.x})`,
        top: `calc(var(--cell-size, calc(100% / 12)) * ${widget.y - (containerStartOffset ?? widget.y)})`,
        width: `calc(var(--cell-size, calc(100% / 12)) * ${widget.width})`,
        bottom: `calc(var(--cell-size, calc(100% / 12)) * ${(containerEndOffset ?? widget.y + widget.height) - (widget.y + widget.height)})`,
        maxHeight:
          widget.maxHeight !== undefined && canGrow
            ? `calc(var(--cell-size) * ${widget.maxHeight === null ? "infinity" : widget.maxHeight})`
            : undefined,
        position: canGrow === undefined ? "relative" : undefined,
      }}
    >
      <WidgetInnerContainer $isTable={widget.kind === WidgetKind.table}>
        {componentForWidget({
          widget,
          currentNode,
          artifactSelector,
          activeEventSummaryID,
          nodes,
          nodesByID,
          currentSelectionState,
          selectedMetricsState,
          commonArtifactPath,
          organizationSlug,
          metricDefinitionForID,
          metricColorForID,
          kindConfigurationForPattern,
          autoScrollToFirstHighlight,
          emptyState,
          showAnnotations,
          pendingAnnotationSelection,
          activeAnnotationSelections,
          onAnnotationSelection,
          onDeleteArtifact,
        })}
      </WidgetInnerContainer>
    </WidgetOuterContainer>
  );
};
WidgetComponent.displayName = "WidgetComponent";
