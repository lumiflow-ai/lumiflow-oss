import { useContext, useMemo } from "react";
import styled, { css } from "styled-components";

import {
  type ArtifactPath,
  type ContentWidget,
  type CSSColor,
  type Metric,
  type MetricDefinition,
  type MetricID,
  WidgetKind,
} from "@/generated/serverTypes";

import { type StateObject, useBinding, useDerivedState } from "@/library/StateObject";

import type { ArtifactNode } from "@/model/artifactNode";
import { encodeArtifactPath } from "@/model/artifactPath";
import { keyPathCompare } from "@/model/keyPath";

import { ModalPanel, ToolbarContext } from "@/components/ui";
import { WidgetComponent } from "@/components/widgets";

import type { KindConfigurationLookup } from "./contexts/OrganizationContext";

// MARK: - Constants & Types

// MARK: - Styles

const HStack = styled.div`${() => css`
  display: flex;
  flex-direction: row;
  padding: 24px;
  gap: 0px;
  height: 100%;
  box-sizing: border-box;
  justify-content: center;
`}`;

const alwaysEnabled = () => true;

export const MetricsComparisonPanel = ({
  organizationSlug,
  nodesByID,
  selectedMetricsState,
  commonArtifactPath,
  isEnabled = alwaysEnabled,
  metricDefinitionForID,
  metricColorForID,
  kindConfigurationForPattern,
}: {
  organizationSlug: string | null;
  nodesByID: Map<string, ArtifactNode[]>;
  selectedMetricsState: StateObject<Map<string, Metric>>;
  commonArtifactPath: ArtifactPath;
  isEnabled?: (selectedMetrics: Map<string, Metric>) => boolean;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
  metricColorForID: (id: MetricID) => CSSColor;
  kindConfigurationForPattern: KindConfigurationLookup;
}) => {
  const { trailingEdgeWidth } = useContext(ToolbarContext);

  const isModalOpenState = useDerivedState(
    selectedMetricsState,
    {
      get(existingValue) {
        return existingValue.size !== 0 && isEnabled(existingValue);
      },
      set(existingValue, newValue) {
        return newValue || existingValue.size === 0 ? existingValue : new Map();
      },
    },
    [isEnabled],
  );

  const [selectedMetrics] = useBinding(selectedMetricsState);

  const artifactNodes = useMemo(() => {
    const artifactsMap = new Map<string, ArtifactNode>();
    const seenPaths = new Set<string>();

    for (const [_, metric] of selectedMetrics) {
      for (const recording of metric.values) {
        for (const example of recording.examples ?? []) {
          const encodedPath = encodeArtifactPath(example.artifactPath);
          if (seenPaths.has(encodedPath)) continue;
          seenPaths.add(encodedPath);

          const node = nodesByID.get(encodedPath)?.at(0);
          const content = node?.artifact?.snapshots?.at(-1)?.content;
          if (!node || typeof content !== "string") continue;

          artifactsMap.set(node.id, node);
        }
      }
    }

    return Array.from(artifactsMap.values()).sort((lhs, rhs) => {
      const result = keyPathCompare({
        keyPaths: ["creationTimestamp"],
        lhs,
        rhs,
      });
      if (result !== 0) return result;
      return lhs.id.localeCompare(rhs.id, "en", { numeric: true });
    });
  }, [selectedMetrics, nodesByID]);

  const modalInsets = useMemo(() => ({ right: trailingEdgeWidth }), [trailingEdgeWidth]);

  const widget: ContentWidget = {
    id: "",
    kind: WidgetKind.content,
    x: 0,
    y: 0,
    width: 6,
    height: 6,
    showsContext: true,
    childArtifactPath: [],
  };

  return (
    <ModalPanel isPresentedState={isModalOpenState} coverInsets={modalInsets}>
      <HStack>
        {artifactNodes.map((node) => (
          <WidgetComponent
            key={node.id}
            widget={widget}
            currentNode={node}
            artifactSelector={null}
            activeEventSummaryID={null}
            nodes={null}
            nodesByID={nodesByID}
            currentSelectionState={undefined}
            selectedMetricsState={selectedMetricsState}
            commonArtifactPath={commonArtifactPath}
            organizationSlug={organizationSlug}
            metricDefinitionForID={metricDefinitionForID}
            metricColorForID={metricColorForID}
            kindConfigurationForPattern={kindConfigurationForPattern}
          />
        ))}
      </HStack>
    </ModalPanel>
  );
};
MetricsComparisonPanel.displayName = "MetricsComparisonPanel";
