import Link from "next/link";
import { type ReactNode, useCallback, useContext, useMemo } from "react";
import styled, { createGlobalStyle, css } from "styled-components";

import {
  type EvaluationGroupID,
  type MetricDefinition,
  type MetricReview,
  MetricReviewValue,
  type PrimitiveValue,
  type Recipe,
  RecipeStepKind,
  RecipeStepOutputKind,
} from "@/generated/serverTypes";

import { type ArtifactNode, latestSnapshotReviewsForArtifact } from "@/model/artifactNode";
import type { Evaluation } from "@/model/evaluation";
import { modelNamesForEvaluationFromArtifacts } from "@/model/evaluationRunModels";
import { ItemNode, type SortDescriptor, sortItems } from "@/model/keyPath";
import { statusIconNameForValue, valueForMetricKeyPath } from "@/model/metrics";
import { type ReviewStatus, ReviewStatusLabels, reviewStatusForCounts } from "@/model/reviewStatus";

import { type KindConfigurationLookup, OrganizationContext } from "@/components/contexts/OrganizationContext";
import {
  BasePill,
  Button,
  Color,
  Size,
  StatusIcon,
  Table,
  type TableCellRenderer,
  type TableColumnDescriptor,
} from "@/components/ui";

/* Types */

type ReportPill = ReturnType<typeof reviewLabelForValue>;
type ReportRow = {
  question: string;
  aiRaw: PrimitiveValue;
  aiDisplay: ReactNode;
  reviewers: ReportPill[];
  isTotalsRow?: boolean;
};

type SummaryRow = {
  total: number;
  notStarted: number;
  inProgress: number;
  reviewed: number;
};

/* Helper Functions */

const reviewerLabelForID = (reviewerID: string, index: number, reviewerNameByID?: Map<string, string>) => {
  const name = reviewerNameByID?.get(reviewerID)?.trim();
  return name ? name : `Reviewer ${index + 1}`;
};

const statusIconSrc = (iconName: string) => `/assets/status-${iconName}.svg`;

const aiDisplayForValue = (value: PrimitiveValue, display: ReactNode) => {
  const iconName = statusIconNameForValue(value);
  if (iconName) {
    return (
      // force icon to render for printing
      <StatusIconWrapper>
        <ScreenStatusIcon icon={iconName} />
        <PrintStatusIcon src={statusIconSrc(iconName)} alt="" aria-hidden="true" />
      </StatusIconWrapper>
    );
  }
  if (display !== null && display !== undefined) return display;
  return "";
};

const reviewLabelForValue = (value: MetricReviewValue | null) => {
  if (!value) return { label: "-", tone: "neutral" as const };
  if (value === MetricReviewValue.approved) return { label: "Yes", tone: "positive" as const };
  if (value === MetricReviewValue.denied) return { label: "No", tone: "negative" as const };
  return { label: "N/A", tone: "neutral" as const };
};

const getLatestReviewByAuthor = (reviews: MetricReview[], authorID: string) => {
  const matching = reviews.filter((review) => review.author === authorID);
  if (matching.length === 0) return null;
  return matching.reduce((latest, review) => {
    if (!latest) return review;
    return review.modifiedTimestamp > latest.modifiedTimestamp ? review : latest;
  }, matching[0] ?? null);
};

const creationDateSortDescriptors: SortDescriptor[] = [
  { keyPaths: ["creationTimestamp.sortableDate"], order: "descending" },
];

/* Styled Components */

const PrintStyles = createGlobalStyle`
  @media print {
    @page {
      margin: 6mm;
      size: auto;
    }

    html,
    body {
      background: white;
      margin: 0;
      width: 100%;
      height: auto !important;
      overflow: visible !important;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    body * {
      visibility: hidden !important;
    }

    .evaluation-report-print,
    .evaluation-report-print * {
      visibility: visible !important;
    }

    .evaluation-report-print {
      position: static !important;
      inset: auto !important;
      width: 100% !important;
      max-width: none !important;
      height: auto;
      max-height: none !important;
      overflow: visible !important;
      margin: 0 !important;
      transform: none !important;
    }

    *:has(.evaluation-report-print) {
      position: static !important;
      inset: auto !important;
      width: 100% !important;
      max-width: none !important;
      overflow: visible !important;
      max-height: none !important;
      height: auto !important;
      transform: none !important;
    }

    .evaluation-report-print * {
      overflow: visible !important;
      max-height: none !important;
    }
  }
`;

const ReportContainer = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: ${Color.contentSurface};
  border-radius: 24px;
  overflow: hidden;

  @media print {
    height: auto;
    border-radius: 0;
    overflow: visible;
  }
`}`;

const ReportHeader = styled.div`${() => css`
  padding: 24px;
  color: ${Color.emphasizedText};
  border-bottom: ${Size.line.thickness} solid ${Color.line};

  @media print {
    padding: 12px 8px;
  }
`}`;

const ReportHeaderRow = styled.div`${() => css`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
`}`;

const ReportHeaderMeta = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: 5px;
`}`;

const ReportTitle = styled.h2`${() => css`
  margin: 0;
  font-size: ${Size.fontSize.fontSize20};
  font-weight: 500;
`}`;

const ReportDateLabel = styled.div`${() => css`
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 500;
  line-height: 1.2;
  color: ${Color.textDark};
  border-radius: 6px;
`}`;

const ReportDate = styled.span`${() => css`
  color: ${Color.mutedText};
`}`;

const ReportModelLabel = styled.div`${() => css`
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 500;
  line-height: 1.2;
  color: ${Color.textDark};
  border-radius: 6px;
`}`;

const ReportModel = styled.span`${() => css`
  color: ${Color.mutedText};
`}`;

const PrintButton = styled(Button)`${() => css`
  display: flex;
  align-items: center;
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 500;
  background: ${Color.buttonfilled.background};
  padding: 10px 12px;
  border-radius: 12px;
  color: ${Color.buttonfilled.text};
  margin-right: 30px;

  &:not([disabled]):hover {
    background: ${Color.buttonfilled.hover.background};
    color: ${Color.buttonfilled.hover.text};
  }

  &:not([disabled]):active:hover {
    background: ${Color.buttonfilled.hover.background};
  }

  @media print {
    display: none;
  }

  
`}`;

const ReportBody = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  overflow: auto;


  @media print {
    padding: 12px 8px;
    overflow: visible;
  }
`}`;

const SectionTitle = styled.h3`${() => css`
  margin: 0;
  font-size: ${Size.fontSize.fontSize16};
  color: ${Color.emphasizedText};
  margin-bottom: 20px;
`}`;

const ResultsList = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  gap: 18px;
`}`;

const ResultCard = styled.div`${() => css`
   border: ${Size.line.thickness} solid ${Color.line};
  border-radius: 16px;
  background: ${Color.buttonfilled.background};
  overflow: hidden;

  @media print {
    break-inside: avoid;
    page-break-inside: avoid;
  }
`}`;

const ResultHeader = styled.div`${() => css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  font-weight: 500;
  background: ${Color.tableHeader};
  color: ${Color.textDark};
  font-size: ${Size.fontSize.fontSize14};

  @media print {
    break-after: avoid;
    page-break-after: avoid;
  }
`}`;

const ArtifactLink = styled(Link)`${() => css`
  color: inherit;
  text-decoration: underline;

  &:hover {
    text-decoration-thickness: 2px;
  }
`}`;

const StatusPill = styled(BasePill)<{ $status: ReviewStatus }>`
  border-radius: 8px;
  font-size: ${Size.fontSize.fontSize12};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${Color.textDark};
  font-weight: 400;
  background-color: ${({ $status }) => {
    if ($status === ReviewStatusLabels.inProgress) {
      return Color.statusProgress;
    }
    if ($status === ReviewStatusLabels.reviewed) {
      return Color.statusSuccess;
    }
    return Color.tableHeader;
  }};
`;

const StatusIconWrapper = styled.span`${() => css`
  display: inline-flex;
  align-items: center;
`}`;

const ScreenStatusIcon = styled(StatusIcon)`${() => css`
  @media print {
    display: none;
  }
`}`;

const PrintStatusIcon = styled.img`${() => css`
  display: none;
  width: 19px;
  height: 19px;

  @media print {
    display: block;
  }
`}`;

const SummaryTable = styled.div`${() => css`
  width: 100%;

  ${ReportTable} th {
    background: ${Color.tableHeader};
  }
`}`;

const ReportTable = styled(Table)`${() => css`
  th {
    background: ${Color.averages};
  }

  @media print {
    overflow: visible !important;
    max-height: none !important;

    table {
      table-layout: fixed !important;
      width: 100% !important;
    }

    thead {
      position: static !important;
    }

    th,
    td {
      white-space: normal !important;
      word-break: break-word;
      min-width: 0 !important;
      width: auto !important;
      padding: 0px 8px !important;
      font-size: ${Size.fontSize.fontSize12} !important;
    }

    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    th[data-sticky-column],
    td[data-sticky-column] {
      position: static !important;
    }
  }
`}`;

const ResultPill = styled(BasePill)<{ $tone: "positive" | "negative" | "neutral" }>`
  background: ${({ $tone }) => {
    if ($tone === "positive") return "rgba(20, 131, 59, 0.12)";
    if ($tone === "negative") return "rgba(194, 30, 30, 0.12)";
    return "rgba(148, 163, 184, 0.2)";
  }};
  color: ${({ $tone }) => {
    if ($tone === "positive") return "#14833b";
    if ($tone === "negative") return "#c21e1e";
    return "#475569";
  }};
`;

const AiAnswerButton = styled.button`${() => css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
`}`;

/* Main Component */

export const EvaluationReport = ({
  evaluation,
  artifacts,
  metricDefinitions,
  metricDefinitionForID,
  kindConfigurationForPattern,
  evaluationGroupID,
  modelDisplayNameForID,
  reviewerNameByID,
  recipes,
  hideHeader,
  onSelectMetric,
}: {
  evaluation?: Evaluation;
  artifacts: ArtifactNode[];
  metricDefinitions: MetricDefinition[];
  metricDefinitionForID: (id: string) => MetricDefinition | null;
  kindConfigurationForPattern: KindConfigurationLookup;
  evaluationGroupID: EvaluationGroupID;
  modelDisplayNameForID?: Map<string, string>;
  reviewerNameByID?: Map<string, string>;
  recipes?: Recipe[];
  hideHeader?: boolean;
  onSelectMetric?: (artifact: ArtifactNode, metricID: string) => void;
}) => {
  const { organizationSlug } = useContext(OrganizationContext);
  const safeRecipes = recipes ?? [];

  const questionForMetricID = useCallback(
    (metricID: string) => {
      for (const recipe of safeRecipes) {
        for (const step of recipe.steps) {
          if (step.kind === RecipeStepKind.evaluate) {
            const hasMatchingOutput = step.outputs.some(
              (output) => output.kind === RecipeStepOutputKind.metric && output.output.metricID === metricID,
            );
            if (hasMatchingOutput) return step.userPrompt;
          }
        }
      }
      return null;
    },
    [safeRecipes],
  );
  const generatedAt = useMemo(() => new Date(), []);
  const handlePrint = useCallback(() => {
    window.print();
  }, []);
  const artifactRuns = useMemo(
    () => artifacts.flatMap((artifactNode) => (artifactNode.artifact ? [artifactNode.artifact] : [])),
    [artifacts],
  );
  const evaluationModelName = useMemo(() => {
    const modelNames = modelNamesForEvaluationFromArtifacts({
      evaluationGroupID,
      artifacts: artifactRuns,
      modelDisplayNameForID,
    });
    return modelNames.length > 0 ? modelNames.join(", ") : null;
  }, [artifactRuns, evaluationGroupID, modelDisplayNameForID]);

  const evaluationMetricIDs = useMemo(
    () => new Set(metricDefinitions.map((metricDefinition) => metricDefinition.id)),
    [metricDefinitions],
  );

  const sortedArtifacts = useMemo(
    () =>
      sortItems({ items: Array.from(artifacts), sortDescriptors: creationDateSortDescriptors, metricDefinitionForID }),
    [artifacts, metricDefinitionForID],
  );

  const isReviewForEvaluation = useCallback(
    (review: MetricReview) =>
      evaluationMetricIDs.has(review.metricId) && review.evaluationGroupId === evaluationGroupID,
    [evaluationMetricIDs, evaluationGroupID],
  );

  const reviewers = useMemo(() => {
    const reviewerIDs = new Set<string>();
    artifacts.forEach((artifact) => {
      const reviews = latestSnapshotReviewsForArtifact(artifact);
      Object.values(reviews).forEach((review) => {
        if (isReviewForEvaluation(review)) reviewerIDs.add(review.author);
      });
    });
    return Array.from(reviewerIDs).sort((lhs, rhs) => lhs.localeCompare(rhs));
  }, [artifacts, isReviewForEvaluation]);

  const statusByArtifact = useMemo(() => {
    return new Map(
      artifacts.map((artifact) => {
        const reviews = Object.values(latestSnapshotReviewsForArtifact(artifact)).filter(isReviewForEvaluation);
        const reviewedMetricIDs = new Set(reviews.map((review) => review.metricId));
        const status = reviewStatusForCounts(reviewedMetricIDs.size, evaluationMetricIDs.size);
        return [artifact, status] as const;
      }),
    );
  }, [artifacts, evaluationMetricIDs, isReviewForEvaluation]);

  const summaryCounts = useMemo(() => {
    const counts = { notStarted: 0, inProgress: 0, reviewed: 0 };
    statusByArtifact.forEach((status) => {
      if (status === ReviewStatusLabels.notStarted) counts.notStarted += 1;
      if (status === ReviewStatusLabels.inProgress) counts.inProgress += 1;
      if (status === ReviewStatusLabels.reviewed) counts.reviewed += 1;
    });
    return counts;
  }, [statusByArtifact]);

  return (
    <>
      <PrintStyles />
      <ReportContainer className="evaluation-report-print">
        <ReportHeader>
          {hideHeader && (
            <ReportHeaderRow>
              <ReportHeaderMeta>
                <ReportTitle>Evaluation: {evaluation?.name}</ReportTitle>
                <ReportDateLabel>
                  Report Generated On:{" "}
                  <ReportDate>
                    {generatedAt.toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </ReportDate>
                </ReportDateLabel>
                {evaluation?.creationTimestamp ? (
                  <ReportDateLabel>
                    Evaluation Ran On:{" "}
                    <ReportDate>
                      {evaluation.creationTimestamp.toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </ReportDate>
                  </ReportDateLabel>
                ) : null}
                {evaluationModelName ? (
                  <ReportModelLabel>
                    Evaluation Model: <ReportModel>{evaluationModelName}</ReportModel>
                  </ReportModelLabel>
                ) : null}
              </ReportHeaderMeta>
              <PrintButton action={handlePrint}>Export Report</PrintButton>
            </ReportHeaderRow>
          )}
        </ReportHeader>
        <ReportBody>
          <section>
            <SectionTitle>Summary</SectionTitle>
            <SummaryTable>
              <ReportTable
                items={[
                  new ItemNode<SummaryRow>({
                    id: "summary",
                    item: {
                      total: artifacts.length,
                      notStarted: summaryCounts.notStarted,
                      inProgress: summaryCounts.inProgress,
                      reviewed: summaryCounts.reviewed,
                    },
                  }),
                ]}
                columnsState={[
                  { title: "Total artifacts", keyPaths: ["total"] },
                  { title: "Human Review Not Started", keyPaths: ["notStarted"] },
                  { title: "Human Review In Progress", keyPaths: ["inProgress"] },
                  { title: ReviewStatusLabels.reviewed, keyPaths: ["reviewed"] },
                ]}
                shouldNestItems={false}
              />
            </SummaryTable>
          </section>

          <section>
            <SectionTitle>Detailed Results</SectionTitle>
            <ResultsList>
              {sortedArtifacts.map((artifact) => {
                const artifactName = artifact.valueForKeyPaths({
                  keyPaths: ["metadata.name", "id"],
                  activeEventSummaryID: null,
                  metricDefinitionForID,
                  kindConfigurationForPattern,
                }).display;
                const artifactSubtitle = artifact.valueForKeyPaths({
                  keyPaths: ["metadata.title", "metadata.description"],
                  activeEventSummaryID: null,
                  metricDefinitionForID,
                  kindConfigurationForPattern,
                }).display;
                const resolvedName = typeof artifactName === "string" ? artifactName : artifact.id;
                const _resolvedSubtitle = typeof artifactSubtitle === "string" ? artifactSubtitle : null;
                const status = statusByArtifact.get(artifact) ?? ReviewStatusLabels.notStarted;
                const snapshotReviews = Object.values(latestSnapshotReviewsForArtifact(artifact)).filter(
                  isReviewForEvaluation,
                );
                const reviewsByMetric = snapshotReviews.reduce((map, review) => {
                  const metricReviews = map.get(review.metricId) ?? [];
                  metricReviews.push(review);
                  map.set(review.metricId, metricReviews);
                  return map;
                }, new Map<string, MetricReview[]>());

                const orderedMetricDefinitions = [...metricDefinitions].sort((lhs, rhs) => {
                  const lhsOrder = lhs.order ?? "";
                  const rhsOrder = rhs.order ?? "";
                  if (lhsOrder !== rhsOrder) return lhsOrder.localeCompare(rhsOrder);
                  return lhs.name.localeCompare(rhs.name);
                });
                const rows: ItemNode<ReportRow>[] = orderedMetricDefinitions
                  .map((metricDefinition) => {
                    const metric = artifact.item?.metrics?.find((candidate) => candidate.id === metricDefinition.id);
                    const metricValue = metric
                      ? valueForMetricKeyPath({ metric, metricDefinitionForID, evaluationGroupID })
                      : null;
                    const aiRaw = metricValue?.raw ?? null;
                    const aiDisplay = aiDisplayForValue(aiRaw, metricValue?.display ?? null);
                    const metricReviews = reviewsByMetric.get(metricDefinition.id) ?? [];
                    const reviewerLabels = reviewers.map((reviewerID) => {
                      const review = getLatestReviewByAuthor(metricReviews, reviewerID);
                      return reviewLabelForValue(review?.value ?? null);
                    });
                    return new ItemNode<ReportRow>({
                      id: metricDefinition.id,
                      item: {
                        question:
                          questionForMetricID(metricDefinition.id) ??
                          metricDefinition.description ??
                          metricDefinition.name,

                        aiRaw,
                        aiDisplay,
                        reviewers: reviewerLabels,
                      },
                    });
                  })
                  .sort((lhs, rhs) =>
                    lhs.item.question.localeCompare(rhs.item.question, undefined, { sensitivity: "base" }),
                  );

                const aiYesCount = rows.filter((row) => row.item.aiRaw === true).length;

                const reviewerYesCounts = reviewers.map(
                  (_, i) => rows.filter((row) => row.item.reviewers[i]?.label === "Yes").length,
                );

                const totalsRow = new ItemNode<ReportRow>({
                  id: "totals",
                  item: {
                    question: "Totals",
                    aiRaw: null,
                    aiDisplay: null,
                    reviewers: [],
                    isTotalsRow: true,
                  },
                });

                const allRows = [...rows, totalsRow] as ItemNode[];

                const columns: TableColumnDescriptor[] = [
                  { title: "Question", keyPaths: ["question"], width: "auto" },
                  { title: "AI Answer", keyPaths: ["ai"], width: 120 },
                  ...reviewers.map((reviewerID, index) => ({
                    title: reviewerLabelForID(reviewerID, index, reviewerNameByID),
                    keyPaths: [`reviewers.${index}`],
                    width: 120,
                  })),
                ];

                const cellRenderer: TableCellRenderer = (itemNode, column) => {
                  const reportNode = itemNode as ItemNode<ReportRow>;
                  const key = column.keyPaths[0] ?? "";
                  if (reportNode.item.isTotalsRow) {
                    if (key === "question") return <strong>Totals</strong>;
                    if (key === "ai") return <ResultPill $tone="positive">Yes: {aiYesCount}</ResultPill>;
                    if (key.startsWith("reviewers.")) {
                      const index = Number(key.slice("reviewers.".length));
                      const count = reviewerYesCounts[index] ?? 0;
                      return <ResultPill $tone="positive">Yes: {count}</ResultPill>;
                    }
                    return "";
                  }
                  if (key === "ai") {
                    if (onSelectMetric) {
                      return (
                        <AiAnswerButton type="button" onClick={() => onSelectMetric(artifact, reportNode.id)}>
                          {reportNode.item.aiDisplay}
                        </AiAnswerButton>
                      );
                    }
                    return reportNode.item.aiDisplay;
                  }
                  if (key.startsWith("reviewers.")) {
                    const index = Number(key.slice("reviewers.".length));
                    const reviewer = reportNode.item.reviewers[index];
                    if (!reviewer || reviewer.label === "-") return "";
                    return <ResultPill $tone={reviewer.tone}>{reviewer.label}</ResultPill>;
                  }
                  return undefined;
                };

                return (
                  <ResultCard key={artifact.id}>
                    <ResultHeader>
                      {organizationSlug ? (
                        <ArtifactLink
                          href={`/app/${organizationSlug}/artifacts/${artifact.id}?evaluationGroupID=${evaluationGroupID}`}
                        >
                          {resolvedName}
                        </ArtifactLink>
                      ) : (
                        resolvedName
                      )}
                      <StatusPill $status={status}>{status}</StatusPill>
                    </ResultHeader>
                    <ReportTable
                      style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
                      items={allRows}
                      columnsState={columns}
                      shouldNestItems={false}
                      cellRenderer={cellRenderer}
                    />
                  </ResultCard>
                );
              })}
            </ResultsList>
          </section>
        </ReportBody>
      </ReportContainer>
    </>
  );
};

EvaluationReport.displayName = "EvaluationReport";
