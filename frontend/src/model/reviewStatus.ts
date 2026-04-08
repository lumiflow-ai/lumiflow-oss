export const ReviewStatusLabels = {
  notStarted: "Not started",
  inProgress: "In progress",
  reviewed: "Reviewed",
} as const;

export type ReviewStatus = (typeof ReviewStatusLabels)[keyof typeof ReviewStatusLabels];

export const reviewStatusForCounts = (reviewedCount: number, totalCount: number): ReviewStatus => {
  if (totalCount <= 0 || reviewedCount <= 0) {
    return ReviewStatusLabels.notStarted;
  }
  if (reviewedCount < totalCount) {
    return ReviewStatusLabels.inProgress;
  }
  return ReviewStatusLabels.reviewed;
};
