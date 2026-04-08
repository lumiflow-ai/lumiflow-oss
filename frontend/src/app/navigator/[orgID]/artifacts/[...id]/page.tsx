"use client"; // Putting this at the top level so it'll propagate all the way down for simplicity

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEventHandler, use, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import styled, { css } from "styled-components";

import { fetchDeleteArtifact, useDashboard } from "@/generated/serverEndpoints";
import {
  type ArtifactPathPattern,
  DashboardContext,
  type Metric,
  type MetricID,
  WidgetKind,
} from "@/generated/serverTypes";

import { useBinding, useReactiveState, useStateObject } from "@/library/StateObject";
import useLocalStorageStateObject from "@/library/useLocalStorageStateObject";
import { useOpenLinearIssue } from "@/library/useOpenLinearIssue";

import type { ArtifactNode } from "@/model/artifactNode";
import {
  decodeArtifactSelector,
  encodeArtifactPath,
  encodeArtifactPathPattern,
  matchingPatternsForArtifactPath,
} from "@/model/artifactPath";
import { valueForKeyPath } from "@/model/keyPath";
import { encodedArtifactPathsForMetricExamples } from "@/model/metrics";

import type { ArtifactAnnotationSelection } from "@/components/ArtifactAnnotation";
import { ContentHeader } from "@/components/ContentHeader";
import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import { MetricsComparisonPanel } from "@/components/MetricsComparisonPanel";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { FeatureTipDialog } from "@/components/modals/FeatureTipDialog";
import { NavigationSidebar } from "@/components/NavigationSidebar";
import { EvaluationDetailsSidebar } from "@/components/sidebars/EvaluationDetailsSidebar";
import {
  Button,
  type CheckboxState,
  Color,
  Font,
  NavigationContent,
  NavigationStack,
  type ScrollHandler,
  type SidebarState,
  Size,
  Toolbar,
  ToolbarItem,
} from "@/components/ui";
import { DashboardRenderer } from "@/components/WidgetRenderer";

import { invalidateContentArtifacts } from "@/app/navigator/_shared/artifacts";
import { ArtifactContext } from "@/app/navigator/_shared/context";

/// MARK: - Styles

const ChevronStyle = styled.img`${() => css`
  position: relative;
  opacity: 0.3;
  top: 0px;
`}`;

const Chevron = () => {
  return <ChevronStyle src="/assets/chevron-forward.svg" width="5" height="10" alt="" />;
};

const PathComponent = styled.div`${() => css`
  position: relative;
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 15px;
  color: ${Color.mutedText};

  a {
    text-decoration: none;
    line-clamp: 1;
    color: ${Color.mutedText};

    &:hover {
      color: ${Color.mutedText};
    }

    &:active:hover {
      color: ${Color.mutedText};
    }
  }

  span {
    line-clamp: 1;
  }
`}`;

const LastPathComponent = styled(PathComponent)`${() => css`
  top: 28px;
  opacity: 0;
`}`;

const PathContainer = styled.div`${() => css`
  position: relative;
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 15px;
  color: ${Color.mutedText};
  padding-left: 4px;
`}`;

const EmptyStateContainer = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  text-align: center;

  h3 {
      font-size: ${Size.fontSize.fontSize14};
      font-weight: 400;
      font-family: ${Font.ibmPlexSans};
      line-height: 1.2;
      max-width: 300px;
      text-wrap: balance;
      text-wrap: pretty;
      margin: 0px;
    }
`}`;

const ArtifactHeader = styled.div`${() => css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  top: 50%;
  z-index: 10;
  position: absolute;
  width: 100%;
  gap: 12px;
`}`;

const ArtifactTitle = styled(ContentHeader)`${() => css`
  margin: 0;
`}`;

const ArtifactNavigation = styled.div`${() => css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width:100%;
  gap: 10px;
  margin:0px 5px
`}`;

const ArtifactNavigationButton = styled(Button)`${() => css`
  width: 35px;
  height: 32px;
  
  &[disabled] {
    opacity: 0.4;
    cursor: auto;
   
  }
}`}`;

const ButtonContent = styled.span`${() => css`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`}`;

/// MARK: - Page

const selectedMetricsParam = "metric";
const evaluationGroupParam = "evaluationGroupID";
const annotationTipParam = "annotationTip";

const annotationVisibilityParam = "annotations";
type AnnotationVisibilityValue = "show" | "hide";

const ArtifactContentsList = (props: {
  params: Promise<{ id: string[] }>;
  searchParams: Promise<{
    annotations?: AnnotationVisibilityValue;
    annotationTip?: string | string[];
    metric?: string | string[];
    evaluationGroupID?: string | string[];
  }>;
}) => {
  const params = use(props.params);
  const searchParams = use(props.searchParams);

  const {
    currentOrganization,
    organizationSlug,
    kindConfigurationForPattern,
    canCreateArtifactWithPattern,
    metricDefinitionForID,
    metricColorForID,
  } = useContext(OrganizationContext);

  const context = useContext(ArtifactContext);
  if (!context) throw new Error("Component must be used within a ArtifactContextProvider");
  const { nodesByID, sortDescriptors, isLoading } = context;

  const artifactSelector = useMemo(() => decodeArtifactSelector(params.id), [params.id]);

  const [currentNode, setCurrentNode] = useState<ArtifactNode | null>(null);
  const currentArtifactPath = currentNode?.artifact?.artifactPath;
  const currentLocalID = currentArtifactPath?.at(-1);
  const annotationTipPresentedState = useStateObject(false);

  const patterns = useMemo(
    () => matchingPatternsForArtifactPath(artifactSelector.artifactPath),
    [artifactSelector.artifactPath],
  );

  /// Normalize searchParams.selectedMetrics to an array of metric IDs, or null if absent
  /// - null: param not in URL, fall through to localStorage
  /// - []: param present but empty (e.g., ?selectedMetrics=), explicitly select nothing
  /// - [...ids]: param present with values, use those
  const metricsSelectedInURL = useMemo(() => {
    const metricsParamContent = searchParams[selectedMetricsParam];
    // Three possibilities: undefined, string, or array
    if (metricsParamContent === undefined) return null; // Param not in URL
    if (typeof metricsParamContent === "string") return metricsParamContent ? [metricsParamContent] : [];

    // is defined and not a string -- must be an array
    const filtered = metricsParamContent.filter((id) => id !== "");
    return filtered.length > 0 ? filtered : [];
  }, [searchParams]);

  /// Search param for annotation visibility is memo'd as it doesn't change.
  /// Any change reloads the page anew with new search params, see useEffect below.
  const annotationVisibilityInURL = useMemo<CheckboxState | null>(() => {
    if (searchParams.annotations === undefined) return null;
    return searchParams.annotations === "hide" ? "off" : "on";
  }, [searchParams]);

  const showAnnotationTip = useMemo(() => {
    const rawValue = searchParams[annotationTipParam];
    if (rawValue === undefined) return false;
    if (Array.isArray(rawValue)) return rawValue.some((value) => value !== "");
    return rawValue !== "";
  }, [searchParams]);

  const evaluationGroupID = useMemo(() => {
    const values = searchParams[evaluationGroupParam] || [];
    const firstValue = (Array.isArray(values) ? values : [values]).find((value) => value);
    return firstValue ?? null;
  }, [searchParams]);

  /// Base the last selection storage key on the most general pattern, which is last in the list
  const persistedMetricIDsState = useLocalStorageStateObject<MetricID[]>(
    `selectedMetrics-${encodeArtifactPathPattern(patterns.at(-1) ?? [])}`,
    [],
  );
  const activeMetricsState = useStateObject<Map<MetricID, Metric>>(() => new Map());
  const [activeMetrics] = useBinding(activeMetricsState);

  useReactiveState(
    activeMetricsState,
    (_, newSelection) => {
      persistedMetricIDsState.wrappedValue = Array.from(newSelection.keys());
    },
    [currentNode, persistedMetricIDsState],
  );

  const persistedAnnotationVisibilityState = useLocalStorageStateObject<CheckboxState>(annotationVisibilityParam, "on");
  const annotationVisibilityState = useStateObject<CheckboxState>(persistedAnnotationVisibilityState.wrappedValue);
  const [annotationVisibility] = useBinding(annotationVisibilityState);

  /// Persist annotation visibility to localStorage whenever it changes (either from URL or user action)
  useReactiveState(
    annotationVisibilityState,
    (_, newState) => {
      persistedAnnotationVisibilityState.wrappedValue = newState;
    },
    [persistedAnnotationVisibilityState],
  );

  const dashboardRequest = useDashboard(
    currentOrganization && { orgID: currentOrganization.id, patterns, context: DashboardContext.detail },
  );
  const isDashboardLoading = dashboardRequest.isLoading;
  const dashboard = dashboardRequest.response?.dashboard;
  const showsArtifactContent = useMemo(
    () => (dashboard?.widgets ?? []).some((widget) => widget.kind === WidgetKind.content),
    [dashboard?.widgets],
  );

  const currentSelectionState = useStateObject<ArtifactNode | null>(currentNode);
  const [currentSelection, setCurrentSelection] = useBinding(currentSelectionState);
  const deleteArtifactDialogState = useStateObject(false);
  const [_isDeleteArtifactDialogOpen, setDeleteArtifactDialogOpen] = useBinding(deleteArtifactDialogState);
  const [artifactToDelete, setArtifactToDelete] = useState<ArtifactNode | null>(null);

  const [pendingAnnotationSelection, setPendingAnnotationSelection] = useState<ArtifactAnnotationSelection | null>(
    null,
  );
  const [activeAnnotationSelectionsByID, setActiveAnnotationSelectionsByID] = useState<
    Map<string, ArtifactAnnotationSelection>
  >(() => new Map());

  const detailSidebarState = useStateObject<SidebarState>("collapsed");
  const [currentDetailsSidebarState, setCurrentDetailsSidebarState] = useBinding(detailSidebarState);

  const navigationSidebarState = useStateObject<SidebarState>("open");
  const [currentNavigationSidebarState, setCurrentNavigationSidebarState] = useBinding(navigationSidebarState);

  const lastEventSummaryID = useMemo(() => {
    if (artifactSelector?.eventSummaryIDs && artifactSelector.eventSummaryIDs.length > 0) {
      const currentEventSummaryIDs = new Set(artifactSelector.eventSummaryIDs ?? []);
      return (
        currentNode?.artifact?.snapshots.findLast(({ eventSummaryID }) =>
          currentEventSummaryIDs.has(eventSummaryID ?? ""),
        )?.eventSummaryID ?? null
      );
    }
    return currentNode?.artifact?.snapshots.at(-1)?.eventSummaryID ?? null;
  }, [currentNode?.artifact?.snapshots, artifactSelector?.eventSummaryIDs]);

  const artifactTitle = currentNode?.valueForKeyPaths({
    keyPaths: ["metadata.name"],
    activeEventSummaryID: lastEventSummaryID,
  }).display;

  const artifactSearchParams = useMemo(() => {
    const params = new URLSearchParams();
    const metricsParam = searchParams[selectedMetricsParam];
    if (metricsParam !== undefined) {
      if (Array.isArray(metricsParam)) {
        for (const value of metricsParam) {
          params.append(selectedMetricsParam, value);
        }
      } else {
        params.set(selectedMetricsParam, metricsParam);
      }
    }
    if (searchParams.annotations !== undefined) {
      params.set("annotations", searchParams.annotations);
    }
    const evaluationParam = searchParams[evaluationGroupParam];
    if (evaluationParam !== undefined) {
      if (Array.isArray(evaluationParam)) {
        for (const value of evaluationParam) {
          params.append(evaluationGroupParam, value);
        }
      } else {
        params.set(evaluationGroupParam, evaluationParam);
      }
    }
    const queryString = params.toString();
    return queryString ? `?${queryString}` : "";
  }, [searchParams]);

  useEffect(() => {
    // Skip validation while data is loading to prevent premature clearing
    if (isLoading || isDashboardLoading) {
      return;
    }

    const node = nodesByID.get(encodeArtifactPath(artifactSelector.artifactPath))?.at(0) ?? null;
    if (node)
      node.orderChildren({
        sortDescriptors,
        activeEventSummaryID: lastEventSummaryID,
        metricDefinitionForID,
        kindConfigurationForPattern,
      });
    setCurrentNode(node); // Set node last to trigger single re-render with all updates
    setCurrentSelection(node);

    /// Auto-select metrics based on what the current dashboard supports, and what the user last-selected.
    if (dashboard && node?.artifact?.metrics) {
      /// Collect the allowed artifact paths based on the widgets shown in the current dashboard
      const allowedArtifactPaths = new Set<string>();
      for (const widget of dashboard.widgets) {
        if (widget.kind !== WidgetKind.content) continue;
        const widgetArtifactPath = [node.id, encodeArtifactPath(widget.childArtifactPath)].join("/");
        allowedArtifactPaths.add(widgetArtifactPath);

        /// Also collect any sources the artifact references since those will also be covered.
        if (widget.showsContext) {
          const widgetArtifactNode = nodesByID.get(widgetArtifactPath)?.at(0);
          for (const source of widgetArtifactNode?.artifact?.sourceArtifactPaths ?? []) {
            allowedArtifactPaths.add(encodeArtifactPath(source));
          }
        }
      }

      /// Collect metrics to select from URL params or localStorage
      const requestedMetricIDs = new Set(metricsSelectedInURL ?? persistedMetricIDsState.wrappedValue);

      /// Also include any currently selected metrics (preserve user selections)
      for (const [id] of activeMetricsState.wrappedValue) {
        requestedMetricIDs.add(id);
      }

      /// Filter and validate all metrics that should be selected
      const validatedMetricsMap = new Map<MetricID, Metric>();
      for (const metric of node.artifact.metrics) {
        /// Only process metrics that are requested
        if (!requestedMetricIDs.has(metric.id)) continue;

        /// Filter metrics so only those for the specified event summary ID are used.
        const filteredMetric = {
          ...metric,
          values: metric.values.filter(({ eventSummaryID }) => lastEventSummaryID === eventSummaryID),
        };
        if (filteredMetric.values.length === 0) continue;

        /// Verify the dashboard can display this metric
        const metricArtifactPaths = encodedArtifactPathsForMetricExamples([filteredMetric]);
        if (allowedArtifactPaths.isSupersetOf(metricArtifactPaths)) {
          validatedMetricsMap.set(filteredMetric.id, filteredMetric);
        }
      }

      /// Update state if URL params exist (even empty) OR localStorage provided metrics
      if (metricsSelectedInURL !== null || validatedMetricsMap.size > 0) {
        // Safety check: Don't clear activeMetrics if URL has metrics but validation filtered everything out
        // This can happen in the first render after loading when currentNode hasn't been set
        const urlHasMetrics = metricsSelectedInURL && metricsSelectedInURL.length > 0;
        const dontTouchActiveMetrics = validatedMetricsMap.size === 0 && urlHasMetrics;

        if (dontTouchActiveMetrics) {
          // Don't clear metrics - wait for next render with valid data
          return;
        }

        activeMetricsState.wrappedValue = validatedMetricsMap;
      }
    }
  }, [
    nodesByID,
    artifactSelector,
    sortDescriptors,
    setCurrentSelection,
    lastEventSummaryID,
    metricDefinitionForID,
    kindConfigurationForPattern,
    dashboard,
    metricsSelectedInURL,
    persistedMetricIDsState,
    activeMetricsState,
    isLoading,
    isDashboardLoading,
  ]);

  const router = useRouter();

  /// Update URL when selected metrics change (use replace to avoid browser history clutter)
  useEffect(() => {
    // Skip URL updates while data is loading to prevent URL corruption
    if (isLoading || isDashboardLoading) {
      return;
    }

    // Sort activeMetricIDS for consistent URL param order
    const activeMetricIDS = new Set([...activeMetrics.keys()].sort());
    const url = new URL(window.location.href);

    // Get current metrics from URL, filtering out empty strings for comparison
    const rawURLParams = url.searchParams.getAll(selectedMetricsParam);
    const currentMetricsInURL = new Set(rawURLParams.filter((id) => id !== ""));

    // Only update if the sets differ
    const activeDifferFromURL = currentMetricsInURL.symmetricDifference(activeMetricIDS).size !== 0;

    if (activeDifferFromURL) {
      url.searchParams.delete(selectedMetricsParam);

      // If no metrics selected, set empty param to preserve "?selectedMetrics="
      if (activeMetricIDS.size === 0) {
        url.searchParams.set(selectedMetricsParam, "");
      } else {
        // Add each metric ID as a separate param value
        for (const id of activeMetricIDS) {
          url.searchParams.append(selectedMetricsParam, id);
        }
      }

      router.replace(url.toString());
    }
  }, [activeMetrics, router, isLoading, isDashboardLoading]);

  /// Update annotation visibility state based on the URL param.
  /// This should only happen on initial load; any URL change reloads the page, thus preventing loops.
  useEffect(() => {
    if (annotationVisibilityInURL !== null && annotationVisibilityInURL !== annotationVisibilityState.wrappedValue) {
      annotationVisibilityState.wrappedValue = annotationVisibilityInURL;
    }
  }, [annotationVisibilityInURL, annotationVisibilityState]);

  /// Update URL when annotation visibility change (use replace to avoid browser history clutter)
  useEffect(() => {
    const newValue = annotationVisibilityState.wrappedValue === "off" ? "hide" : "show";
    if (searchParams.annotations !== newValue) {
      const url = new URL(window.location.href);
      url.searchParams.set(annotationVisibilityParam, newValue);
      router.replace(url.toString());
    }
  }, [annotationVisibilityState.wrappedValue, router, searchParams.annotations]);

  useEffect(() => {
    if (!showAnnotationTip) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(annotationTipParam);
    router.replace(url.toString(), { scroll: false });
  }, [showAnnotationTip, router]);

  useEffect(() => {
    if (showAnnotationTip) {
      annotationTipPresentedState.wrappedValue = true;
    }
  }, [showAnnotationTip, annotationTipPresentedState]);

  const openLinearIssue = useOpenLinearIssue();

  const resetNavigationHandler: MouseEventHandler<HTMLElement> = useCallback(() => {
    setCurrentSelection(currentNode);
  }, [setCurrentSelection, currentNode]);

  const handleAnnotationSelection = useCallback(
    (selection: ArtifactAnnotationSelection) => {
      setPendingAnnotationSelection(selection);
      detailSidebarState.wrappedValue = "open";
    },
    [detailSidebarState],
  );

  const handleAnnotationEditStart = useCallback(
    (selection: ArtifactAnnotationSelection) => {
      const annotationID = selection.annotationID;
      if (!annotationID) return;
      setActiveAnnotationSelectionsByID((previous) => {
        const next = new Map(previous);
        next.set(annotationID, selection);
        return next;
      });
      detailSidebarState.wrappedValue = "open";
    },
    [detailSidebarState],
  );

  const handleAnnotationEditEnd = useCallback((selection: ArtifactAnnotationSelection) => {
    const annotationID = selection.annotationID;
    if (!annotationID) return;
    setActiveAnnotationSelectionsByID((previous) => {
      const next = new Map(previous);
      next.delete(annotationID);
      return next;
    });
  }, []);

  const sidebarNode = currentSelection ?? currentNode;

  const toggleNavigationSidebar = useCallback(() => {
    setCurrentNavigationSidebarState((previous) => {
      if (previous === "open") return "collapsed";
      if (previous === "collapsed") return "open";
      return previous;
    });
  }, [setCurrentNavigationSidebarState]);

  const toggleDetailSidebar: MouseEventHandler = useCallback(
    (event) => {
      setCurrentDetailsSidebarState((previous) => {
        if (previous === "open") return "collapsed";
        if (previous === "collapsed") return "open";
        return previous;
      });
      event.stopPropagation();
    },
    [setCurrentDetailsSidebarState],
  );

  const isMetricsComparisonModalEnabled = useCallback(
    (selectedMetrics: Map<string, Metric>) => {
      /// Prevent flashing the modal while the dashboard or current node are loading.
      if (isDashboardLoading || !currentNode) return false;

      /// Allow the modal if there is no dashboard or artifact.
      if (!currentNode?.artifact || !dashboard) return true;

      const encodedArtifactPaths = encodedArtifactPathsForMetricExamples(selectedMetrics.values());

      /// Check to see if the dashboard has a content widget for every artifact the examples mention. If they are all accounted for, _don't_ show the modal.
      for (const widget of dashboard.widgets) {
        if (widget.kind !== WidgetKind.content) continue;
        const widgetArtifactPath = [currentNode.id, encodeArtifactPath(widget.childArtifactPath)].join("/");
        encodedArtifactPaths.delete(widgetArtifactPath);

        /// Also remove any sources the artifact references since those will also be covered.
        if (widget.showsContext) {
          const widgetArtifactNode = nodesByID.get(widgetArtifactPath)?.at(0);
          for (const source of widgetArtifactNode?.artifact?.sourceArtifactPaths ?? []) {
            encodedArtifactPaths.delete(encodeArtifactPath(source));
          }
        }
      }

      /// If even a single artifact is not represented by the dashboard, show the modal.
      return encodedArtifactPaths.size > 0;
    },
    [currentNode, dashboard, nodesByID, isDashboardLoading],
  );

  const { childArtifactKindDisplayName, canCreateChildArtifact } = useMemo(() => {
    const childArtifactPattern = (artifactSelector.artifactPath as ArtifactPathPattern).concat([{ kind: "artifact" }]);
    const childArtifactKindDisplayName = kindConfigurationForPattern(childArtifactPattern, "many").displayName;
    const canCreateChildArtifact = canCreateArtifactWithPattern(childArtifactPattern);
    return { childArtifactKindDisplayName, canCreateChildArtifact };
  }, [artifactSelector.artifactPath, kindConfigurationForPattern, canCreateArtifactWithPattern]);

  const createArtifact = useCallback(() => {
    router.push(`/app/${organizationSlug}/create/${encodeArtifactPath(artifactSelector.artifactPath)}`);
  }, [router, organizationSlug, artifactSelector]);

  const createTicket = useCallback(() => {
    const artifactTypeName = kindConfigurationForPattern(currentArtifactPath ?? [], "one").displayName;
    openLinearIssue({
      title: `Flagged Accuracy Issue AI quality issue – ${artifactTypeName}: ${artifactTitle || "artifact"}`,
      description: `There is a quality concern in [${artifactTypeName}: ${artifactTitle || "artifact"}](%url%). Please review and check if the model behavior needs adjustment.`,
    });
  }, [openLinearIssue, artifactTitle, currentArtifactPath, kindConfigurationForPattern]);

  const deleteArtifactNode = useCallback(
    async (node: ArtifactNode) => {
      if (!currentOrganization?.id || !node.artifact?.artifactPath) return;

      // 1. Navigate to parent before deletion
      const parentPath = node.artifact.artifactPath.slice(0, -1);
      if (parentPath.length > 0 && organizationSlug) {
        router.replace(`/app/${organizationSlug}/artifacts/${encodeArtifactPath(parentPath)}`);
      } else if (organizationSlug) {
        router.replace(`/app/${organizationSlug}/artifacts`);
      }

      // 2. Delete
      try {
        await fetchDeleteArtifact({
          orgID: currentOrganization.id,
          artifactPath: node.artifact.artifactPath,
          deleteSubartifacts: true,
        });

        // 3. Refresh
        await invalidateContentArtifacts(currentOrganization.id);
      } catch (error) {
        console.error("Couldn't delete artifact!", error);
      }
    },
    [currentOrganization, organizationSlug, router],
  );

  const promptDeleteNode = useCallback(
    (node: ArtifactNode) => {
      if (!node.artifact?.artifactPath) return;
      setCurrentSelection(node);
      setArtifactToDelete(node);
      setDeleteArtifactDialogOpen(true);
    },
    [setCurrentSelection, setDeleteArtifactDialogOpen],
  );

  const deleteCurrentArtifact = useCallback(async () => {
    if (!artifactToDelete) return;
    await deleteArtifactNode(artifactToDelete);
    setArtifactToDelete(null);
  }, [artifactToDelete, deleteArtifactNode]);

  const { previousArtifactPath, nextArtifactPath, canNavigateArtifacts } = useMemo(() => {
    const failValue = { previousArtifactPath: null, nextArtifactPath: null, canNavigateArtifacts: false };
    if (!currentArtifactPath || !currentNode || currentLocalID?.kind === "dataset") {
      return failValue;
    }

    const parentNode = currentNode.parent;
    if (!parentNode) return failValue;
    parentNode.orderChildren({
      sortDescriptors,
      activeEventSummaryID: lastEventSummaryID,
      metricDefinitionForID,
      kindConfigurationForPattern,
    });

    const orderedChildren =
      parentNode.orderedChildren.length > 0 ? parentNode.orderedChildren : Array.from(parentNode.children.values());
    const wantsPairs = currentNode.children.size > 0;
    const siblings = orderedChildren.filter(
      (child) => child.artifact && (wantsPairs ? child.children.size > 0 : child.children.size === 0),
    );
    if (siblings.length <= 1) {
      return failValue;
    }

    const currentIndex = siblings.findIndex((child) => child.id === currentNode.id);
    if (currentIndex === -1) {
      return failValue;
    }

    return {
      previousArtifactPath: siblings[currentIndex - 1]?.artifact?.artifactPath ?? null,
      nextArtifactPath: siblings[currentIndex + 1]?.artifact?.artifactPath ?? null,
      canNavigateArtifacts: true,
    };
  }, [
    currentArtifactPath,
    currentNode,
    currentLocalID?.kind,
    sortDescriptors,
    lastEventSummaryID,
    metricDefinitionForID,
    kindConfigurationForPattern,
  ]);

  const goToAdjacentArtifact = useCallback(
    (direction: "previous" | "next") => {
      const targetPath = direction === "previous" ? previousArtifactPath : nextArtifactPath;
      if (!targetPath || !organizationSlug) return;
      const encodedPath = encodeArtifactPath(targetPath);
      router.push(`/app/${organizationSlug}/artifacts/${encodedPath}${artifactSearchParams}`);
    },
    [previousArtifactPath, nextArtifactPath, organizationSlug, router, artifactSearchParams],
  );

  const lastPathComponent = useRef<HTMLDivElement>(null);
  const onScroll: ScrollHandler = useCallback((scrollOffset) => {
    if (lastPathComponent.current) {
      const offset = 28 - Math.min(28, Math.max(0, scrollOffset.y - 6));
      const opacity = Math.min(20, Math.max(0.001, scrollOffset.y - 14)) / 20;
      lastPathComponent.current.style.top = `${offset}px`;
      lastPathComponent.current.style.opacity = `${opacity}`;
    }
  }, []);

  const currentKindConfiguration = kindConfigurationForPattern(currentArtifactPath ?? [], "one");
  const kindTooltip = `See all ${currentKindConfiguration.otherNames.many ?? currentKindConfiguration.otherNames.other}`;
  const kindURL = `/app/${organizationSlug}/artifacts?kind=${encodeArtifactPathPattern(currentKindConfiguration.pattern)}`;

  const localIDDIsRawKind = currentKindConfiguration.displayName === currentLocalID?.kind;
  const localIDDIsRawID = currentKindConfiguration.displayName === currentLocalID?.id;

  const emptyState = useMemo(() => {
    if (!canCreateChildArtifact) return `No ${childArtifactKindDisplayName}`;
    return (
      <EmptyStateContainer>
        <Button size="large" prominence="secondary" action={createArtifact}>
          <ButtonContent>
            <Image src="/assets/adminPanel/upload-icon.svg" alt="Upload" width={20} height={20} />
            Upload {childArtifactKindDisplayName}
          </ButtonContent>
        </Button>
        <h3>Upload {childArtifactKindDisplayName} to be evaluated.</h3>
      </EmptyStateContainer>
    );
  }, [createArtifact, canCreateChildArtifact, childArtifactKindDisplayName]);

  return (
    <NavigationStack>
      <Toolbar>
        <ToolbarItem
          title={currentNavigationSidebarState === "open" ? "Hide Navigation" : "Show Navigation"}
          icon={
            currentNavigationSidebarState === "open"
              ? "adminPanel/left-Side-bar-icon-close"
              : "adminPanel/left-Side-bar-icon-open"
          }
          action={toggleNavigationSidebar}
          edge="leading"
          ignoresSidebar
        />
        <ToolbarItem title={currentKindConfiguration.displayName} edge="center">
          <ArtifactTitle>
            {currentLocalID ? (
              <>
                {currentLocalID.kind && !currentKindConfiguration.includesID ? ( // TODO: return the last pattern for the artifact (the loosest one)
                  <span>
                    <Link
                      href={kindURL}
                      title={kindTooltip}
                      style={localIDDIsRawKind ? { fontFamily: Font.monospace } : {}}
                    >
                      {currentKindConfiguration.displayName}
                    </Link>
                    {"  "}&#10217;{" "}
                  </span>
                ) : (
                  artifactTitle && (
                    <span>
                      <Link
                        href={kindURL}
                        title={kindTooltip}
                        style={localIDDIsRawID ? { fontFamily: Font.monospace } : {}}
                      >
                        {currentKindConfiguration.displayName}
                      </Link>
                      :{" "}
                    </span>
                  )
                )}
                {artifactTitle ? (
                  <span>{artifactTitle}</span>
                ) : (!currentLocalID.kind || currentKindConfiguration.includesID) && !localIDDIsRawID ? (
                  <Link
                    href={kindURL}
                    title={kindTooltip}
                    style={localIDDIsRawID ? { fontFamily: Font.monospace } : {}}
                  >
                    {currentKindConfiguration.displayName}
                  </Link>
                ) : (
                  <span style={{ fontFamily: Font.monospace }}>
                    {valueForKeyPath(currentLocalID.id, "truncated").display}
                  </span>
                )}
              </>
            ) : isLoading ? (
              "Loading…"
            ) : (
              "Unknown Artifact"
            )}
          </ArtifactTitle>
        </ToolbarItem>
        <ToolbarItem
          title={currentDetailsSidebarState === "open" ? "Hide Details" : "Show Details"}
          icon={
            currentDetailsSidebarState === "open" ? "adminPanel/Side-bar-icon-close" : "adminPanel/Side-bar-icon-open"
          }
          action={toggleDetailSidebar}
          edge="trailing"
          ignoresSidebar
        />
        {sidebarNode !== currentNode && currentDetailsSidebarState === "open" && (
          <ToolbarItem
            title="Show Current Artifact"
            icon="icon-navigate-up"
            action={resetNavigationHandler}
            edge="trailing"
            ignoresSidebar
          />
        )}
        <ToolbarItem title="Current Artifact Path" edge="leading">
          <PathContainer>
            <PathComponent>
              <Link href={`/app/${organizationSlug}/artifacts`}>Navigate</Link>
              <Chevron />
            </PathComponent>
            {currentArtifactPath?.map(({ kind, id }, index) => {
              const subPath = currentArtifactPath.slice(0, index + 1);
              const encodedSubPath = encodeArtifactPath(currentArtifactPath.slice(0, index + 1));
              const artifactTitle = nodesByID.get(encodedSubPath)?.at(0)?.valueForKeyPaths(["metadata.name"]).display;

              /// Make sure that when a title is available, the display name doesn't include the ID so we don't duplicate the meaning.
              const kindPattern: ArtifactPathPattern = (() => {
                if (artifactTitle && kind) {
                  return (subPath as ArtifactPathPattern).slice(0, -1).concat({ kind });
                }
                return subPath;
              })();

              const kindConfiguration = kindConfigurationForPattern(kindPattern, "one");
              const isRawKind = kindConfiguration.displayName === kind;
              const isRawID = kindConfiguration.displayName === id;

              const contents = (
                <>
                  {kind && !kindConfiguration.includesID ? (
                    <span>
                      <span style={isRawKind ? { fontFamily: Font.monospace } : {}}>
                        {kindConfiguration.displayName}
                      </span>
                      :{" "}
                    </span>
                  ) : (
                    artifactTitle && (
                      <span>
                        <span style={isRawID ? { fontFamily: Font.monospace } : {}}>
                          {kindConfiguration.displayName}
                        </span>
                        :{" "}
                      </span>
                    )
                  )}
                  {artifactTitle ? (
                    <span>{artifactTitle}</span>
                  ) : (!kind || kindConfiguration.includesID) && !isRawID ? (
                    <span>{kindConfiguration.displayName}</span>
                  ) : (
                    <span style={{ fontFamily: Font.monospace }}>{valueForKeyPath(id, "truncated").display}</span>
                  )}
                </>
              );

              return index === currentArtifactPath.length - 1 ? (
                <LastPathComponent key={encodedSubPath} ref={lastPathComponent}>
                  <span>{contents}</span>
                </LastPathComponent>
              ) : (
                <PathComponent key={encodedSubPath}>
                  <Link href={`/app/${organizationSlug}/artifacts/${encodedSubPath}`}>{contents}</Link>
                  <Chevron />
                </PathComponent>
              );
            })}
          </PathContainer>
        </ToolbarItem>
        <ToolbarItem title="Create ticket" action={createTicket} variant="primary" edge="trailing" />
        {canCreateChildArtifact && (
          <ToolbarItem
            title={`Upload ${childArtifactKindDisplayName}`}
            action={createArtifact}
            variant="default"
            edge="trailing"
          />
        )}
      </Toolbar>
      <NavigationSidebar sidebarState={navigationSidebarState} />
      <NavigationContent scrollsVertically onScroll={onScroll}>
        <DashboardRenderer
          dashboard={dashboard}
          currentNode={currentNode}
          artifactSelector={artifactSelector}
          activeEventSummaryID={lastEventSummaryID}
          nodes={null}
          nodesByID={nodesByID}
          currentSelectionState={currentSelectionState}
          selectedMetricsState={evaluationGroupID ? activeMetricsState : undefined}
          autoScrollToFirstHighlight={!!evaluationGroupID && activeMetrics.size > 0}
          organizationSlug={organizationSlug}
          metricDefinitionForID={metricDefinitionForID}
          metricColorForID={metricColorForID}
          kindConfigurationForPattern={kindConfigurationForPattern}
          emptyState={emptyState}
          showAnnotations={annotationVisibility !== "off"}
          pendingAnnotationSelection={pendingAnnotationSelection}
          activeAnnotationSelections={[...activeAnnotationSelectionsByID.values()]}
          onAnnotationSelection={handleAnnotationSelection}
          onDeleteArtifact={promptDeleteNode}
        />
        <ArtifactHeader>
          {showsArtifactContent && canNavigateArtifacts && (
            <ArtifactNavigation>
              <ArtifactNavigationButton
                size="small"
                isEnabled={previousArtifactPath !== null}
                action={() => goToAdjacentArtifact("previous")}
              >
                &lt;
              </ArtifactNavigationButton>
              <ArtifactNavigationButton
                size="small"
                isEnabled={nextArtifactPath !== null}
                action={() => goToAdjacentArtifact("next")}
              >
                &gt;
              </ArtifactNavigationButton>
            </ArtifactNavigation>
          )}
        </ArtifactHeader>
      </NavigationContent>
      <EvaluationDetailsSidebar
        resizeIdentifier="artifact-details"
        artifactNodeState={currentSelectionState}
        artifactSelector={artifactSelector}
        selectedMetricsState={activeMetricsState}
        sidebarState={detailSidebarState}
        metricDefinitionForID={metricDefinitionForID}
        metricColorForID={metricColorForID}
        evaluationGroupID={evaluationGroupID}
        annotationVisibilityState={annotationVisibilityState}
        pendingAnnotationSelection={pendingAnnotationSelection}
        onClearPendingAnnotationSelection={() => setPendingAnnotationSelection(null)}
        onAnnotationEditStart={handleAnnotationEditStart}
        onAnnotationEditEnd={handleAnnotationEditEnd}
      />
      <MetricsComparisonPanel
        organizationSlug={organizationSlug}
        nodesByID={nodesByID}
        selectedMetricsState={activeMetricsState}
        commonArtifactPath={sidebarNode?.artifact?.artifactPath ?? []}
        isEnabled={isMetricsComparisonModalEnabled}
        metricDefinitionForID={metricDefinitionForID}
        metricColorForID={metricColorForID}
        kindConfigurationForPattern={kindConfigurationForPattern}
      />
      <ConfirmationDialog
        isPresentedState={deleteArtifactDialogState}
        title="Delete Artifact?"
        message="Are you sure you want to delete this artifact? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={deleteCurrentArtifact}
      />
      <FeatureTipDialog
        localStorageKey="showAnnotationTip"
        title="Your first annotation"
        isPresentedState={annotationTipPresentedState}
        sections={[
          {
            heading: "Your data has been uploaded",
            body: "You can find all your datasets on the left menu bar",
          },
          {
            heading: "Select text to annotate",
            body: "Click at the start of any text, hold down, and drag to create your first annotation.",
          },
          {
            heading: "Track everything on the right",
            body: "Your annotation will show up on the right side panel.",
          },
        ]}
      />
    </NavigationStack>
  );
};
export default ArtifactContentsList;
