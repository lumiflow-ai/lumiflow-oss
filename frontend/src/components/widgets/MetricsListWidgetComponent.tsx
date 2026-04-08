import { useMemo } from "react";
import styled, { css } from "styled-components";

import type {
  ArtifactSelector,
  CSSColor,
  Metric,
  MetricDefinition,
  MetricID,
  MetricsListWidget,
} from "@/generated/serverTypes";

import type { StateObject } from "@/library/StateObject";

import type { ArtifactNode } from "@/model/artifactNode";
import { encodeArtifactPath } from "@/model/artifactPath";
import { valueForMetricKeyPath } from "@/model/metrics";

import { MetricCheckbox } from "@/components/sidebars/ArtifactDetailsSidebar";
import { Checkbox, Color, Size, TruncatingText } from "@/components/ui";

// MARK: - Constants

// MARK: - Types

// MARK: - Styles

const Column = styled.div`${() => css`
  position: relative;
  display: flex;
  padding: 2px 8px;

  a {
    color: rgb(140, 140, 140);
    text-decoration: none;

    &:hover {
      color: black;
    }
  }

  img {
    width: 6px;
    height: 12px;
    top: 1px !important;
    margin: 0px 6px !important;
  }

  ul {
    margin: 0px;
    padding-left: 26px;

    li {
      margin-bottom: 6px;
    }
  }
`}`;

const Value = styled.div`${() => css`
  text-align: center;
  align-self: center;
  flex-grow: 1;
`}`;

const Header = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: row;
  border-bottom: ${Size.line.thickness} solid ${Color.line};
  height: 40px;
  flex-shrink: 0;
  background: ${Color.tableHeader};

  ${Column} {
    text-align: center;
    align-items: center;
    justify-content: center;
    color: black;
    font-size: 15px;

    a {
      color: black;
      text-decoration: none;

      &:hover {
        color: rgb(116, 118, 120);
      }
    }

    img {
      width: 6px;
      height: 12px;
      top: 1px !important;
      margin: 0px 6px !important;
    }

    &::after {
      content: "";
      display: block;
      position: absolute;
      right: -0.5px;
      width: 1px;
      top: 10px;
      bottom: 10px;
      background-color: ${Color.line};
    }

    &:last-of-type {
      &::after {
        content: "";
        display: none;
      }
    }
  }
`}`;

const MetricLegend = styled.h4`${() => css`
  position: relative;
  margin: 2px 8px;
  font-size: 15px;
  color: black;
  display: flex;
  gap: 6px;
  font-weight: 400;

  ${Checkbox} {
    top: 0px;
  }
`}`;

const Columns = styled.section`${() => css`
  position: relative;
  display: flex;
  gap: 0px;
  flex-direction: row;
  flex-grow: 1;

  ${Column} {
    font-size: 15px;
    line-height: 1.5;

    a {
      color: rgb(140, 140, 140);
      text-decoration: none;

      &:hover {
        color: black;
      }
    }

    img {
      width: 6px;
      height: 12px;
      top: 1px !important;
      margin: 0px 6px !important;
    }

    &::after {
      content: "";
      display: block;
      position: absolute;
      right: -0.5px;
      width: 1px;
      top: 0px;
      bottom: 0px;
      background-color: ${Color.line};
    }

    &:last-of-type {
      &::after {
        content: "";
        display: none;
      }
    }
  }
`}`;

const Row = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  border-bottom: ${Size.line.thickness} solid ${Color.line};
  padding: 6px 0px;
  flex-grow: 1;

  ${Column} {
    a {
      color: rgb(140, 140, 140);
      text-decoration: none;

      &:hover {
        color: black;
      }
    }

    img {
      width: 6px;
      height: 12px;
      top: 1px !important;
      margin: 0px 6px !important;
    }
  }

  &:last-of-type {
    border-bottom: none;
  }
`}`;

const ScrollingContent = styled.section`${() => css`
  position: relative;
  display: flex;
  gap: 0px;
  flex-direction: column;
  overflow: auto;
  flex-grow: 1;
`}`;

const Container = styled.div`${() => css`
  position: absolute;
  inset: 0px;
  box-sizing: content-box;
  display: flex;
  gap: 0px;
  /* justify-content: center; */
  flex-direction: column;
`}`;

// MARK: - Hooks

// MARK: - Helper Components

// MARK: - Metrics Widget Component

export const MetricsListWidgetComponent = ({
  widget,
  currentNode,
  activeEventSummaryID,
  selectedMetricsState,
  metricDefinitionForID,
  metricColorForID,
}: {
  widget: MetricsListWidget;
  currentNode: ArtifactNode | null;
  artifactSelector: ArtifactSelector | null;
  activeEventSummaryID: string | null;
  nodes: ArtifactNode[] | null;
  nodesByID: Map<string, ArtifactNode[]>;
  currentSelectionState?: StateObject<ArtifactNode | null>;
  selectedMetricsState: StateObject<Map<string, Metric>>;
  organizationSlug: string | null;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
  metricColorForID: (id: MetricID) => CSSColor;
}) => {
  /// Context

  /// State

  const { metrics, valueColumns } = widget;

  const metricDefinitions = useMemo(() => {
    return metrics.map((metric) => ({
      ...metric,
      definition: metricDefinitionForID(metric.metricID),
      metric: currentNode?.metricForID({ id: metric.metricID, activeEventSummaryID }),
    }));
  }, [metrics, currentNode, activeEventSummaryID, metricDefinitionForID]);

  const columns = useMemo(() => {
    return valueColumns.map((valueColumn) => {
      const childNode = currentNode?.childArtifactWithPath(valueColumn.childArtifactPath) ?? null;
      return {
        ...valueColumn,
        childNode,
        displayValuesMap: valueColumn.displayValues && new Map(valueColumn.displayValues),
      };
    });
  }, [valueColumns, currentNode]);

  /// Actions

  /// Component

  return (
    <Container>
      <Header>
        {columns.map(({ childNode, title, width }, columnIndex) => {
          const columnWidth = typeof width === "string" ? width : `${(12 * (width * 12)) / widget.width}cqw`;
          const columnTitle =
            title ??
            childNode?.artifact?.artifactPath.at(-1)?.kind ??
            childNode?.artifact?.artifactPath.at(-1)?.id ??
            "Column";

          return (
            <Column key={`${childNode?.id}-${columnIndex}`} style={{ width: columnWidth }}>
              <TruncatingText title={columnTitle}>{columnTitle}</TruncatingText>
            </Column>
          );
        })}
      </Header>
      <ScrollingContent>
        {metricDefinitions.map(({ definition, metricID, title, metric }, rowIndex) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Slices won't change order.
          <Row key={`${metricID}-${rowIndex}`}>
            <MetricLegend>
              {metric && (
                <MetricCheckbox
                  metric={metric}
                  selectedMetricsState={selectedMetricsState}
                  metricColorForID={metricColorForID}
                />
              )}
              <label htmlFor={`metric-${metricID}`}>{title ?? definition?.name ?? metricID}</label>
            </MetricLegend>
            <Columns>
              {columns.map(({ childNode, width, displayKind, displayValuesMap }, columnIndex) => {
                const metric = childNode?.metricForID({ id: metricID, activeEventSummaryID }) ?? null;
                const examples =
                  currentNode
                    ?.metricForID({ id: metricID, activeEventSummaryID })
                    ?.values.flatMap((recording) => recording.examples ?? [])
                    .filter(
                      ({ artifactPath, matchingContent }) =>
                        matchingContent && encodeArtifactPath(artifactPath) === childNode?.id,
                    ) ?? [];
                return (
                  <Column
                    key={`${childNode?.id}-${columnIndex}`}
                    style={{ width: typeof width === "string" ? width : `${(12 * (width * 12)) / widget.width}cqw` }}
                  >
                    {displayKind === "value" && (
                      <Value>
                        {(displayValuesMap
                          ? displayValuesMap.get(
                              valueForMetricKeyPath({ metric, metricDefinitionForID, keyPath: "" }).raw,
                            )
                          : valueForMetricKeyPath({ metric, metricDefinitionForID, keyPath: "" }).display) ?? "–"}
                      </Value>
                    )}
                    {displayKind === "examples" && examples.length > 0 && (
                      <ul>
                        {examples.map(({ matchingContent }, exampleIndex) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: Slices won't change order.
                          <li key={`${exampleIndex}`}>{matchingContent}</li>
                        ))}
                      </ul>
                    )}
                  </Column>
                );
              })}
            </Columns>
          </Row>
        ))}
      </ScrollingContent>
    </Container>
  );
};
MetricsListWidgetComponent.displayName = "MetricsListWidgetComponent";
