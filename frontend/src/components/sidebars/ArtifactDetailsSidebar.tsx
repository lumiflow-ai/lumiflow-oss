import Link from "next/link";
import {
  Fragment,
  type MouseEventHandler,
  type PropsWithChildren,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import styled, { css } from "styled-components";

import { fetchDeleteArtifact } from "@/generated/serverEndpoints";
import type {
  ArtifactPath,
  ArtifactPathPattern,
  ArtifactSelector,
  CSSColor,
  Metric,
  MetricDefinition,
  MetricID,
  TagValue,
} from "@/generated/serverTypes";

import { type StateObject, useBinding, useDerivedState, useStateObject } from "@/library/StateObject";
import useLocalStorage from "@/library/useLocalStorage";

import type { ArtifactNode, TypedArtifactSnapshot } from "@/model/artifactNode";
import { encodeArtifactPath, encodeArtifactPathPattern, encodeArtifactSelector } from "@/model/artifactPath";
import { enumerateContent } from "@/model/content";
import { valueForKeyPath } from "@/model/keyPath";
import { valueForMetricKeyPath } from "@/model/metrics";

import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import {
  Button,
  Checkbox,
  type CheckboxState,
  Divider,
  Font,
  NavigationContent,
  Sidebar,
  type SidebarState,
  SidebarTitle,
} from "@/components/ui";

import { invalidateContentArtifacts } from "@/app/navigator/_shared/artifacts";

// MARK: - Constants and Types

// MARK: - Styles

const RowLabel = styled.div<{
  $isRawLabel: boolean;
}>`${({ $isRawLabel }) => css`
  font-family: ${$isRawLabel ? Font.monospace : Font.inter};
  position: relative;
  display: flex;
  gap: 6px;
  color: black;
  align-items: first-baseline;
  font-size: 15px;
  text-align: left;
  width: 100%;
  flex-shrink: 1;
  hyphens: ${$isRawLabel ? "none" : "auto"};
  word-break: break-word;
  min-width: 126px;

  ${Checkbox} {
    top: 1px;
  }

  a {
    cursor: pointer;
    text-decoration: none;
    color: currentcolor;

    &:hover {
      color: black;
    }

    &:active:hover {
      color: black;
    }
  }
`}`;

const RowValue = styled.div<{
  $isMockValue: boolean;
  $isRawValue: boolean;
}>`${({ $isMockValue, $isRawValue }) => css`
  font-family: ${$isRawValue ? Font.monospace : Font.inter};
  position: relative;
  display: block;
  font-size: 15px;
  text-align: left;
  width: 100%;
  flex-shrink: 1;
  word-break: break-word;
  white-space: pre-line;
  color: ${$isMockValue ? "deeppink" : "black"};
  font-variant-ligatures: ${$isRawValue ? "none" : "normal"};

  a {
    cursor: pointer;
    color: currentcolor;
    text-decoration: underline;

    &:hover {
      color: black;
    }

    &:active:hover {
      color: black;
    }
  }
`}`;

const Row = styled.div<{ $distribution: "edges" | "columns" | "rows" }>`${({ $distribution }) => css`
  position: relative;
  display: flex;
  margin: 2px 0px;
  padding: 4px 8px;
  border-radius: 4px;

  ${() => {
    switch ($distribution) {
      case "columns":
        return css`
          flex-direction: row;
          gap: 8px;
        `;
      case "rows":
        return css`
          flex-direction: column;
          gap: 2px;
        `;
      case "edges":
        return css`
          flex-direction: row;
          gap: 8px;

          ${RowValue} {
            width: fit-content;
            flex-shrink: 0;
            max-width: calc(50% - 4px);
          }
        `;
    }
  }}

  &:hover {
    background-color: rgba(0, 40, 80, 0.08) !important;
  }
`}`;

const SectionContainer = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: 0px -12px;
  padding: 0px 12px;
  transition: opacity 200ms;
`}`;

const SectionHeader = styled.h3`${() => css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
  margin: 0px 8px 0px;
  padding: 12px 0px;
  color: black;
  -webkit-user-select: none;
  user-select: none;
  font-weight: 400;
`}`;

const Section = styled.section<{ $state?: "open" | "closed" | null }>`${({ $state = null }) => css`
  position: relative;
  display: grid;
  grid-template-rows: min-content 1fr;
  margin: 0px -8px;
  transition: grid-template-rows 200ms, margin 200ms;

  ${
    $state === "closed" &&
    css`
    grid-template-rows: min-content 0fr;

    ${SectionContainer} {
      opacity: 0;
    }

    h3 {
      opacity: 0.8;

      &:hover {
        opacity: 1;
      }
    }
  `
  }

  &:first-of-type {
    margin-top: -8px;
  }

  ${Divider} {
    margin: 2px 8px;
  }

  &:last-of-type ${Divider} {
    display: none;
  }

  h3 {
    ${
      $state &&
      css`
      cursor: pointer;
    `
    }

    ${Checkbox} {
      margin-right: 6px;
    }

    font-weight: 400;

    &::after {
      content: "";
      display: block;
      position: relative;
      flex-grow: 1;
      width: 20px;
      height: 20px;
      mask-size: 20px 20px;
      mask-position: right center;
      mask-repeat: no-repeat;
      opacity: 0.5;

      ${
        $state &&
        css`
        background-color: currentcolor;
        mask-image: url(/assets/disclosure-${$state}.svg);
      `
      }
    }

    &:hover::after {
      opacity: 1;
    }
  }

  ${Row}:nth-of-type(odd) {
    background-color: rgba(0, 40, 80, 0.03);
  }

  ${Button} {
    margin: 6px 0px;
  }
`}`;

const MetricGroupContainer = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: opacity 200ms;
`}`;

const DisclosureTriangle = styled.div<{ $state: "open" | "closed" | null }>`${({ $state }) => css`
  position: relative;
  display: inline-block;
  width: 16px;
  height: 16px;
  top: -1px;
  padding: 2px 4px;
  margin: -2px -4px -2px -20px;
  mask-size: 12px 12px;
  mask-position: center center;
  mask-repeat: no-repeat;

  ${
    $state &&
    css`
    background-color: currentcolor;
    mask-image: url(/assets/disclosure-${$state}.svg);
  `
  }
`}`;

const MetricGroupSection = styled.section<{ $isOpen: boolean }>`${({ $isOpen }) => css`
  position: relative;
  display: grid;
  grid-template-rows: min-content 1fr;
  margin: 0px 0px 6px;
  transition: grid-template-rows 200ms, margin 200ms;

  ${
    !$isOpen &&
    css`
    grid-template-rows: min-content 0fr;
    margin: 0px;

    ${MetricGroupContainer} {
      opacity: 0;
    }
  `
  }

  &:last-of-type {
    margin: 0px;
  }

  h4 {
    display: flex;
    align-items: center;
    font-size: 15px;
    margin: 2px 8px;
    color: black;
    font-weight: 400;

    ${Checkbox} {
      top: -1px;
      margin-right: 6px;
    }
  }
`}`;

const ContentsGroupLabel = styled.div`${() => css`
  flex-grow: 1;
`}`;

const ContentsGroupTag = styled.div`${() => css`
  position: relative;
  color: black;

  a {
    color: inherit;
    text-decoration: none;

    &[data-isactive="false"] {
      opacity: 0;
    }

    &:hover {
      color: black;
    }
  }
`}`;

const ContentsGroupContainer = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: opacity 200ms;
`}`;

const ContentsGroupSection = styled.section<{ $isOpen: boolean }>`${({ $isOpen }) => css`
  position: relative;
  display: grid;
  grid-template-rows: min-content 1fr;
  margin: 0px 0px 6px;
  transition: grid-template-rows 200ms, margin 200ms;

  ${
    !$isOpen &&
    css`
    grid-template-rows: min-content 0fr;
    margin: 0px;

    ${ContentsGroupContainer} {
      opacity: 0;
    }
  `
  }

  &:last-of-type {
    margin: 0px;
  }

  h4 {
    display: flex;
    align-items: center;
    font-size: 15px;
    margin: 2px 8px;
    color: black;
  }

  &:hover h4 ${ContentsGroupTag} a {
    opacity: 1;
  }
`}`;

// MARK: - Helper Functions

const stopPropagation: MouseEventHandler = (event) => {
  event.stopPropagation();
};

// MARK: - Helper Components

export const MetricCheckbox = (
  props: (
    | {
        metric: Metric;
        allMetrics?: undefined;
        id?: string;
      }
    | {
        metric?: undefined;
        allMetrics: Map<string, Metric>;
        id: string;
      }
  ) & {
    selectedMetricsState: StateObject<Map<string, Metric>>;
    metricColorForID: (id: MetricID) => CSSColor;
  },
) => {
  const isEnabled =
    props.metric?.values
      .at(-1)
      ?.examples?.some((example) => typeof example.matchingContent === "string" && example.matchingContent) ?? false;

  const selectionState = useDerivedState<CheckboxState, Map<string, Metric>>(
    props.selectedMetricsState,
    {
      get(existingValue) {
        if (props.metric) return existingValue.has(props.metric.id) && isEnabled ? "on" : "off";

        const existingMetricsKeys = new Set(existingValue.keys());
        const allMetricsKeys = new Set(props.allMetrics.keys());
        if (existingMetricsKeys.intersection(allMetricsKeys).size === 0) return "off";
        if (existingMetricsKeys.intersection(allMetricsKeys).size === allMetricsKeys.size) return "on";
        return "mixed";
      },
      set(existingValue, newValue) {
        const newMap = new Map(existingValue);
        if (props.metric) {
          if (newValue === "on") newMap.set(props.metric.id, props.metric);
          else newMap.delete(props.metric.id);
          return newMap;
        }

        if (newValue === "on") {
          for (const [_, metric] of props.allMetrics) {
            newMap.set(metric.id, metric);
          }
          return newMap;
        }

        for (const [id, _] of props.allMetrics) {
          newMap.delete(id);
        }
        return newMap;
      },
    },
    [props.metric, props.allMetrics, isEnabled],
  );

  return (
    <Checkbox
      color={props.metric ? props.metricColorForID(props.metric.id) : "white"}
      selectionState={selectionState}
      isEnabled={props.metric ? isEnabled : true}
      id={!props.metric || props.id ? props.id : `metric-${props.metric.id}`}
      showsColorWhenOff
      size="small"
    />
  );
};
MetricCheckbox.displayName = "MetricCheckbox";

const MetricGroup = ({
  selectedMetricsState,
  group,
  metricsWithExamples,
  metrics,
  metricColorForID,
  metricDefinitionForID,
}: {
  selectedMetricsState: StateObject<Map<string, Metric>>;
  group: string | null;
  metricsWithExamples: Map<string, Metric>;
  metrics: Metric[];
  metricColorForID: (id: MetricID) => CSSColor;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
}) => {
  const id = group ? `metrics-group-${group}` : "metrics-group";
  const [isOpen, setIsOpen] = useLocalStorage(`group-open-${id}`, false);

  const checkmarkGroupID = useId();

  const toggleOpen = useCallback(() => {
    setIsOpen((previous) => !previous);
  }, [setIsOpen]);

  return (
    <MetricGroupSection $isOpen={group !== null ? isOpen : true}>
      {group !== null && (
        <h4>
          <DisclosureTriangle $state={isOpen ? "open" : "closed"} onClick={toggleOpen} />
          {!!metricsWithExamples.size && (
            <MetricCheckbox
              allMetrics={metricsWithExamples}
              selectedMetricsState={selectedMetricsState}
              id={checkmarkGroupID}
              metricColorForID={metricColorForID}
            />
          )}
          <label htmlFor={checkmarkGroupID}>{group}</label>
        </h4>
      )}
      <MetricGroupContainer>
        {metrics.map((metric) => (
          <LabelValuePair
            key={metric.id}
            distribution="edges"
            value={
              valueForMetricKeyPath({
                metric,
                metricDefinitionForID,
              }).display ?? "None"
            }
            isMockValue={metric.isMock}
          >
            {metric.values.findLast((recording) => recording.examples?.at(0)) && (
              <MetricCheckbox
                metric={metric}
                selectedMetricsState={selectedMetricsState}
                metricColorForID={metricColorForID}
              />
            )}
            <label htmlFor={`metric-${metric.id}`}>{metricDefinitionForID(metric.id)?.name ?? metric.id}</label>
          </LabelValuePair>
        ))}
      </MetricGroupContainer>
    </MetricGroupSection>
  );
};

const MetadataDisplayNames = new Map([
  ["name", "Name"],
  ["variation", "Variation"],
]);

const ContentsGroup = ({
  snapshot,
  artifactPath,
  organizationSlug,
  tags,
  isActive,
}: {
  snapshot: TypedArtifactSnapshot;
  artifactPath: ArtifactPath;
  organizationSlug: string | null;
  tags: TagValue[];
  isActive: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isActive) {
      setIsOpen(true);
    }
  }, [isActive]);

  const toggleOpen = useCallback(() => {
    setIsOpen((previous) => !previous);
  }, []);

  const artifactSelector = useMemo(
    () => ({ tags, artifactPath, eventSummaryIDs: [snapshot.eventSummaryID ?? ""], generationIDs: [] }),
    [tags, artifactPath, snapshot.eventSummaryID],
  );

  return (
    <ContentsGroupSection $isOpen={isOpen}>
      <h4>
        <DisclosureTriangle $state={isOpen ? "open" : "closed"} onClick={toggleOpen} />
        <ContentsGroupLabel>
          {snapshot.timestamp
            ? snapshot.timestamp.toLocaleDateString("en") +
              " @ " +
              snapshot.timestamp.toLocaleTimeString("en", {
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
                fractionalSecondDigits: 3,
              })
            : (snapshot.eventSummaryID ?? "Snapshot")}
        </ContentsGroupLabel>
        <ContentsGroupTag>
          <Link
            href={`/app/${organizationSlug}/artifacts/${encodeArtifactSelector(artifactSelector)}`}
            data-isactive={isActive}
          >
            {isActive ? "Current" : "Focus"}
          </Link>
        </ContentsGroupTag>
      </h4>
      <ContentsGroupContainer>
        {Object.entries(snapshot.metadata ?? {}).map(([key, value]) => {
          const displayName = MetadataDisplayNames.get(key);
          return (
            <LabelValuePair key={key} label={displayName ?? key} value={value} isRawValue={displayName === undefined} />
          );
        })}
        {snapshot.eventSummaryID && (
          <LabelValuePair
            label="Event Summary ID"
            title={snapshot.eventSummaryID}
            value={valueForKeyPath(snapshot.eventSummaryID, "truncated(7,0)").display}
            isRawValue
          />
        )}
        {snapshot.timestamp && <LabelValuePair label="Timestamp" value={snapshot.timestamp.toString()} />}

        {enumerateContent(snapshot.content).map(({ index, key, value }) => (
          <LabelValuePair key={index} label={key ?? "Content"} value={`${value}`} isRawLabel isRawValue />
        ))}
      </ContentsGroupContainer>
    </ContentsGroupSection>
  );
};

const SidebarSection = ({
  title,
  persistenceID,
  defaultState = "closed",
  children,
}: {
  persistenceID: string;
  defaultState?: "open" | "closed";
  title: ReactNode;
} & PropsWithChildren) => {
  const [isOpen, setIsOpen] = useLocalStorage(`sidebar-section-${persistenceID}`, defaultState === "open");

  const toggleOpen = useCallback(() => {
    setIsOpen((previous) => !previous);
  }, [setIsOpen]);

  return (
    <Section $state={isOpen ? "open" : "closed"}>
      <SectionHeader onClick={toggleOpen}>{title}</SectionHeader>
      <SectionContainer>{children}</SectionContainer>
      <Divider />
    </Section>
  );
};

const LabelValuePair = ({
  label,
  value,
  title,
  distribution = "columns",
  isRawLabel = false,
  isRawValue = false,
  isMockValue = false,
  onValueClick,
  valueID,
  children,
}: {
  label?: string;
  value: ReactNode;
  title?: string;
  distribution?: "columns" | "edges";
  isRawLabel?: boolean;
  isRawValue?: boolean;
  isMockValue?: boolean;
  children?: ReactNode;
  valueID?: string;
  onValueClick?: MouseEventHandler;
} & (
  | {
      label?: ReactNode | never;
      children: ReactNode;
    }
  | {
      label: ReactNode;
      children?: ReactNode | never;
    }
)) => {
  const valueAsString = typeof label === "string" ? label : "";
  return (
    <Row $distribution={distribution === "edges" ? "edges" : valueAsString.length < 80 ? "columns" : "rows"}>
      <RowLabel $isRawLabel={isRawLabel}>{label ?? children}</RowLabel>
      <RowValue title={title} $isMockValue={isMockValue} $isRawValue={isRawValue}>
        {onValueClick ? (
          // biome-ignore lint/a11y: Text, not a button.
          <a onClick={onValueClick} data-id={valueID}>
            {value}
          </a>
        ) : (
          value
        )}
      </RowValue>
    </Row>
  );
};

// MARK: - Component

export const ArtifactDetailsSidebar = ({
  resizeIdentifier,
  nodesByID,
  artifactNodeState,
  artifactSelector,
  selectedMetricsState,
  sidebarState,
  closesOnCollapse,
  createMetricCallback,
  metricDefinitionForID,
  metricColorForID,
}: {
  resizeIdentifier: string;
  nodesByID: Map<string, ArtifactNode[]>;
  artifactNodeState: StateObject<ArtifactNode | null>;
  artifactSelector?: ArtifactSelector | null;
  selectedMetricsState: StateObject<Map<string, Metric>>;
  sidebarState?: StateObject<SidebarState>;
  closesOnCollapse?: boolean;
  createMetricCallback?: () => void;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
  metricColorForID: (id: MetricID) => CSSColor;
}) => {
  const { currentOrganization, organizationSlug, kindConfigurations, kindConfigurationForPattern } =
    useContext(OrganizationContext);

  const rootNodeKind = kindConfigurations.at(0)?.key;

  const [artifactNode, setArtifactNode] = useBinding(artifactNodeState);

  const { artifact } = artifactNode ?? {};

  const lastEventSummaryID = useMemo(() => {
    if (artifactSelector?.eventSummaryIDs && artifactSelector.eventSummaryIDs.length > 0) {
      const currentEventSummaryIDs = new Set(artifactSelector.eventSummaryIDs ?? []);
      return artifact?.snapshots.findLast(({ eventSummaryID }) => currentEventSummaryIDs.has(eventSummaryID ?? ""))
        ?.eventSummaryID;
    }
    return artifact?.snapshots.at(-1)?.eventSummaryID;
  }, [artifact?.snapshots, artifactSelector?.eventSummaryIDs]);

  const artifactPath = artifact?.artifactPath;
  const localID = artifactPath?.at(-1);

  const artifactType = localID?.kind ?? localID?.id ?? "";
  const artifactTitle = artifactNode?.valueForKeyPaths({
    keyPaths: ["metadata.name"],
    activeEventSummaryID: lastEventSummaryID,
  }).display;

  const deleteArtifactDialogState = useStateObject(false);
  const [_isDeleteArtifactDialogOpen, setDeleteArtifactDialogOpen] = useBinding(deleteArtifactDialogState);

  const assets = useMemo(() => {
    const collectedAssets: {
      index: number;
      source: string;
      originalURL: string;
    }[] = [];
    const lastSnapshotContent = artifact?.snapshots.at(-1)?.content;
    if (lastSnapshotContent) {
      for (const { index, key, value } of enumerateContent(lastSnapshotContent)) {
        if (typeof value === "string" && value.startsWith("https://")) {
          collectedAssets.push({
            index,
            source: key ?? "Source",
            originalURL: value,
          });
        }
      }
    }
    return collectedAssets;
  }, [artifact]);

  const [metricSections, allSelectableMetrics] = useMemo(() => {
    const metrics = artifact?.metrics;
    const metricsWithExamples = new Map<string, Metric>();
    if (!metrics || metrics.length === 0) return [null, metricsWithExamples];

    metrics.sort((lhs, rhs) => {
      const lhsOrder = metricDefinitionForID(lhs.id)?.order ?? "";
      const rhsOrder = metricDefinitionForID(rhs.id)?.order ?? "";
      if (lhsOrder < rhsOrder) return -1;
      if (lhsOrder > rhsOrder) return 1;
      return 0;
    });

    const sectionGroups = new Map<
      string | null,
      { group: string | null; metrics: Metric[]; metricsWithExamples: Map<string, Metric> }
    >();

    for (const originalMetric of metrics) {
      /// Filter metrics so only those for the specified event summary ID are used.
      const metric = {
        ...originalMetric,
        values: originalMetric.values.filter(({ eventSummaryID }) => lastEventSummaryID === eventSummaryID),
      };
      if (metric.values.length === 0) continue;

      const definition = metricDefinitionForID(metric.id);
      if (definition?.isDeleted) continue;
      /// Use || to collapse empty group names into the same null bucket.
      const group = definition?.group || null;
      let section = sectionGroups.get(group);
      if (!section) {
        section = { group, metrics: [], metricsWithExamples: new Map() };
        sectionGroups.set(group, section);
      }
      section.metrics.push(metric);

      if (!metric.values.findLast((recording) => recording.examples?.at(0))) continue;
      metricsWithExamples.set(metric.id, metric);
      section.metricsWithExamples.set(metric.id, metric);
    }

    return [Array.from(sectionGroups.values()), metricsWithExamples];
  }, [artifact?.metrics, lastEventSummaryID, metricDefinitionForID]);

  const changeSelection: MouseEventHandler<HTMLAnchorElement> = useCallback(
    (event) => {
      const nodeID = event.currentTarget.dataset.id;
      if (!nodeID) return;

      setArtifactNode((previous) => {
        if (nodeID === previous?.id) return previous;
        return nodesByID.get(nodeID)?.at(0) ?? previous;
      });
    },
    [nodesByID, setArtifactNode],
  );

  const deleteArtifact = useCallback(async () => {
    if (!currentOrganization?.id || !artifactPath) return;
    await fetchDeleteArtifact({ orgID: currentOrganization.id, artifactPath, deleteSubartifacts: true });
    invalidateContentArtifacts(currentOrganization.id);
  }, [currentOrganization, artifactPath]);

  const promptDeleteArtifact = useCallback(() => {
    if (!artifactPath) return;
    setDeleteArtifactDialogOpen(true);
  }, [artifactPath, setDeleteArtifactDialogOpen]);

  const allMetricsID = useId();

  return (
    <Sidebar
      resizeIdentifier={resizeIdentifier}
      position="trailing"
      style="content"
      defaultWidth={360}
      minimumWidth={250}
      maximumWidth={600}
      sidebarState={sidebarState}
      closesOnCollapse={closesOnCollapse}
    >
      <SidebarTitle>
        {(typeof artifactTitle === "string" ? artifactTitle : null) ||
          kindConfigurationForPattern(artifactPath ?? [], "one").displayName}
      </SidebarTitle>
      <NavigationContent scrollsVertically style={{ padding: "0px 20px 20px" }}>
        <SidebarSection persistenceID="identity" title={"Identity"}>
          {artifactPath?.map(({ kind, id }, index) => {
            const subPath = artifactPath.slice(0, index + 1);
            const encodedSubPath = encodeArtifactPath(subPath);
            const kindPattern = (subPath as ArtifactPathPattern).slice(0, -1).concat(kind ? { kind } : { id });
            const kindConfiguration = kindConfigurationForPattern(kindPattern, "one");
            const encodedKind = encodeArtifactPathPattern(kindConfiguration.pattern);
            const href =
              encodedKind === rootNodeKind
                ? `/app/${organizationSlug}/artifacts`
                : `/app/${organizationSlug}/artifacts?kind=${encodedKind}`;

            return (
              <LabelValuePair
                key={encodedSubPath}
                value={id}
                valueID={encodeArtifactSelector({
                  tags: [],
                  eventSummaryIDs: [],
                  generationIDs: [],
                  ...artifactSelector,
                  artifactPath: subPath,
                })}
                onValueClick={index + 1 !== artifactPath.length ? changeSelection : undefined}
                isRawValue
              >
                <Link href={href}>{kind ? kindConfiguration.displayName : "    ↳"}</Link>
              </LabelValuePair>
            );
          })}
        </SidebarSection>
        {artifactNode && (createMetricCallback || (metricSections && metricSections.length > 0)) && (
          <SidebarSection
            persistenceID="metrics"
            defaultState="open"
            title={
              <>
                {!!allSelectableMetrics.size && (
                  <MetricCheckbox
                    allMetrics={allSelectableMetrics}
                    selectedMetricsState={selectedMetricsState}
                    id={allMetricsID}
                    metricColorForID={metricColorForID}
                  />
                )}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: This prevents an issue when clicking only. */}
                <label htmlFor={allMetricsID} onClick={allSelectableMetrics.size ? stopPropagation : undefined}>
                  Computed Metrics
                </label>
              </>
            }
          >
            {metricSections?.map(({ group, metrics, metricsWithExamples }) => {
              const key = group ? `metrics-group-${group}` : "metrics-group";
              return (
                <MetricGroup
                  key={key}
                  selectedMetricsState={selectedMetricsState}
                  group={group}
                  metrics={metrics}
                  metricsWithExamples={metricsWithExamples}
                  metricDefinitionForID={metricDefinitionForID}
                  metricColorForID={metricColorForID}
                />
              );
            })}
            {createMetricCallback && artifactPath?.at(-1)?.kind === "artifact" && (
              <Button action={createMetricCallback}>Create New Metric</Button>
            )}
          </SidebarSection>
        )}
        {artifact?.snapshots && artifact.snapshots.length > 0 && (
          <SidebarSection persistenceID="snapshots" title="Snapshots">
            {artifact.snapshots.map((snapshot, index) => (
              <ContentsGroup
                key={snapshot.eventSummaryID ?? `snapshot-${index}`}
                snapshot={snapshot}
                artifactPath={artifact.artifactPath}
                organizationSlug={organizationSlug}
                tags={artifactSelector?.tags ?? []}
                isActive={snapshot.eventSummaryID === lastEventSummaryID}
              />
            ))}
            {artifactPath && currentOrganization?.id && (
              <Button isDangerous action={promptDeleteArtifact}>
                Delete Artifact…
              </Button>
            )}
          </SidebarSection>
        )}
        {assets.length > 0 && (
          <SidebarSection persistenceID="assets" title="Assets">
            {assets.map(({ index, source, originalURL }) => (
              <Fragment key={index}>
                {index > 0 && <Divider />}
                {artifactType === "music" ? (
                  // biome-ignore lint/a11y/useMediaCaption: Not our audio, so can't provide captions.
                  <audio
                    style={{
                      width: "calc(100% - 16px)",
                      borderRadius: 4,
                      margin: 8,
                    }}
                    controls
                  >
                    <source src={originalURL} />
                  </audio>
                ) : (
                  // biome-ignore lint/performance/noImgElement: Not our image we are displaying.
                  <img
                    src={originalURL}
                    alt="source"
                    style={{
                      maxWidth: "100%",
                      height: "auto",
                      borderRadius: 4,
                      margin: 8,
                    }}
                    loading="lazy"
                  />
                )}
                <Row $distribution="columns">
                  <RowLabel $isRawLabel>{source}</RowLabel>
                  <RowValue $isMockValue={false} $isRawValue>
                    <a target="_blank" rel="noopener noreferrer" href={originalURL}>
                      {originalURL}
                    </a>
                  </RowValue>
                </Row>
              </Fragment>
            ))}
          </SidebarSection>
        )}
      </NavigationContent>
      <ConfirmationDialog
        isPresentedState={deleteArtifactDialogState}
        title="Delete artifact?"
        message="Are you sure you want to delete this artifact? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={deleteArtifact}
      />
    </Sidebar>
  );
};
ArtifactDetailsSidebar.displayName = "ArtifactDetailsSidebar";
