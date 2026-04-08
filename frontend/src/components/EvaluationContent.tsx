import Image from "next/image";
import { useRouter } from "next/navigation";
import { type MouseEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { css } from "styled-components";

import { useAccount } from "@/generated/serverEndpoints";
import {
  type ContentWidget,
  type Metric,
  type MetricDefinition,
  type MetricID,
  type MetricReview,
  MetricReviewValue,
  type Recipe,
  RecipeStepKind,
  RecipeStepOutputKind,
  WidgetKind,
} from "@/generated/serverTypes";

import { type StateObject, useBinding, useDerivedState, useReactiveState } from "@/library/StateObject";
import useLocalStorageStateObject from "@/library/useLocalStorageStateObject";
import { usePagination } from "@/library/usePagination";

import { ArtifactNode, latestSnapshotReviewsForArtifact } from "@/model/artifactNode";
import { modelNamesForEvaluationFromArtifacts } from "@/model/evaluationRunModels";
import { ItemNode, type SortDescriptor, sortItems } from "@/model/keyPath";
import { statusIconNameForValue, valueForMetricKeyPath } from "@/model/metrics";
import { type ReviewStatus, ReviewStatusLabels, reviewStatusForCounts } from "@/model/reviewStatus";

import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import { Pagination } from "@/components/pagination/Pagination";
import {
  Button,
  Color,
  Font,
  Size,
  Table,
  type TableActionHandler,
  type TableCellRenderer,
  type TableColumnDescriptor,
  type TableInteractionHandler,
  TableUserIntent,
} from "@/components/ui";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used as styled-components CSS selector
import { TruncatingText } from "@/components/ui/TruncatingText";
import { WidgetComponent } from "@/components/widgets";

import { fetchUpdateArtifactSnapshot } from "@/app/navigator/_shared/artifacts";
import {
  findAdjacentQuestion,
  findNextEligibleQuestion,
} from "@/app/navigator/[orgID]/evaluations/[id]/approvalNavigation.internal";
import { MetricIconSelection, TooltipPopup } from "@/app/navigator/[orgID]/evaluations/[id]/MetricIconSelection";

// MARK: - Styles

const TableContainer = styled.div`${() => css`
  position: relative;
  height: 100%;

  ${Table} {
    position: absolute;
    inset: 23px 20px 20px 20px;
  }

  th {
    background: ${Color.tableHeader};
    height: auto;
    padding: 8px 0;
  }

  thead tr {
    height: auto;
  }

  thead th > div {
    position: relative;
    inset: unset;
    height: auto;
    min-height: 29px;
  }

  thead th > div span {
    hyphens: none;
    word-break: normal;
  }

 tr:first-of-type td {
    background: ${Color.averages} !important;
  }

  td[data-alignment="center"] {
    text-align: center;
    ${TruncatingText} {
      -webkit-box-align: center;
      align-items: center;
    }
  }

  td[data-alignment="trailing"] {
    text-align: right;
    ${TruncatingText} {
      -webkit-box-align: end;
      align-items: flex-end;
    }
  }
`}`;

const EvaluationNavigation = styled.div`${() => css`
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 6px;
`}`;

const EvaluationNavigationButton = styled(Button)`${() => css`
  min-width: 30px;
  height: 32px;
  font-size: ${Size.fontSize.fontSize12};
  font-family: ${Font.inter};
  line-height: 1;
  padding: 0 6px;
`}`;

const ArtifactContainer = styled.div`${() => css`
  display: flex;
  flex-direction: row;
  gap: 20px;
  flex-grow: 1;
  height: 100%;
  padding: 0 20px;
`}`;

const WidgetContainer = styled.div`${() => css`
  display: flex;
  position: relative;
  box-sizing: border-box;
  flex-grow: 1;
  margin: -6px;
`}`;

const ContentColumn = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 0;
  min-width: 0;
`}`;

const QuestionWidgetContainer = styled.div`${() => css`
  display: flex;
  flex-direction: row;
  gap: 30px;
  height: auto;
  padding: 0 25px;
  margin: 20px 0 20px 0;
`}`;

const QuestionWidgetInner = styled.div`${() => css`
  margin: 10px 0;
  height: auto;
  position: relative;
  width: 100%;
  flex: 1;
  border: ${Size.line.thickness} solid ${Color.line};
  border-radius: 16px;
  background-color: ${Color.contentSurface};
`}`;

const QuestionHeader = styled.div`${() => css`
  background: ${Color.tableHeader};
  border-bottom: ${Size.line.thickness} solid ${Color.line};
  padding: 0px 20px;
  border-radius: 16px 16px 0 0;
  font-size: ${Size.fontSize.fontSize14};
  font-family: ${Font.inter};
  font-weight: 500;
  height: 40px;
  display: flex;
  align-items: center;
  color: black;
`}`;

const QuestionText = styled.p`${() => css`
  padding: 0px 20px;
  font-size: ${Size.fontSize.fontSize14};
  font-family: ${Font.inter};
  color: black;
`}`;

const ReviewWidgetInner = styled(QuestionWidgetInner)``;

const ReviewContainer = styled.div`${() => css`
  display: flex;
  justify-content: space-between;
  gap: 10px;
`}`;

const ReviewActions = styled.div`${() => css`
  display: flex;
  gap: 10px;
  padding: 12px 20px;
`}`;

const ReviewButton = styled(Button)<{ $variant: "approve" | "deny" | "na" | "ticket" }>`
  background-color: ${({ $variant }) => {
    if ($variant === "approve") return Color.buttonSuccess.background;
    if ($variant === "deny") return Color.buttonDeny.background;
    if ($variant === "ticket") return Color.buttonfilled.background;
    return Color.buttonNeutralFill.background;
  }};
  color: ${Color.evaluationButtonText};
  font-size: ${Size.fontSize.fontSize12};
  font-family: ${Font.inter};
  font-weight: 500;
  padding: 6px 10px;
  height: 32px;
  border: 1px solid ${({ $variant }) => {
    if ($variant === "approve") return Color.buttonSuccess.border;
    if ($variant === "deny") return Color.buttonDeny.border;
    if ($variant === "ticket") return Color.buttonfilled.border;
    return Color.buttonNeutralFill.border;
  }};
  &:not([disabled]):hover {
    background-color: ${({ $variant }) => {
      if ($variant === "approve") return Color.buttonSuccess.hover.background;
      if ($variant === "deny") return Color.buttonDeny.hover.background;
      if ($variant === "ticket") return Color.buttonfilled.hover.background;
      return Color.buttonNeutralFill.hover.background;
    }};
  }

  &:not([disabled]):active:hover {
    background-color: ${({ $variant }) => {
      if ($variant === "approve") return Color.buttonSuccess.active.background;
      if ($variant === "deny") return Color.buttonDeny.active.background;
      if ($variant === "ticket") return Color.buttonfilled.hover.background;
      return Color.buttonNeutralFill.active.background;
    }};
  }
`;
const NoWrapText = styled.span`${() => css`
  white-space: nowrap;
`}`;

const MetricHeader = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  flex-grow: 1;
  height: 100%;
  min-width: 0;
  max-width: 200px;
`}`;

const MetricHeaderText = styled.span`${() => css`
  display: block;
  min-width: 0;
`}`;

const MetricName = styled(MetricHeaderText)`${() => css`
  white-space: normal;
  word-break: normal;
  overflow-wrap: anywhere;
  min-height: 2.3em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`}`;

const MetricModelName = styled(MetricHeaderText)`${() => css`
  font-size: ${Size.fontSize.fontSize12};
  color: ${Color.mutedText};

`}`;

const SelectedMetricContainer = styled.div`${() => css`
  display: flex;
  flex-direction: column;
`}`;

const TableActionContainer = styled.div`${() => css`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;
  height: auto;
  gap: 12px;
  margin-right: 42px;
`}`;

const ExpandButton = styled.span`${() => css`
  background-color: ${Color.buttonPlain};
  border: 1px solid ${Color.line};
  height: 32px;
  width: 32px;
  position: relative;
  overflow: visible;
  cursor: pointer;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  border-radius: 20px;

  &:hover::after {
    content: attr(data-tooltip);
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    color: ${Color.textDark};
    outline: ${Size.line.thickness} solid ${Color.line};
    background-color: ${Color.contentSurface};
    border-radius: 4px;
    padding: 2px 8px 1px;
    font-size: ${Size.fontSize.fontSize12};
    font-weight: 400;
    white-space: nowrap;
    z-index: 1;
    pointer-events: none;
  }
`}`;

const HeaderIconButton = styled(ExpandButton)`${() => css`
  position: absolute;
  top: 24px;
  right: 14px;
  z-index: 5;
  background-color: transparent;
  border: 0;
`}`;

const Icon = styled.div<{ $iconPath: string; $collapsed?: boolean }>`${({ $iconPath }) => css`
  width: 12px;
  height: 12px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
  background-size: contain;
  background-image: url(${$iconPath});
  background-position: center;
  background-repeat: no-repeat;
`}`;

// MARK: - Types

type EvaluationContentProps = {
  selectedItemNodeState: StateObject<ItemNode | null>;
  isLoading: boolean;
  initialPage?: number;
  itemsPerPage?: number;
  artifacts: ArtifactNode[];
  metricDefinitions: MetricDefinition[];
  evaluationGroupID: string;
  recipes: Recipe[];
  canCreateTicket: boolean;
  createTicket: () => void;
  nodesByID: Map<string, ArtifactNode[]>;
  selectedMetricsState: StateObject<Map<MetricID, Metric>>;
  lastSelectedMetricsState: StateObject<MetricID[]>;
  modelDisplayNameForID?: Map<string, string>;
};

const defaultSortDescriptors: SortDescriptor[] = [
  { keyPaths: ["creationTimestamp.sortableDate"], order: "descending" },
];
const reviewStatusIconMap: Record<ReviewStatus, { src: string; alt: string }> = {
  [ReviewStatusLabels.reviewed]: {
    src: "/assets/adminPanel/reviewed-icon.svg",
    alt: "Reviewed",
  },
  [ReviewStatusLabels.inProgress]: {
    src: "/assets/adminPanel/review-in-progress-icon.svg",
    alt: "In Progress",
  },
  [ReviewStatusLabels.notStarted]: {
    src: "/assets/adminPanel/review-not-started-icon.svg",
    alt: "Not Started",
  },
};

const ReviewStatusIconContainer = styled.div`
  display: block;
  width: fit-content;
  padding: 6px;
`;

const reviewStatusTooltipMap: Record<ReviewStatus, string> = {
  [ReviewStatusLabels.reviewed]: "All metrics reviewed",
  [ReviewStatusLabels.inProgress]: "Review in progress",
  [ReviewStatusLabels.notStarted]: "Review not started",
};

const TOOLTIP_DELAY_MS = 500;

const ReviewStatusIcon = ({
  status,
  onShowTooltip,
  onHideTooltip,
}: {
  status: ReviewStatus;
  onShowTooltip: (el: HTMLElement, text: string) => void;
  onHideTooltip: () => void;
}) => {
  const icon = reviewStatusIconMap[status];
  const tooltipText = reviewStatusTooltipMap[status];
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleEnter = () => onShowTooltip(el, tooltipText);
    const handleLeave = () => onHideTooltip();
    el.addEventListener("mouseenter", handleEnter);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mouseenter", handleEnter);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, [onShowTooltip, onHideTooltip, tooltipText]);

  if (!icon) return null;

  return (
    <ReviewStatusIconContainer ref={containerRef}>
      <Image src={icon.src} alt={icon.alt} width={20} height={20} />
    </ReviewStatusIconContainer>
  );
};
export const EvaluationContent = ({
  selectedItemNodeState,
  isLoading,
  initialPage,
  itemsPerPage,
  artifacts,
  metricDefinitions,
  evaluationGroupID,
  recipes,
  canCreateTicket,
  createTicket,
  nodesByID,
  selectedMetricsState,
  lastSelectedMetricsState,
  modelDisplayNameForID,
}: EvaluationContentProps) => {
  const router = useRouter();
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const { response: accountResponse } = useAccount();
  const currentUserID = accountResponse?.user.id;
  const {
    currentOrganization,
    kindConfigurationForPattern,
    metricColorForID,
    metricDefinitionForID,
    organizationSlug,
  } = useContext(OrganizationContext);
  const [pendingScrollToSelection, setPendingScrollToSelection] = useState(false);
  const [tooltipState, setTooltipState] = useState<{ top: number; left: number; text: string } | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = useCallback((source: MouseEvent | HTMLElement, text: string) => {
    const rect =
      source instanceof HTMLElement
        ? source.getBoundingClientRect()
        : (source.currentTarget as HTMLElement).getBoundingClientRect();
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => {
      setTooltipState({ top: rect.bottom + 4, left: rect.left + rect.width / 2, text });
    }, TOOLTIP_DELAY_MS);
  }, []);

  const hideTooltip = useCallback(() => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setTooltipState(null);
  }, []);
  const [selectedMetrics] = useBinding(selectedMetricsState);
  const selectedArtifactNodeState = useDerivedState(selectedItemNodeState, {
    get(existingValue) {
      if (existingValue instanceof ArtifactNode) return existingValue;
      return null;
    },
    set(_, newValue) {
      return newValue;
    },
  });
  const [selectedArtifactNode] = useBinding(selectedArtifactNodeState);
  useReactiveState(selectedArtifactNodeState, () => {
    selectedMetricsState.wrappedValue = new Map();
  }, [selectedMetricsState]);
  const sortDescriptorsState = useLocalStorageStateObject<SortDescriptor[]>(
    `evaluationSortDescriptors-${evaluationGroupID}`,
    defaultSortDescriptors,
  );
  const [sortDescriptors] = useBinding(sortDescriptorsState);
  const selectedMetricID = selectedMetrics.size > 0 ? (selectedMetrics.keys().next().value ?? null) : null;
  const shouldAutoScrollToFirstHighlight = selectedMetrics.size > 0;
  const emptyStateMessage = isLoading ? "Loading Artifacts…" : "No Artifacts";
  const sortedMetricDefinitions = useMemo(
    () =>
      [...metricDefinitions].sort((lhs, rhs) => lhs.name.localeCompare(rhs.name, undefined, { sensitivity: "base" })),
    [metricDefinitions],
  );
  const orderedMetricIds = useMemo(
    () => sortedMetricDefinitions.map((definition) => definition.id),
    [sortedMetricDefinitions],
  );
  const averagesItemNodeID = "Detection rate per metric";
  const contentWidget: ContentWidget = {
    id: "",
    kind: WidgetKind.content,
    x: 0,
    y: 0,
    width: 12,
    height: 6,
    showsContext: true,
    childArtifactPath: [],
  };

  const selectArtifactNode = useCallback(
    (artifactNode: ArtifactNode, metric: Metric | null) => (event: MouseEvent) => {
      event.stopPropagation();

      if (event.detail > 1) {
        return;
      }

      if (
        selectedMetricsState.wrappedValue.has(metric?.id || "") &&
        selectedArtifactNodeState.wrappedValue === artifactNode
      ) {
        selectedArtifactNodeState.wrappedValue = null;
      } else if (metric) {
        // Measure icon position before state change (pre-render), so layout is unaffected by the panel opening.
        // Double-RAF ensures the scroll runs after React re-renders and the panel has opened.
        const scrollContainer = tableContainerRef.current?.querySelector<HTMLElement>(".evaluation-table");
        if (scrollContainer) {
          const containerRect = scrollContainer.getBoundingClientRect();
          const iconRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          const rowHeight = (event.currentTarget as HTMLElement).closest("tr")?.getBoundingClientRect().height ?? 40;
          const scrollTop = scrollContainer.scrollTop + (iconRect.top - containerRect.top) - 40 - rowHeight * 2;
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              tableContainerRef.current?.querySelector<HTMLElement>(".evaluation-table")?.scrollTo({ top: scrollTop });
            });
          });
        }

        selectedArtifactNodeState.wrappedValue = artifactNode;
        selectedMetricsState.wrappedValue = new Map([[metric.id, metric]]);
        lastSelectedMetricsState.wrappedValue = [metric.id];
      }
    },
    [lastSelectedMetricsState, selectedArtifactNodeState, selectedMetricsState],
  );

  const selectArtifactMetric = useCallback(
    (artifactNode: ArtifactNode, metricId: MetricID) => {
      const metric = artifactNode.metricForID({ id: metricId, activeEventSummaryID: null });
      if (!metric) return;
      selectedArtifactNodeState.wrappedValue = artifactNode;
      selectedMetricsState.wrappedValue = new Map([[metric.id, metric]]);
      lastSelectedMetricsState.wrappedValue = [metric.id];
      setPendingScrollToSelection(true);
    },
    [lastSelectedMetricsState, selectedArtifactNodeState, selectedMetricsState],
  );

  const navigateToArtifact: TableActionHandler = useCallback(
    (artifactNode) => {
      if (!organizationSlug) return;
      const url = new URL(`/app/${organizationSlug}/artifacts/${artifactNode.id}`, window.location.origin);
      url.searchParams.set("evaluationGroupID", evaluationGroupID);
      router.push(url.pathname + url.search);
    },
    [evaluationGroupID, organizationSlug, router],
  );

  const openSelectedArtifact = useCallback(() => {
    const selectedArtifactNode = selectedArtifactNodeState.wrappedValue;
    if (!selectedArtifactNode) return;
    navigateToArtifact(selectedArtifactNode);
  }, [navigateToArtifact, selectedArtifactNodeState]);

  const idColumnKeyPaths = useMemo(() => ["metadata.name", "id"], []);
  const overallScoreColumnKeyPaths = useMemo(() => ["overallScore"], []);
  const reviewStatusColumnKeyPaths = useMemo(() => ["reviewStatus"], []);
  const metricModelNameByID = useMemo(() => {
    const modelNameByMetricID = new Map<string, string>();

    for (const metricDefinition of metricDefinitions) {
      const artifactsForMetric = artifacts.flatMap((artifactNode) => {
        const artifact = artifactNode.artifact;
        if (!artifact) return [];
        const metric = artifact.metrics?.find((candidate) => candidate.id === metricDefinition.id);
        if (!metric) return [];
        return [{ metrics: [metric], generations: artifact.generations }];
      });

      const modelNames = modelNamesForEvaluationFromArtifacts({
        evaluationGroupID,
        artifacts: artifactsForMetric,
        modelDisplayNameForID,
      });
      if (modelNames.length === 0) continue;
      modelNameByMetricID.set(metricDefinition.id, modelNames.join(", "));
    }

    return modelNameByMetricID;
  }, [artifacts, evaluationGroupID, metricDefinitions, modelDisplayNameForID]);

  const columns = useMemo<TableColumnDescriptor[]>(() => {
    const hasFewMetricColumns = sortedMetricDefinitions.length < 5;
    const idColumnWidth = hasFewMetricColumns ? 250 : "auto";
    const summaryColumnWidth = hasFewMetricColumns ? "auto" : 100;

    return [
      {
        title: "",
        keyPaths: idColumnKeyPaths,
        width: idColumnWidth,
        stickyPosition: "left",
      },
      ...sortedMetricDefinitions.map((metricDefinition) => ({
        title: (
          <MetricHeader>
            <MetricName>{metricDefinition.name}</MetricName>
            <MetricModelName>{metricModelNameByID.get(metricDefinition.id) ?? ""}</MetricModelName>
          </MetricHeader>
        ),
        keyPaths: [`metrics.${metricDefinition.id}`],
        width: "auto",
        description: metricDefinition.description,
        alignment: "center" as const,
        textAlign: "left" as const,
      })),
      {
        title: "Detection rate per artifact",
        keyPaths: overallScoreColumnKeyPaths,
        width: summaryColumnWidth,
        stickyPosition: "right",
        alignment: "center" as const,
      },
      {
        title: "Human Review Progress",
        keyPaths: reviewStatusColumnKeyPaths,
        width: summaryColumnWidth,
        alignment: "center" as const,
      },
    ];
  }, [
    idColumnKeyPaths,
    sortedMetricDefinitions,
    metricModelNameByID,
    overallScoreColumnKeyPaths,
    reviewStatusColumnKeyPaths,
  ]);

  const interactionHandler: TableInteractionHandler = useCallback((itemNode) => {
    if (itemNode.id === averagesItemNodeID) {
      return TableUserIntent.disableInteraction;
    }
    return TableUserIntent.auto;
  }, []);

  const artifactsToOverallScore = useMemo(() => {
    const evaluationMetricIDs = new Set(metricDefinitions.map((def) => def.id));
    return new Map<ArtifactNode, number>(
      artifacts.map((artifact) => {
        const count =
          artifact.item?.metrics?.reduce((sum, metric) => {
            if (!evaluationMetricIDs.has(metric.id)) return sum;
            const rawValue = valueForMetricKeyPath({ metric, metricDefinitionForID, evaluationGroupID }).raw;
            return sum + (rawValue === true ? 1 : 0);
          }, 0) ?? 0;
        return [artifact, count];
      }),
    );
  }, [artifacts, evaluationGroupID, metricDefinitionForID, metricDefinitions]);

  const evaluationMetricDefinitionIDs = useMemo(
    () => new Set(metricDefinitions.map((metricDefinition) => metricDefinition.id)),
    [metricDefinitions],
  );

  const getReviewedMetricCount = useCallback(
    (artifactNode: ArtifactNode) => {
      const reviews = latestSnapshotReviewsForArtifact(artifactNode);

      const reviewedDefinitionIDs = Object.values(reviews).reduce((set, review) => {
        if (review.evaluationGroupId !== evaluationGroupID) return set;
        const metric = artifactNode.item?.metrics?.find((candidate) => candidate.id === review.metricId);
        if (!metric) return set;
        const metricDefinition = metricDefinitionForID(metric.id);
        if (!metricDefinition || !evaluationMetricDefinitionIDs.has(metricDefinition.id)) return set;
        set.add(metricDefinition.id);
        return set;
      }, new Set<string>());

      return reviewedDefinitionIDs.size;
    },
    [evaluationGroupID, evaluationMetricDefinitionIDs, metricDefinitionForID],
  );

  const sortedArtifacts = useMemo(
    () =>
      sortItems({
        items: Array.from(artifacts),
        sortDescriptors,
        metricDefinitionForID,
        sortValueForDescriptor: ({ item, descriptor }) => {
          const primaryKeyPath = descriptor.keyPaths[0];
          if (primaryKeyPath === "overallScore") {
            return artifactsToOverallScore.get(item) ?? 0;
          }
          if (primaryKeyPath === "reviewStatus") {
            const status = reviewStatusForCounts(getReviewedMetricCount(item), metricDefinitions.length);
            if (status === ReviewStatusLabels.notStarted) return 0;
            if (status === ReviewStatusLabels.inProgress) return 1;
            return 2;
          }
          return undefined;
        },
      }),
    [
      artifacts,
      artifactsToOverallScore,
      getReviewedMetricCount,
      metricDefinitionForID,
      metricDefinitions,
      sortDescriptors,
    ],
  );

  const getMetricReviewStatus = useCallback(
    (artifactNode: ArtifactNode, metricId: MetricID) => {
      const reviews = latestSnapshotReviewsForArtifact(artifactNode);
      for (const review of Object.values(reviews)) {
        if (review.metricId === metricId && review.evaluationGroupId === evaluationGroupID) return review.value;
      }
      return null;
    },
    [evaluationGroupID],
  );

  const metricIDToAverage = useMemo(() => {
    if (!artifacts.length) return new Map<Metric["id"], string>();
    const counts = artifacts.reduce((map, artifact) => {
      artifact.item?.metrics?.forEach((metric) => {
        const rawValue = valueForMetricKeyPath({ metric, metricDefinitionForID, evaluationGroupID }).raw;
        const isTrueValue = rawValue === true;
        map.set(metric.id, (map.get(metric.id) ?? 0) + Number(isTrueValue));
      });
      return map;
    }, new Map<Metric["id"], number>());
    return new Map(
      Array.from(counts.entries()).map(([metricID, count]) => [
        metricID,
        `${Math.round((count / artifacts.length) * 100)}%`,
      ]),
    );
  }, [artifacts, evaluationGroupID, metricDefinitionForID]);
  const pagination = usePagination({
    items: sortedArtifacts,
    isLoading,
    initialPage,
    itemsPerPage,
  });
  const { page, totalPages, paginatedItems, goToPage } = pagination;

  const displayedItemNodes = useMemo(() => {
    if (artifacts.length === 0) return [];
    const averagesRow = new ItemNode({
      id: averagesItemNodeID,
      item: {
        metrics: Object.fromEntries(
          sortedMetricDefinitions.map((metricDefinition) => [
            metricDefinition.id,
            metricIDToAverage.get(metricDefinition.id) ?? "",
          ]),
        ),
      },
    });
    return [averagesRow, ...paginatedItems];
  }, [artifacts.length, sortedMetricDefinitions, metricIDToAverage, paginatedItems]);

  const selectedMetricQuestion = useMemo(() => {
    if (selectedMetrics.size === 0) return null;

    const selectedMetricID = Array.from(selectedMetrics.keys())[0];

    for (const recipe of recipes) {
      for (const step of recipe.steps) {
        if (step.kind === RecipeStepKind.evaluate) {
          const hasMatchingOutput = step.outputs.some(
            (output) => output.kind === RecipeStepOutputKind.metric && output.output.metricID === selectedMetricID,
          );
          if (hasMatchingOutput) {
            return step.userPrompt;
          }
        }
      }
    }

    return null;
  }, [recipes, selectedMetrics]);

  const cellRenderer: TableCellRenderer = useCallback(
    (itemNode, column, openItemAction) => {
      if (column.keyPaths === idColumnKeyPaths) {
        if (itemNode.id === averagesItemNodeID) {
          return <NoWrapText>{averagesItemNodeID}</NoWrapText>;
        }
        return undefined;
      }
      if (column.keyPaths === overallScoreColumnKeyPaths) {
        if (itemNode.id === averagesItemNodeID) {
          return "";
        }
        const score = artifactsToOverallScore.get(itemNode as ArtifactNode) ?? 0;
        const totalMetrics = metricDefinitions.length;
        const percent = totalMetrics ? Math.round((score / totalMetrics) * 100) : null;
        return percent === null ? "" : <div className="darker">{`${percent}%`}</div>;
      }
      if (column.keyPaths === reviewStatusColumnKeyPaths) {
        if (!(itemNode instanceof ArtifactNode)) return "";

        const metricReviewed = getReviewedMetricCount(itemNode);
        const status = reviewStatusForCounts(metricReviewed, metricDefinitions.length);
        return <ReviewStatusIcon status={status} onShowTooltip={showTooltip} onHideTooltip={hideTooltip} />;
      }
      if (itemNode instanceof ArtifactNode) {
        const metricID = column.keyPaths[0].slice("metrics.".length);
        const metric = itemNode.metricForID({ id: metricID });
        const isSelected = metric && selectedMetrics.has(metric.id) && selectedArtifactNode?.id === itemNode.id;
        const reviewStatus = metric ? getMetricReviewStatus(itemNode, metric.id) : null;

        const metricValue = itemNode.valueForKeyPaths({
          keyPaths: column.keyPaths,
          metricDefinitionForID,
          evaluationGroupID,
        });
        const aiIconName = statusIconNameForValue(metricValue.raw);
        const aiLabel =
          aiIconName === "check"
            ? "AI Judge: Pass"
            : aiIconName === "dash"
              ? "AI Judge: Fail"
              : aiIconName === "warning"
                ? "AI Judge: Mixed"
                : null;
        const humanLabel =
          reviewStatus === MetricReviewValue.approved
            ? "Human Review: Approved"
            : reviewStatus === MetricReviewValue.denied
              ? "Human Review: Rejected"
              : reviewStatus === MetricReviewValue.not_applicable
                ? "Human Review: N/A"
                : null;
        const tooltip = [aiLabel, humanLabel].filter(Boolean).join("\n") || undefined;

        return (
          <MetricIconSelection
            onClick={selectArtifactNode(itemNode, metric)}
            onDoubleClick={openItemAction}
            data-selected={!!isSelected}
            data-selected-metric={isSelected ? "true" : undefined}
            data-review-status={reviewStatus ?? undefined}
            onMouseEnter={tooltip ? (e) => showTooltip(e, tooltip) : undefined}
            onMouseLeave={tooltip ? hideTooltip : undefined}
          >
            {metricValue.display ?? ""}
          </MetricIconSelection>
        );
      }

      return undefined;
    },
    [
      artifactsToOverallScore,
      evaluationGroupID,
      getMetricReviewStatus,
      getReviewedMetricCount,
      hideTooltip,
      idColumnKeyPaths,
      metricDefinitionForID,
      metricDefinitions.length,
      overallScoreColumnKeyPaths,
      reviewStatusColumnKeyPaths,
      selectArtifactNode,
      selectedArtifactNode,
      selectedMetrics,
      showTooltip,
    ],
  );

  const canNavigateToAdjacentQuestion = useCallback(
    (direction: "previous" | "next") => {
      if (!selectedArtifactNode || !selectedMetricID) return false;
      const artifactIndex = sortedArtifacts.findIndex((artifact) => artifact.id === selectedArtifactNode.id);
      const metricIndex = orderedMetricIds.indexOf(selectedMetricID);
      if (artifactIndex === -1 || metricIndex === -1) return false;
      return (
        findAdjacentQuestion(
          direction,
          artifactIndex,
          metricIndex,
          sortedArtifacts,
          orderedMetricIds,
          evaluationGroupID,
        ) !== null
      );
    },
    [evaluationGroupID, orderedMetricIds, selectedArtifactNode, selectedMetricID, sortedArtifacts],
  );

  const canGoToPreviousQuestion = useMemo(
    () => canNavigateToAdjacentQuestion("previous"),
    [canNavigateToAdjacentQuestion],
  );
  const canGoToNextQuestion = useMemo(() => canNavigateToAdjacentQuestion("next"), [canNavigateToAdjacentQuestion]);

  const advanceToNextEligible = useCallback(() => {
    const selectedArtifact = selectedArtifactNodeState.wrappedValue;
    const selectedMetricId = [...selectedMetricsState.wrappedValue.keys()][0];
    if (!selectedArtifact || !selectedMetricId) return;

    const artifactIndex = sortedArtifacts.findIndex((artifact) => artifact.id === selectedArtifact.id);
    const metricIndex = orderedMetricIds.indexOf(selectedMetricId);
    if (artifactIndex === -1 || metricIndex === -1) return;

    const result = findNextEligibleQuestion(
      artifactIndex,
      metricIndex,
      sortedArtifacts,
      orderedMetricIds,
      evaluationGroupID,
    );

    if (result) {
      selectArtifactMetric(result.artifactNode, result.metricId);
    } else {
      selectedArtifactNodeState.wrappedValue = null;
      selectedMetricsState.wrappedValue = new Map();
    }
  }, [
    evaluationGroupID,
    orderedMetricIds,
    selectArtifactMetric,
    selectedArtifactNodeState,
    selectedMetricsState,
    sortedArtifacts,
  ]);

  const goToAdjacentQuestion = useCallback(
    (direction: "previous" | "next") => {
      if (!selectedArtifactNode || !selectedMetricID) return;

      const artifactIndex = sortedArtifacts.findIndex((artifact) => artifact.id === selectedArtifactNode.id);
      const metricIndex = orderedMetricIds.indexOf(selectedMetricID);
      if (artifactIndex === -1 || metricIndex === -1) return;

      const result = findAdjacentQuestion(
        direction,
        artifactIndex,
        metricIndex,
        sortedArtifacts,
        orderedMetricIds,
        evaluationGroupID,
      );
      if (result) {
        selectArtifactMetric(result.artifactNode, result.metricId);
      }
    },
    [
      evaluationGroupID,
      orderedMetricIds,
      selectArtifactMetric,
      selectedArtifactNode,
      selectedMetricID,
      sortedArtifacts,
    ],
  );

  const handleMetricReview = useCallback(
    async (value: MetricReviewValue) => {
      const selectedArtifact = selectedArtifactNodeState.wrappedValue;
      const selectedMetric = Array.from(selectedMetricsState.wrappedValue.values())[0];
      const latestSnapshot = selectedArtifact?.artifact?.snapshots.at(-1);
      const artifactPath = selectedArtifact?.artifact?.artifactPath;

      if (
        !selectedArtifact ||
        !selectedMetric ||
        !latestSnapshot ||
        !latestSnapshot.eventSummaryID ||
        !artifactPath ||
        !currentOrganization?.id ||
        !currentUserID
      ) {
        return;
      }

      const existingReviews = latestSnapshot.reviews ?? {};
      const existingReviewEntry = Object.entries(existingReviews).find(
        ([, review]) => review.metricId === selectedMetric.id && review.evaluationGroupId === evaluationGroupID,
      );
      const timestamp = new Date().toISOString();
      let nextReviewId = crypto.randomUUID();
      let nextReview: MetricReview;

      if (existingReviewEntry) {
        const [reviewId, review] = existingReviewEntry;
        nextReviewId = reviewId;
        nextReview = {
          ...review,
          value,
        };
      } else {
        const recipeRunId = selectedMetric.values.findLast((recording) => recording.recipeRunID)?.recipeRunID;
        if (!recipeRunId) {
          console.warn("Unable to save review: missing recipe run id.");
          return;
        }
        nextReview = {
          id: nextReviewId,
          metricId: selectedMetric.id,
          recipeRunId,
          evaluationGroupId: evaluationGroupID,
          value,
          author: currentUserID,
          createdTimestamp: timestamp,
          modifiedTimestamp: timestamp,
        };
      }

      try {
        await fetchUpdateArtifactSnapshot({
          orgID: currentOrganization.id,
          artifactPath,
          eventSummaryID: latestSnapshot.eventSummaryID,
          snapshotDelta: {
            reviews: {
              [nextReviewId]: nextReview,
            },
          },
        });
        advanceToNextEligible();
      } catch (error) {
        console.error("Unable to save review", error);
      }
    },
    [
      advanceToNextEligible,
      currentOrganization?.id,
      currentUserID,
      evaluationGroupID,
      selectedArtifactNodeState,
      selectedMetricsState,
    ],
  );

  const scrollToSelectedMetric = useCallback(() => {
    if (!selectedMetricID) return false;

    const scrollContainer = tableContainerRef.current?.querySelector<HTMLElement>(".evaluation-table");
    if (!scrollContainer) return false;
    const selectedIcon = scrollContainer.querySelector<HTMLElement>('[data-selected-metric="true"]');
    if (!selectedIcon) return false;
    const containerRect = scrollContainer.getBoundingClientRect();

    // Account for sticky columns
    const stickyLeftInset = Array.from(
      scrollContainer.querySelectorAll<HTMLElement>('[data-sticky-column="left"]'),
    ).reduce((maxWidth, element) => Math.max(maxWidth, element.getBoundingClientRect().right - containerRect.left), 0);
    const stickyRightInset = Array.from(
      scrollContainer.querySelectorAll<HTMLElement>('[data-sticky-column="right"]'),
    ).reduce((maxWidth, element) => Math.max(maxWidth, containerRect.right - element.getBoundingClientRect().left), 0);

    // Determine visibility
    const visibleRect = {
      top: containerRect.top,
      bottom: containerRect.bottom,
      left: containerRect.left + stickyLeftInset,
      right: containerRect.right - stickyRightInset,
    };
    const iconRect = selectedIcon.getBoundingClientRect();
    const isVisible =
      iconRect.top >= visibleRect.top &&
      iconRect.bottom <= visibleRect.bottom &&
      iconRect.left >= visibleRect.left &&
      iconRect.right <= visibleRect.right;

    // If it's already visible, no-op
    if (isVisible) return true;

    // Compute scroll offsets
    // Use padding so the icon isn't flush against the edge
    const padding = 12;
    const currentScrollLeft = scrollContainer.scrollLeft;
    const currentScrollTop = scrollContainer.scrollTop;

    const deltaLeft = iconRect.left - visibleRect.left;
    const deltaRight = iconRect.right - visibleRect.right;
    const deltaTop = iconRect.top - visibleRect.top;
    const deltaBottom = iconRect.bottom - visibleRect.bottom;

    const nextScrollLeft = (() => {
      if (deltaLeft < padding) return currentScrollLeft + deltaLeft - padding;
      if (deltaRight > -padding) return currentScrollLeft + deltaRight + padding;
      return currentScrollLeft;
    })();

    const nextScrollTop = (() => {
      if (deltaTop < padding) return currentScrollTop + deltaTop - padding;
      if (deltaBottom > -padding) return currentScrollTop + deltaBottom + padding;
      return currentScrollTop;
    })();

    scrollContainer.scrollTo({ left: nextScrollLeft, top: nextScrollTop });
    return true;
  }, [selectedMetricID]);

  useEffect(() => {
    if (!pendingScrollToSelection) return;

    const raf = window.requestAnimationFrame(() => {
      if (scrollToSelectedMetric()) {
        setPendingScrollToSelection(false);
      }
    });

    return () => window.cancelAnimationFrame(raf);
  }, [pendingScrollToSelection, scrollToSelectedMetric]);

  return (
    <>
      <TableContainer ref={tableContainerRef}>
        <Table
          items={displayedItemNodes}
          columnsState={columns}
          selectionState={selectedItemNodeState}
          sortDescriptorsState={sortDescriptorsState}
          emptyStateComponent={emptyStateMessage}
          shouldNestItems={false}
          action={navigateToArtifact}
          interactionHandler={interactionHandler}
          cellRenderer={cellRenderer}
          className="evaluation-table"
        />
      </TableContainer>
      <TableActionContainer>
        {selectedMetricQuestion && (
          <ExpandButton
            onClick={() => {
              selectedMetricsState.wrappedValue = new Map();
              selectedArtifactNodeState.wrappedValue = null;
            }}
            data-tooltip={"Expand Metrics"}
          >
            <Icon $iconPath="/assets/adminPanel/expandIcon.svg" />
          </ExpandButton>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
          marginBottom={"0px"}
        />
      </TableActionContainer>

      {selectedMetricQuestion && (
        <SelectedMetricContainer>
          <QuestionWidgetContainer>
            <ContentColumn>
              <WidgetContainer>
                <QuestionWidgetInner>
                  <QuestionHeader>Metric Question</QuestionHeader>
                  <QuestionText>{selectedMetricQuestion}</QuestionText>
                </QuestionWidgetInner>
              </WidgetContainer>
            </ContentColumn>
            <ContentColumn>
              <WidgetContainer>
                <ReviewWidgetInner>
                  <QuestionHeader>Human-in-the-loop Review</QuestionHeader>
                  <ReviewContainer>
                    <ReviewActions>
                      <ReviewButton
                        $variant="approve"
                        prominence="primary"
                        action={() => handleMetricReview(MetricReviewValue.approved)}
                      >
                        Yes
                      </ReviewButton>
                      <ReviewButton
                        $variant="deny"
                        isDangerous
                        action={() => handleMetricReview(MetricReviewValue.denied)}
                      >
                        No
                      </ReviewButton>
                      <ReviewButton $variant="na" action={() => handleMetricReview(MetricReviewValue.not_applicable)}>
                        N/A
                      </ReviewButton>
                      {canCreateTicket && (
                        <ReviewButton $variant="ticket" action={() => createTicket()}>
                          Create Ticket
                        </ReviewButton>
                      )}
                    </ReviewActions>
                    <EvaluationNavigation>
                      <EvaluationNavigationButton
                        size="small"
                        isEnabled={canGoToPreviousQuestion}
                        action={() => goToAdjacentQuestion("previous")}
                      >
                        &lt;
                      </EvaluationNavigationButton>
                      <EvaluationNavigationButton
                        size="small"
                        isEnabled={canGoToNextQuestion}
                        action={() => goToAdjacentQuestion("next")}
                      >
                        &gt;
                      </EvaluationNavigationButton>
                    </EvaluationNavigation>
                  </ReviewContainer>
                </ReviewWidgetInner>
              </WidgetContainer>
            </ContentColumn>
          </QuestionWidgetContainer>
        </SelectedMetricContainer>
      )}
      {tooltipState &&
        createPortal(
          <TooltipPopup style={{ top: tooltipState.top, left: tooltipState.left }}>{tooltipState.text}</TooltipPopup>,
          document.body,
        )}
      {selectedArtifactNodeState.wrappedValue && (
        <ArtifactContainer>
          <ContentColumn>
            <WidgetContainer>
              <WidgetComponent
                widget={contentWidget}
                currentNode={selectedArtifactNodeState.wrappedValue?.children?.get("input") ?? null}
                artifactSelector={null}
                activeEventSummaryID={null}
                nodes={null}
                nodesByID={nodesByID}
                currentSelectionState={undefined}
                selectedMetricsState={selectedMetricsState}
                commonArtifactPath={selectedArtifactNodeState.wrappedValue?.artifact?.artifactPath}
                organizationSlug={null}
                metricDefinitionForID={metricDefinitionForID}
                metricColorForID={metricColorForID}
                kindConfigurationForPattern={kindConfigurationForPattern}
                autoScrollToFirstHighlight={shouldAutoScrollToFirstHighlight}
              />
            </WidgetContainer>
          </ContentColumn>
          <ContentColumn>
            <WidgetContainer>
              <HeaderIconButton onClick={openSelectedArtifact} data-tooltip="Open Artifact">
                <Icon $iconPath="/assets/adminPanel/expandIcon.svg" />
              </HeaderIconButton>
              <WidgetComponent
                widget={contentWidget}
                currentNode={selectedArtifactNodeState.wrappedValue?.children?.get("output") ?? null}
                artifactSelector={null}
                activeEventSummaryID={null}
                nodes={null}
                nodesByID={nodesByID}
                currentSelectionState={undefined}
                selectedMetricsState={selectedMetricsState}
                commonArtifactPath={selectedArtifactNodeState.wrappedValue?.artifact?.artifactPath}
                organizationSlug={null}
                metricDefinitionForID={metricDefinitionForID}
                metricColorForID={metricColorForID}
                kindConfigurationForPattern={kindConfigurationForPattern}
                autoScrollToFirstHighlight={shouldAutoScrollToFirstHighlight}
              />
            </WidgetContainer>
          </ContentColumn>
        </ArtifactContainer>
      )}
    </>
  );
};
