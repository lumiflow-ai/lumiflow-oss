import { useMemo } from "react";
import styled, { css } from "styled-components";

import type {
  ArtifactSelector,
  CSSColor,
  MetricDefinition,
  MetricDisplay,
  MetricID,
  MetricsWidget,
} from "@/generated/serverTypes";

import type { StateObject } from "@/library/StateObject";

import type { ArtifactNode } from "@/model/artifactNode";
import { KeyPathValue } from "@/model/keyPath";

import type { KindConfigurationLookup } from "@/components/contexts/OrganizationContext";

// MARK: - Constants

// MARK: - Types

// MARK: - Styles

const MetricTitle = styled.div`${() => css`
  position: relative;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`}`;

const MetricValue = styled.div`${() => css`
  position: relative;
  font-size: calc(max((100cqmin - 12px) / 2, 10px));
  font-family: var(--font-monospace);
  flex-grow: 1;
  text-overflow: ellipsis;
  line-clamp: 1;
  white-space: nowrap;
  overflow: hidden;
`}`;

const MetricSubtitle = styled.div`${() => css`
  position: relative;
  font-size: 15px;
  text-overflow: ellipsis;
  line-clamp: 1;
  white-space: nowrap;
  overflow: hidden;
`}`;

const MetricDisplayBox = styled.div`${() => css`
  position: relative;
  min-width: calc(min(100cqmin, 50cqw));
  max-width: 800cqmin;
  flex-basis: calc(min(100cqmin, 50cqw));
  flex-grow: 1;
  padding: 6px;

  display: flex;
  flex-direction: column;

  &::after {
    content: "";
    position: absolute;
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 1px;
  }
`}`;

const Container = styled.div<{ $direction: "horizontal" | "vertical" }>`${({ $direction }) => css`
  position: absolute;
  inset: 0px;
  box-sizing: content-box;
  display: flex;
  ${
    $direction === "horizontal"
      ? css`
        flex-direction: row;
        overflow-x: auto;
        overflow-y: hidden;
      `
      : css`
        flex-direction: column;
        overflow-x: hidden;
        overflow-y: auto;
      `
  }
  gap: 10px;
  justify-content: center;

  ${MetricDisplayBox} {
    &::after {
      ${
        $direction === "horizontal"
          ? css`
            height: 50%;
            top: 25%;
            right: -6px;
            width: 1px;
          `
          : css`
            width: 50%;
            left: 25%;
            bottom: -6px;
            height: 1px;
          `
      }
    }
  }

  ${MetricDisplayBox}:last-of-type {
    &::after {
      display: none;
    }
  }
`}`;

// MARK: - Hooks

// MARK: - Helper Components

const MetricDisplayComponent = ({
  metricDisplay,
  currentNode,
  activeEventSummaryID,
  nodes,
  metricDefinitionForID,
  kindConfigurationForPattern,
}: {
  metricDisplay: MetricDisplay;
  currentNode: ArtifactNode | null;
  activeEventSummaryID: string | null;
  nodes: ArtifactNode[] | null;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
  kindConfigurationForPattern: KindConfigurationLookup;
}) => {
  /// Context

  /// State
  const { metricID, title } = metricDisplay;

  const definition = useMemo(() => {
    return metricDefinitionForID(metricID);
  }, [metricID, metricDefinitionForID]);

  const value = useMemo(() => {
    if (currentNode) {
      return currentNode.valueForKeyPath({
        keyPath: `metrics.${metricID}`,
        activeEventSummaryID,
        metricDefinitionForID,
        kindConfigurationForPattern,
      });
    }
    if (nodes) {
      // TODO: Calculate distribution for each `matchingValues`
      return KeyPathValue(null);
    }
    return KeyPathValue(null);
  }, [currentNode, nodes, metricID, activeEventSummaryID, metricDefinitionForID, kindConfigurationForPattern]);

  const titleDisplay = definition?.name ?? title ?? metricID;
  const subtitleDisplay = "";

  /// Actions

  /// Component
  return (
    <MetricDisplayBox>
      <MetricTitle title={titleDisplay}>{titleDisplay}</MetricTitle>
      <MetricValue title={`${value.raw ?? "??"}`}>{value.display ?? "??"}</MetricValue>
      {subtitleDisplay && <MetricSubtitle title={subtitleDisplay}>{subtitleDisplay}</MetricSubtitle>}
    </MetricDisplayBox>
  );
};
MetricDisplayComponent.displayName = "MetricDisplayComponent";

// MARK: - Metrics Widget Component

export const MetricsWidgetComponent = ({
  widget,
  currentNode,
  activeEventSummaryID,
  nodes,
  metricDefinitionForID,
  kindConfigurationForPattern,
}: {
  widget: MetricsWidget;
  currentNode: ArtifactNode | null;
  artifactSelector: ArtifactSelector | null;
  activeEventSummaryID: string | null;
  nodes: ArtifactNode[] | null;
  nodesByID: Map<string, ArtifactNode[]>;
  currentSelectionState?: StateObject<ArtifactNode | null>;
  organizationSlug: string | null;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
  metricColorForID: (id: MetricID) => CSSColor;
  kindConfigurationForPattern: KindConfigurationLookup;
}) => {
  /// Context

  /// State

  /// Actions

  /// Component

  return (
    <Container $direction={widget.height > widget.width ? "vertical" : "horizontal"}>
      {widget.metrics.map((metricDisplay, index) => (
        <MetricDisplayComponent
          key={`${metricDisplay.metricID}-${index}`}
          metricDisplay={metricDisplay}
          currentNode={currentNode}
          activeEventSummaryID={activeEventSummaryID}
          nodes={nodes}
          metricDefinitionForID={metricDefinitionForID}
          kindConfigurationForPattern={kindConfigurationForPattern}
        />
      ))}
    </Container>
  );
};
MetricsWidgetComponent.displayName = "MetricsWidgetComponent";
