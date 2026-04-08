import { describe, expect, it } from "vitest";

import { JobKinds } from "@/jobQueue/globals";

import { getSchedulerFairnessStateWorkstreamKey, getSchedulerWorkstreamKey } from "./fairnessState";

describe("scheduler fairness state workstream keys", () => {
  it("uses evaluationGroupID as the stable workstream key for eval jobs", () => {
    const jobRecord = {
      kind: JobKinds.evaluateRecipeStep,
      generation_id: "generation-1",
      recipe_run_id: "recipe-run-1",
      inputs: {
        evaluationGroupID: "evaluation-group-1",
      },
    };

    expect(getSchedulerWorkstreamKey(jobRecord)).toBe("evaluation-group-1");
    expect(getSchedulerFairnessStateWorkstreamKey(jobRecord)).toBe("evaluation-group-1");
  });

  it("falls back to generation selection without persisting per-job workstream state", () => {
    const jobRecord = {
      kind: JobKinds.evaluateRecipeStep,
      generation_id: "generation-1",
      recipe_run_id: undefined,
      inputs: {},
    };

    expect(getSchedulerWorkstreamKey(jobRecord)).toBe("generation-1");
    expect(getSchedulerFairnessStateWorkstreamKey(jobRecord)).toBeUndefined();
  });

  it("does not create workstream fairness state for callback jobs", () => {
    const jobRecord = {
      kind: JobKinds.notifyCallback,
      generation_id: "generation-1",
      recipe_run_id: "recipe-run-1",
      inputs: {},
    };

    expect(getSchedulerWorkstreamKey(jobRecord)).toBe("generation-1");
    expect(getSchedulerFairnessStateWorkstreamKey(jobRecord)).toBeUndefined();
  });
});
