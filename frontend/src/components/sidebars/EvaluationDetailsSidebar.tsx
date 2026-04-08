import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import styled, { css } from "styled-components";

import { getBackendURL, useAccount } from "@/generated/serverEndpoints";
import type {
  Annotation,
  ArtifactPath,
  ArtifactSelector,
  CSSColor,
  EvaluationGroupID,
  Metric,
  MetricDefinition,
  MetricID,
} from "@/generated/serverTypes";

import { type StateObject, useBinding, useDerivedState, useStateObject } from "@/library/StateObject";

import type { ArtifactNode, TypedArtifactSnapshot } from "@/model/artifactNode";
import { encodeArtifactPath } from "@/model/artifactPath";
import { valueForMetricKeyPath } from "@/model/metrics";

import {
  type ArtifactAnnotationPayload,
  type ArtifactAnnotationSelection,
  isSameArtifact,
  isSameSnapshot,
} from "@/components/ArtifactAnnotation";
import { ArtifactAnnotationsList } from "@/components/ArtifactAnnotationsList";
import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import {
  Button,
  Checkbox,
  type CheckboxState,
  Color,
  Font,
  Label,
  LabeledControl,
  Sidebar,
  type SidebarState,
  Size,
} from "@/components/ui";
import { ToolbarContext } from "@/components/ui/ToolbarContext";

import { fetchUpdateArtifactSnapshot } from "@/app/navigator/_shared/artifacts";

// MARK: - Constants and Types

// MARK: - Styles

const Header = styled.div<{ $isToolbarVisible: boolean }>`${({ $isToolbarVisible }) => css`
  position: relative;
  display: flex;
  flex-direction: column;
  background: ${Color.contentSurface};
  padding: 20px 15px;
  gap: 6px;

  h1 {

    padding-right: ${$isToolbarVisible ? 35 : 0}px;
  }
`}`;

const Title = styled.h1`
  margin: 0;
  padding-bottom: 15px;
  font-size: ${Size.fontSize.fontSize16};
  font-weight: 500;
  border-bottom: 1px solid ${Color.line};
`;

const MetaText = styled.div`
  display: grid;
  grid-template-columns: 95px 1fr;
  column-gap: 5px;
  row-gap: 4px;

  font-size: ${Size.fontSize.fontSize14};
  line-height: 1.4;
  color: ${Color.textDark};
`;

const MetaLabel = styled.span`
  font-weight: 500;
  color: ${Color.textDark};
  white-space: nowrap;
`;

const MetaValue = styled.span`
  font-weight: 400;
  color: ${Color.textDark};
`;

const Divider = styled.hr`
  width: calc(100% - 30px);
  height: 1px;
  margin: 0px 15px;
  border: none;
  background-color: ${Color.line};
`;

const SectionHeader = styled(LabeledControl)`${() => css`
  position: relative;
  display: flex;
  justify-content: space-between;
  flex-direction: row;
  padding: 14px 20px;
  gap: 8px;
  align-items: center;

  ${Label} {
   font-size: ${Size.fontSize.fontSize16};
   font-weight: 500;
   font-family: ${Font.inter};
   padding: 0px;
  }
`}`;

const PanelSwitch = styled.span`${() => css`
  display: inline-flex;
  width: fit-content;
  padding: 3px;
  margin: 14px;
  gap: 4px;
  border: 0px;
  border-radius: 999px;
  background: ${Color.surfaceOffWhite};
`}`;

const PanelSwitchButton = styled.button<{ $isActive: boolean }>`${({ $isActive }) => css`
    border: none;
    border-radius: 999px;
    min-width: 112px;
    padding: 6px 8px;
    font-family: ${Font.inter};
    font-size: ${Size.fontSize.fontSize14};
    font-weight: 500;
    color: ${Color.textDark};
    background: ${$isActive ? Color.surfaceDivider : "transparent"};
    cursor: pointer;
`}`;

const MetricRow = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: row;
  margin: 2px 16px;
  padding: 10px 8px;
  border: ${Size.line.thickness} solid ${Color.line};
  border-radius: 6px;
  gap: 10px;
  align-items: center;
  background: ${Color.contentSurface};

  ${LabeledControl} {
    position: relative;
    display: flex;
    flex-direction: row;
    gap: 10px;

    position: relative;
    display: flex;
    gap: 6px;
    align-items: first-baseline;
    font-size: 15px;
    text-align: left;
    width: 100%;
    flex-shrink: 1;
    hyphens: "auto";
    word-break: break-word;

    ${Checkbox} {
      top: 2px;
    }

    ${Label} {
      font-size: 15px;
      padding: 0px;
      color: ${Color.mutedText};
    }
  }
`}`;

const Content = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding-bottom: 20px;
  background: ${Color.contentSurface};
`}`;

const RowValue = styled.div`${() => css`
  position: relative;
  display: block;
  font-size: 15px;
  text-align: left;
  width: fit-content;
  flex-shrink: 0;
  max-width: calc(50% - 4px);
  word-break: break-word;
  white-space: pre-line;
  color: black;
  font-variant-ligatures: normal;

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

const MetricGroupContainer = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`}`;

const MetricGroupSection = styled.section`${() => css`
  position: relative;
  display: grid;
  grid-template-rows: min-content 1fr;
  margin: 0px 0px 6px;
  transition: grid-template-rows 200ms, margin 200ms;

  &:last-of-type {
    margin: 0px;
  }
`}`;

// MARK: - Helper Functions

// MARK: - Helper Components

export const MetricCheckbox = (
  props: (
    | {
        metric: Metric;
        allMetrics?: undefined;
      }
    | {
        metric?: undefined;
        allMetrics: Map<string, Metric>;
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
      showsColorWhenOff
      size="regular"
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
  evaluationGroupID,
}: {
  selectedMetricsState: StateObject<Map<string, Metric>>;
  group: string | null;
  metricsWithExamples: Map<string, Metric>;
  metrics: Metric[];
  metricColorForID: (id: MetricID) => CSSColor;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
  evaluationGroupID?: EvaluationGroupID | null;
}) => {
  return (
    <MetricGroupSection>
      {group !== null && (
        <SectionHeader>
          <Label>{group}</Label>
          {!!metricsWithExamples.size && (
            <MetricCheckbox
              allMetrics={metricsWithExamples}
              selectedMetricsState={selectedMetricsState}
              metricColorForID={metricColorForID}
            />
          )}
        </SectionHeader>
      )}
      <MetricGroupContainer>
        {metrics.map((metric) => (
          <MetricRow key={metric.id}>
            <LabeledControl>
              <RowValue>
                {valueForMetricKeyPath({
                  metric,
                  metricDefinitionForID,
                  evaluationGroupID: evaluationGroupID ?? undefined,
                }).display ?? "None"}
              </RowValue>
              <Label>{metricDefinitionForID(metric.id)?.name ?? metric.id}</Label>
            </LabeledControl>
            {metric.values.findLast((recording) => recording.examples?.at(0)) && (
              <MetricCheckbox
                metric={metric}
                selectedMetricsState={selectedMetricsState}
                metricColorForID={metricColorForID}
              />
            )}
          </MetricRow>
        ))}
      </MetricGroupContainer>
    </MetricGroupSection>
  );
};

// MARK: - Component

export const EvaluationDetailsSidebar = ({
  resizeIdentifier,
  artifactNodeState,
  artifactSelector,
  selectedMetricsState,
  sidebarState,
  closesOnCollapse,
  metricDefinitionForID,
  metricColorForID,
  evaluationGroupID,
  annotationVisibilityState,
  pendingAnnotationSelection,
  onClearPendingAnnotationSelection,
  onAnnotationEditStart,
  onAnnotationEditEnd,
}: {
  resizeIdentifier: string;
  artifactNodeState: StateObject<ArtifactNode | null>;
  artifactSelector?: ArtifactSelector | null;
  selectedMetricsState: StateObject<Map<string, Metric>>;
  sidebarState?: StateObject<SidebarState>;
  closesOnCollapse?: boolean;
  metricDefinitionForID: (id: MetricID) => MetricDefinition | null;
  metricColorForID: (id: MetricID) => CSSColor;
  evaluationGroupID?: EvaluationGroupID | null;
  annotationVisibilityState: StateObject<CheckboxState>;
  pendingAnnotationSelection?: ArtifactAnnotationSelection | null;
  onClearPendingAnnotationSelection?: () => void;
  onAnnotationEditStart?: (selection: ArtifactAnnotationSelection) => void;
  onAnnotationEditEnd?: (selection: ArtifactAnnotationSelection) => void;
}) => {
  const { currentOrganization, kindConfigurationForPattern } = useContext(OrganizationContext);
  const { isToolbarVisible } = useContext(ToolbarContext);
  const { response: accountResponse } = useAccount();
  const currentUserID = accountResponse?.user.id;

  const [artifactNode] = useBinding(artifactNodeState);
  const [, setSelectedMetrics] = useBinding(selectedMetricsState);
  const [, setAnnotationVisibility] = useBinding(annotationVisibilityState);

  const { artifact } = artifactNode ?? {};

  const lastEventSummaryID = useMemo(() => {
    if (artifactSelector?.eventSummaryIDs && artifactSelector.eventSummaryIDs.length > 0) {
      const currentEventSummaryIDs = new Set(artifactSelector.eventSummaryIDs ?? []);
      return artifact?.snapshots.findLast(({ eventSummaryID }) => currentEventSummaryIDs.has(eventSummaryID ?? ""))
        ?.eventSummaryID;
    }
    return artifact?.snapshots.at(-1)?.eventSummaryID;
  }, [artifact?.snapshots, artifactSelector?.eventSummaryIDs]);

  const [, setIsSaving] = useState(false);

  const baseAnnotationSnapshots = useMemo<Array<TypedArtifactSnapshot | null | undefined>>(() => {
    if (!artifactNode) return [];

    const childNodes = Array.from(artifactNode.children.values());
    const nodesToShow = childNodes.length > 0 ? childNodes : [artifactNode];

    return nodesToShow.map((node) => {
      const nodeArtifact = node.artifact;
      if (!nodeArtifact?.snapshots || nodeArtifact.snapshots.length === 0) return null;

      if (artifactSelector?.eventSummaryIDs && artifactSelector.eventSummaryIDs.length > 0) {
        const currentEventSummaryIDs = new Set(artifactSelector.eventSummaryIDs ?? []);
        return (
          nodeArtifact.snapshots.findLast(({ eventSummaryID }) => currentEventSummaryIDs.has(eventSummaryID ?? "")) ??
          nodeArtifact.snapshots.at(-1) ??
          null
        );
      }

      return nodeArtifact.snapshots.at(-1) ?? null;
    });
  }, [artifactNode, artifactSelector?.eventSummaryIDs]);

  type AnnotationState = { snapshot: TypedArtifactSnapshot; annotations: Record<string, Annotation> };
  const [annotationStateByPath, setAnnotationStateByPath] = useState<Map<string, AnnotationState>>(() => {
    const initialMap = new Map<string, AnnotationState>();
    for (const snapshot of baseAnnotationSnapshots) {
      if (!snapshot?.artifactPath) continue;
      initialMap.set(encodeArtifactPath(snapshot.artifactPath), {
        snapshot,
        annotations: snapshot.annotations ?? {},
      });
    }
    return initialMap;
  });
  const deleteAnnotationDialogState = useStateObject(false);
  const [_isDeleteAnnotationDialogOpen, setDeleteAnnotationDialogOpen] = useBinding(deleteAnnotationDialogState);
  const [pendingAnnotationDelete, setPendingAnnotationDelete] = useState<{
    artifactPath: ArtifactPath;
    annotation: Annotation;
  } | null>(null);

  useEffect(() => {
    const resetAnnotations = new Map<string, AnnotationState>();
    for (const snapshot of baseAnnotationSnapshots) {
      if (!snapshot?.artifactPath) continue;
      resetAnnotations.set(encodeArtifactPath(snapshot.artifactPath), {
        snapshot,
        annotations: snapshot.annotations ?? {},
      });
    }
    setAnnotationStateByPath(resetAnnotations);
  }, [baseAnnotationSnapshots]);

  const annotationSnapshots = useMemo<Array<TypedArtifactSnapshot | null | undefined>>(() => {
    return baseAnnotationSnapshots.map((snapshot) => {
      if (!snapshot?.artifactPath) return snapshot;
      const encodedPath = encodeArtifactPath(snapshot.artifactPath);
      const state = annotationStateByPath.get(encodedPath);
      if (!state) return snapshot;
      const { annotations } = state;

      return { ...snapshot, annotations: annotations };
    });
  }, [annotationStateByPath, baseAnnotationSnapshots]);

  const artifactPath = artifact?.artifactPath;
  const parentArtifactPath = artifactPath?.slice(0, -1);
  const organizationID = currentOrganization?.id ?? null;

  const encodedArtifactPathsForSelection = useMemo(() => {
    if (!artifactNode) return [];
    const encodedPaths: string[] = [];
    const encodedNodePath = artifactPath ? encodeArtifactPath(artifactPath) : null;
    if (encodedNodePath) encodedPaths.push(encodedNodePath);

    for (const childNode of artifactNode.children.values()) {
      const childPath = childNode.artifact?.artifactPath;
      if (!childPath) continue;
      encodedPaths.push(encodeArtifactPath(childPath));
    }

    return encodedPaths;
  }, [artifactNode, artifactPath]);

  const selectionForCurrentArtifact = useMemo(() => {
    if (!pendingAnnotationSelection || encodedArtifactPathsForSelection.length === 0) return null;
    const matchesArtifact = isSameArtifact(pendingAnnotationSelection, encodedArtifactPathsForSelection);
    const matchesSnapshot = isSameSnapshot(pendingAnnotationSelection, lastEventSummaryID);
    return matchesArtifact && matchesSnapshot ? pendingAnnotationSelection : null;
  }, [encodedArtifactPathsForSelection, lastEventSummaryID, pendingAnnotationSelection]);

  const artifactKindConfiguration = useMemo(
    () => kindConfigurationForPattern(artifactPath ?? [], "one"),
    [artifactPath, kindConfigurationForPattern],
  );
  const isDataset = artifactPath?.at(-1)?.kind === "dataset";

  const artifactTitle = artifactNode?.valueForKeyPaths({
    keyPaths: ["metadata.name", "id.truncated(7,0)"],
    activeEventSummaryID: lastEventSummaryID,
  }).display;
  const parentTitle = artifactNode?.valueForKeyPaths({
    keyPaths: ["parent.metadata.name", "parent.id.truncated(9,0)"],
  }).display;

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
        values: originalMetric.values.filter(({ eventSummaryID, evaluationGroupID: metricEvaluationGroupID }) => {
          if (lastEventSummaryID !== eventSummaryID) return false;
          if (evaluationGroupID && metricEvaluationGroupID !== evaluationGroupID) return false;
          return true;
        }),
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
  }, [artifact?.metrics, evaluationGroupID, lastEventSummaryID, metricDefinitionForID]);
  const hasMetrics = !!artifactNode && !!evaluationGroupID && !!metricSections && metricSections.length > 0;
  const [activePanel, setActivePanel] = useState<"annotations" | "metrics">(hasMetrics ? "metrics" : "annotations");

  const artifactDisplayName = artifactKindConfiguration.displayName || "Artifact";
  const parentDisplayName =
    parentArtifactPath && parentArtifactPath.length > 0
      ? kindConfigurationForPattern(parentArtifactPath, "one").displayName || "Dataset"
      : "Dataset";

  const dateUploaded = artifactNode?.valueForKeyPaths({
    keyPaths: ["creationTimestamp.localizedDate"],
    activeEventSummaryID: lastEventSummaryID,
  }).display;
  const timeUploaded = artifactNode?.valueForKeyPaths({
    keyPaths: ["creationTimestamp.localizedTime"],
    activeEventSummaryID: lastEventSummaryID,
  }).display;

  const persistAnnotations = useCallback(
    async (artifactPath: ArtifactPath, nextAnnotations: Record<string, Annotation>) => {
      if (!currentOrganization?.id) return false;

      const encodedPath = encodeArtifactPath(artifactPath);
      const targetState = annotationStateByPath.get(encodedPath);
      if (!targetState) return false;
      const eventSummaryID = targetState.snapshot.eventSummaryID;
      if (!eventSummaryID) return false;

      setAnnotationStateByPath((existing) => {
        const updated = new Map(existing);
        updated.set(encodedPath, { snapshot: targetState.snapshot, annotations: nextAnnotations });
        return updated;
      });
      setIsSaving(true);

      try {
        await fetchUpdateArtifactSnapshot({
          orgID: currentOrganization.id,
          artifactPath,
          eventSummaryID,
          snapshotDelta: {
            annotations: nextAnnotations,
          },
        });
      } catch (error) {
        console.error("Unable to save annotations", error);
        setAnnotationStateByPath((existing) => {
          const updated = new Map(existing);
          updated.set(encodedPath, targetState);
          return updated;
        });
      } finally {
        setIsSaving(false);
      }
    },
    [annotationStateByPath, currentOrganization?.id],
  );

  const handleUpdateAnnotation = useCallback(
    async (artifactPath: ArtifactPath, annotation: Annotation, payload: ArtifactAnnotationPayload) => {
      const encodedPath = encodeArtifactPath(artifactPath);
      const existingAnnotations = annotationStateByPath.get(encodedPath)?.annotations ?? {};
      const existingAnnotation = existingAnnotations[annotation.id] ?? annotation;
      const nextAnnotations: Record<string, Annotation> = {
        ...existingAnnotations,
        [annotation.id]: {
          ...existingAnnotation,
          content: payload.content,
          location: payload.selectionRange,
          modifiedTimestamp: payload.updatedAt ?? new Date().toISOString(),
        },
      };
      await persistAnnotations(artifactPath, nextAnnotations);
    },
    [annotationStateByPath, persistAnnotations],
  );

  const deleteAnnotation = useCallback(
    async (artifactPath: ArtifactPath, annotation: Annotation) => {
      const encodedPath = encodeArtifactPath(artifactPath);
      const existingAnnotations = annotationStateByPath.get(encodedPath)?.annotations ?? {};
      const existingAnnotation = existingAnnotations[annotation.id] ?? annotation;
      const nextAnnotations: Record<string, Annotation> = {
        ...existingAnnotations,
        [annotation.id]: { ...existingAnnotation, isDeleted: true, modifiedTimestamp: new Date().toISOString() },
      };
      await persistAnnotations(artifactPath, nextAnnotations);
    },
    [annotationStateByPath, persistAnnotations],
  );

  const promptDeleteAnnotation = useCallback(
    (artifactPath: ArtifactPath, annotation: Annotation) => {
      setPendingAnnotationDelete({ artifactPath, annotation });
      setDeleteAnnotationDialogOpen(true);
    },
    [setDeleteAnnotationDialogOpen],
  );

  const confirmDeleteAnnotation = useCallback(async () => {
    if (!pendingAnnotationDelete) return;
    const { artifactPath, annotation } = pendingAnnotationDelete;
    setPendingAnnotationDelete(null);
    await deleteAnnotation(artifactPath, annotation);
  }, [pendingAnnotationDelete, deleteAnnotation]);

  const handleCreateAnnotation = useCallback(
    async (payload: ArtifactAnnotationPayload) => {
      if (!selectionForCurrentArtifact || !currentUserID) return;
      const encodedPath = encodeArtifactPath(selectionForCurrentArtifact.artifactPath);
      if (!annotationStateByPath.has(encodedPath)) return;
      const existingAnnotations = annotationStateByPath.get(encodedPath)?.annotations ?? {};
      const timestamp = new Date().toISOString();
      const newAnnotation: Annotation = {
        id: crypto.randomUUID(),
        location: payload.selectionRange,
        content: payload.content,
        author: currentUserID,
        createdTimestamp: timestamp,
        modifiedTimestamp: timestamp,
        isDeleted: false,
      };
      const nextAnnotations: Record<string, Annotation> = {
        ...existingAnnotations,
        [newAnnotation.id]: newAnnotation,
      };
      await persistAnnotations(selectionForCurrentArtifact.artifactPath, nextAnnotations);
      onClearPendingAnnotationSelection?.();
    },
    [
      annotationStateByPath,
      currentUserID,
      onClearPendingAnnotationSelection,
      persistAnnotations,
      selectionForCurrentArtifact,
    ],
  );

  const handleDownload = useCallback(() => {
    if (!organizationID || !artifactPath || !isDataset) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams();
    params.set("orgID", organizationID);
    artifactPath.forEach((component, index) => {
      params.set(`artifactPath[${index}][id]`, component.id);
      if (component.kind) {
        params.set(`artifactPath[${index}][kind]`, component.kind);
      }
    });
    window.location.assign(getBackendURL("v0.1/artifacts/export", params));
  }, [organizationID, artifactPath, isDataset]);

  const handleAnnotationsPanelSelect = useCallback(() => {
    setActivePanel("annotations");
    setAnnotationVisibility("on");
  }, [setAnnotationVisibility]);

  const handleMetricsPanelSelect = useCallback(() => {
    setActivePanel("metrics");
    setSelectedMetrics(new Map(allSelectableMetrics));
  }, [allSelectableMetrics, setSelectedMetrics]);

  useEffect(() => {
    if (!artifactNode?.id || !hasMetrics) return;
    setActivePanel("metrics");
  }, [artifactNode?.id, hasMetrics]);

  useEffect(() => {
    if (!hasMetrics && activePanel === "metrics") {
      setActivePanel("annotations");
    }
  }, [activePanel, hasMetrics]);

  useEffect(() => {
    if (selectionForCurrentArtifact) {
      setActivePanel("annotations");
    }
  }, [selectionForCurrentArtifact]);

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
      <Header $isToolbarVisible={isToolbarVisible}>
        <Title>{artifactNode ? artifactTitle || artifactDisplayName : `No ${artifactDisplayName} Selected`}</Title>
        {parentArtifactPath && parentArtifactPath.length > 0 && (
          <MetaText>
            <MetaLabel>{parentDisplayName}:</MetaLabel>
            <MetaValue>{parentTitle}</MetaValue>
          </MetaText>
        )}
        {dateUploaded && (
          <MetaText>
            <MetaLabel>Date uploaded:</MetaLabel>
            <MetaValue>{dateUploaded}</MetaValue>
          </MetaText>
        )}
        {timeUploaded && (
          <MetaText>
            <MetaLabel>Time uploaded:</MetaLabel>
            <MetaValue>{timeUploaded}</MetaValue>
          </MetaText>
        )}
        {isDataset && organizationID && (
          <Button size="regular" action={handleDownload} style={{ marginTop: "12px", height: "32px" }}>
            Download
          </Button>
        )}
      </Header>
      {artifactNode && <Divider />}
      <Content>
        {!!artifactNode && hasMetrics && (
          <PanelSwitch>
            <PanelSwitchButton $isActive={activePanel === "metrics"} onClick={handleMetricsPanelSelect}>
              Metrics
            </PanelSwitchButton>
            <PanelSwitchButton $isActive={activePanel === "annotations"} onClick={handleAnnotationsPanelSelect}>
              Annotations
            </PanelSwitchButton>
          </PanelSwitch>
        )}
        {!!artifactNode &&
          hasMetrics &&
          activePanel === "metrics" &&
          metricSections.map(({ group, metrics, metricsWithExamples }) => {
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
                evaluationGroupID={evaluationGroupID}
              />
            );
          })}
        {!!artifactNode && activePanel === "annotations" && (
          <ArtifactAnnotationsList
            artifactSnapshots={annotationSnapshots}
            visibilityState={annotationVisibilityState}
            pendingAnnotationSelection={selectionForCurrentArtifact}
            onAnnotationCreate={handleCreateAnnotation}
            onAnnotationCancel={onClearPendingAnnotationSelection}
            onAnnotationSave={handleUpdateAnnotation}
            onAnnotationDelete={promptDeleteAnnotation}
            onAnnotationEditStart={onAnnotationEditStart}
            onAnnotationEditEnd={onAnnotationEditEnd}
          />
        )}
      </Content>
      <ConfirmationDialog
        isPresentedState={deleteAnnotationDialogState}
        title="Delete Annotation?"
        confirmLabel="Delete"
        onConfirm={confirmDeleteAnnotation}
        onCancel={() => setPendingAnnotationDelete(null)}
      />
    </Sidebar>
  );
};
EvaluationDetailsSidebar.displayName = "EvaluationDetailsSidebar";
