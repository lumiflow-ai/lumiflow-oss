import { describe, expect, it } from "vitest";

import { __visibleForTesting as cancelEvaluationVisibleForTesting } from "./cancelEvaluation";
import { __visibleForTesting as loadRecipesVisibleForTesting } from "./loadRecipes";

const {
  cancelledEvaluationRun,
  cancellationEvaluationRunID,
  cancellationEvaluationRunIDPrefix,
  shouldPersistCancellationRecord,
} = cancelEvaluationVisibleForTesting;
const { collectCancelledEvaluationGroupIDs } = loadRecipesVisibleForTesting;

describe("cancelledEvaluationRun", () => {
  it("builds a dedicated cancellation record for one evaluation group", () => {
    expect(cancelledEvaluationRun("eval-123")).toEqual({
      evaluationGroupID: "eval-123",
      status: "cancelled",
    });
  });

  it("uses a dedicated evaluation_run_id namespace for cancellation records", () => {
    expect(cancellationEvaluationRunID("eval-123")).toEqual(`${cancellationEvaluationRunIDPrefix}eval-123`);
  });

  it("only persists a cancellation record when active jobs were actually cancelled", () => {
    expect(shouldPersistCancellationRecord(0)).toBe(false);
    expect(shouldPersistCancellationRecord(1)).toBe(true);
  });
});

describe("collectCancelledEvaluationGroupIDs", () => {
  it("returns cancelled evaluation groups from dedicated cancellation records", () => {
    expect(
      collectCancelledEvaluationGroupIDs([
        { run: { evaluationGroupID: "eval-a", status: "cancelled" } },
        { run: { evaluationGroupID: "eval-b", status: "cancelled" } },
      ]),
    ).toEqual(["eval-a", "eval-b"]);
  });

  it("ignores non-cancelled or malformed records", () => {
    expect(
      collectCancelledEvaluationGroupIDs([
        { run: { evaluationGroupID: "eval-a", status: "cancelled" } },
        { run: { evaluationGroupID: "eval-b", status: "running" } },
        { run: { status: "cancelled" } },
      ]),
    ).toEqual(["eval-a"]);
  });

  it("deduplicates repeated cancellation records for the same evaluation group", () => {
    expect(
      collectCancelledEvaluationGroupIDs([
        { run: { evaluationGroupID: "eval-a", status: "cancelled" } },
        { run: { evaluationGroupID: "eval-a", status: "cancelled" } },
      ]),
    ).toEqual(["eval-a"]);
  });
});
