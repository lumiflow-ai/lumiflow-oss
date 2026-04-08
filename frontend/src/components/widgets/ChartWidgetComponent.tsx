import { useMemo } from "react";
import styled, { css } from "styled-components";

import {
  type ArtifactSelector,
  type ChartSeries,
  ChartValueAccumulationStrategy,
  type ChartWidget,
  type CSSColor,
  type MetricDefinition,
  type MetricID,
  type PrimitiveValue,
} from "@/generated/serverTypes";

import type { StateObject } from "@/library/StateObject";

import type { ArtifactNode } from "@/model/artifactNode";
import { primitiveValueCompare, sortItems } from "@/model/keyPath";

import type { KindConfigurationLookup } from "@/components/contexts/OrganizationContext";
import { Color, Size } from "@/components/ui";

// MARK: - Constants

// MARK: - Types

// MARK: - Styles

const SeriesBar = styled.div`${() => css`
  border-radius: 1px;
  border-bottom: ${Size.line.thickness} solid ${Color.line};
  box-sizing: border-box;
  border-bottom-left-radius: 2px;
  border-bottom-right-radius: 2px;

  &:first-child {
    border-bottom: none;
    border-bottom-left-radius: 1px;
    border-bottom-right-radius: 1px;
  }

  &:last-child {
    border-top-left-radius: 3px;
    border-top-right-radius: 3px;
  }
`}`;

const Gridline = styled.div`${() => css`
  position: relative;
  height: 1px;
  background-color: ${Color.line};
`}`;

const Baseline = styled.div`${() => css`
  position: relative;
  height: 1px;
  background-color: ${Color.line};
`}`;

const PositiveRange = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: column-reverse;
  height: 100%;
  gap: 0px;
`}`;

const NegativeRange = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 0%;
`}`;

const Segment = styled.div`${() => css`
  position: relative;
  max-width: 20px;
  height: 100%;
  width: 20px;
  flex-shrink: 1;
  display: flex;
  flex-direction: column-reverse;
`}`;

const GridlineLayer = styled.div`${() => css`
  position: absolute;
  inset: 0px;
  pointer-events: none;
  display: flex;
  flex-direction: column-reverse;

  ${PositiveRange}, ${NegativeRange} {
    justify-content: space-between;
  }
`}`;

const SegmentLayer = styled.div`${() => css`
  position: absolute;
  inset: 0px;
  display: flex;
  flex-direction: row;
  gap: 2px;

  &:hover ${Segment} {
    opacity: 0.7;

    &:hover {
      opacity: 1;
    }
  }
`}`;

const BaselineLayer = styled.div`${() => css`
  position: absolute;
  inset: 0px;
  pointer-events: none;
  display: flex;
  flex-direction: column-reverse;
`}`;

const Chart = styled.div`${() => css`
  position: relative;
  height: 100%;
  flex-grow: 1;
`}`;

const SeriesTitle = styled.div<{ $position: "leading" | "trailing" }>`${({ $position }) => css`
  position: relative;
  text-align: center;
  writing-mode: ${$position === "leading" ? "sideways-lr" : "vertical-rl"};
  font-size: 15px;
  hyphens: auto;
  word-break: break-word;
  line-clamp: 1;
  overflow: hidden;
  width: 16px;
  text-overflow: ellipsis;
`}`;

const ChartGroup = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: row;
  /* height: 100%; */
  /* flex-shrink: 1; */
  flex-grow: 1;
`}`;

const ChartTitle = styled.div`${() => css`
  text-align: center;
  width: 100%;
  font-size: 15px;
  text-overflow: ellipsis;
  overflow: hidden;
  display: -webkit-box;
  line-clamp: 1;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
`}`;

const SegmentsTitle = styled.div`${() => css`
  text-align: center;
  width: 100%;
  font-size: 15px;
  height: 16px;
  display: flex;
  align-items: end;
  justify-content: center;
`}`;

const Container = styled.div`${() => css`
  position: absolute;
  inset: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
`}`;

// MARK: - Hooks

// MARK: - Helper Components

// MARK: - Chart Widget Component

export const ChartWidgetComponent = ({
  widget,
  nodesByID,
  metricDefinitionForID,
  metricColorForID,
  kindConfigurationForPattern,
}: {
  widget: ChartWidget;
  artifactSelector?: ArtifactSelector | null;
  activeEventSummaryID?: string | null;
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

  const { segmentationKeyPaths, series } = widget;

  const segments = useMemo(() => {
    const segmentedArtifacts: {
      series: {
        series: ChartSeries;
        subSeries: Map<
          PrimitiveValue,
          {
            seriesValue: number;
            color: CSSColor;
            legend: string;
            artifacts: ArtifactNode[];
            renderValue: number;
          }
        >;
        sortedSubSeries: [
          PrimitiveValue,
          {
            seriesValue: number;
            color: CSSColor;
            legend: string;
            artifacts: ArtifactNode[];
            renderValue: number;
          },
        ][];
        totalCount: 0;
        numericSubSeries: {
          seriesValue: number;
          color: CSSColor;
          legend: string;
          artifacts: ArtifactNode[];
          renderValue: number;
        };
      }[];
      segmentValue: PrimitiveValue;
    }[] = [];
    let lastSegmentValue: PrimitiveValue | undefined;

    // TODO: Unused for now.
    const _highCountWatermark = 0;
    const _lowCountWatermark = 0;
    const _highNumericWatermark = 0;
    const _lowNumericWatermark = 0;

    const sortedNodes = sortItems({
      items: Array.from(nodesByID.values()).flat(),
      sortDescriptors: [{ keyPaths: segmentationKeyPaths, order: "ascending" }],
      activeEventSummaryID: null,
      metricDefinitionForID,
      kindConfigurationForPattern,
    });

    for (const artifactNode of sortedNodes) {
      const segmentValue = artifactNode.valueForKeyPaths({
        keyPaths: segmentationKeyPaths,
        activeEventSummaryID: null,
        metricDefinitionForID,
        kindConfigurationForPattern,
      }).raw;
      if (segmentValue === null) continue;
      if (segmentValue !== lastSegmentValue) {
        lastSegmentValue = segmentValue;
        segmentedArtifacts.push({
          series: series.map((series, index) => ({
            series,
            subSeries: new Map(),
            sortedSubSeries: [],
            totalCount: 0,
            numericSubSeries: {
              seriesValue: 0,
              color: typeof series.colors === "string" ? series.colors : metricColorForID(`${index}`),
              legend: typeof series.legends === "string" ? series.legends : `${series.title}`,
              artifacts: [],
              renderValue: 0,
            },
          })),
          segmentValue,
        });
      }

      for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex += 1) {
        // TODO: filter by ChartSeries.filter
        const seriesDescriptor = series[seriesIndex];
        const segmentedSeries = segmentedArtifacts[segmentedArtifacts.length - 1].series[seriesIndex];
        const seriesValue = artifactNode.valueForKeyPaths({
          keyPaths: seriesDescriptor.keyPaths,
          activeEventSummaryID: null,
          metricDefinitionForID,
          kindConfigurationForPattern,
        }).raw;
        const colorMap = new Map(
          typeof seriesDescriptor.colors === "string" ? [[null, seriesDescriptor.colors]] : seriesDescriptor.colors,
        );
        const legendMap = new Map(
          typeof seriesDescriptor.legends === "string" ? [[null, seriesDescriptor.legends]] : seriesDescriptor.legends,
        );

        switch (seriesDescriptor.valueAccumulationStrategy) {
          case ChartValueAccumulationStrategy.count: {
            const key = seriesValue;
            let subSeries = segmentedSeries.subSeries.get(key);
            if (!subSeries) {
              subSeries = {
                seriesValue: 0,
                color: colorMap.get(key) ?? metricColorForID(`${key}`),
                legend: legendMap.get(key) ?? `${key}`,
                artifacts: [],
                renderValue: 0,
              };
              segmentedSeries.subSeries.set(key, subSeries);
            }
            segmentedSeries.totalCount += 1;
            subSeries.artifacts.push(artifactNode);
            // TODO: Valid for ChartValueNormalizationStrategy.ratio only;
            subSeries.renderValue = subSeries.artifacts.length / segmentedSeries.totalCount;
            break;
          }
          case ChartValueAccumulationStrategy.average:
          case ChartValueAccumulationStrategy.sum: {
            if (typeof seriesValue === "number") {
              segmentedSeries.numericSubSeries.artifacts.push(artifactNode);
            }
            break;
          }
        }
      }
    }

    for (const segment of segmentedArtifacts) {
      for (const series of segment.series) {
        const sortLookup =
          typeof series.series.colors !== "string"
            ? new Map(series.series.colors?.map(([value, _color], index) => [value, index]))
            : new Map(
                typeof series.series.legends !== "string"
                  ? series.series.legends?.map(([value, _legend], index) => [value, index])
                  : [],
              );
        series.sortedSubSeries = Array.from(series.subSeries.entries()).sort(
          ([lhsValue, _lhsSeries], [rhsValue, _rhsSeries]) => {
            const lhsSort = sortLookup.get(lhsValue);
            const rhsSort = sortLookup.get(rhsValue);
            if (lhsSort !== undefined && rhsSort !== undefined) return lhsSort - rhsSort;
            if (lhsSort !== undefined) return -1;
            if (rhsSort !== undefined) return 1;

            return primitiveValueCompare(lhsValue, rhsValue);
          },
        );
      }
    }

    return segmentedArtifacts;
  }, [nodesByID, segmentationKeyPaths, series, metricDefinitionForID, metricColorForID, kindConfigurationForPattern]);

  /// Actions

  /// Component
  return (
    <Container>
      <ChartTitle>{widget.title}</ChartTitle>
      <ChartGroup>
        {widget.series.flatMap((series) =>
          series.title
            ? [
                <SeriesTitle key={series.title} title={series.title} $position="leading">
                  {series.title}
                </SeriesTitle>,
              ]
            : [],
        )}
        <Chart>
          <GridlineLayer>
            <NegativeRange />
            <PositiveRange>
              <Gridline />
              <Gridline />
              <Gridline />
              <Gridline />
              <Gridline />
            </PositiveRange>
          </GridlineLayer>
          <SegmentLayer>
            {segments.map(({ segmentValue, series }) => (
              <Segment key={`${segmentValue}`}>
                <NegativeRange />
                <PositiveRange>
                  {series.map(({ sortedSubSeries }, seriesIndex) =>
                    sortedSubSeries.map(([_value, { color, legend, renderValue }], subSeriesIndex) => (
                      <SeriesBar
                        // biome-ignore lint/suspicious/noArrayIndexKey: These indices don't change.
                        key={`${seriesIndex}-${subSeriesIndex}`}
                        title={`${legend} – ${Math.round(renderValue * 100 * 10) / 10}%`}
                        style={{
                          height: `${renderValue * 100}%`,
                          backgroundColor: color,
                        }}
                      />
                    )),
                  )}
                </PositiveRange>
              </Segment>
            ))}
          </SegmentLayer>
          <BaselineLayer>
            <NegativeRange />
            <PositiveRange>
              <Baseline />
            </PositiveRange>
          </BaselineLayer>
        </Chart>
        <SeriesTitle $position="trailing" />
      </ChartGroup>
      <SegmentsTitle>{widget.segmentsTitle}</SegmentsTitle>
    </Container>
  );
};
ChartWidgetComponent.displayName = "ChartWidgetComponent";
