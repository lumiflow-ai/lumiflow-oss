import { describe, expect, it } from "vitest";

import { selectRunnableJobsFairly } from "@/jobQueue/scheduler/policy";
import {
  getKindsForResourcePool,
  getResourcePoolForKind,
  ResourcePoolParallelizationMap,
  ResourcePools,
} from "@/jobQueue/scheduler/resourcePools";

describe("scheduler resource pools", () => {
  it("maps eval job kinds into the shared eval pool", () => {
    expect(getResourcePoolForKind("evaluateRecipeStep")).toBe(ResourcePools.eval);
    expect(getKindsForResourcePool(ResourcePools.eval)).toEqual(["evaluateRecipeStep"]);
  });

  it("derives pool concurrency from per-kind concurrency", () => {
    expect(ResourcePoolParallelizationMap.get(ResourcePools.eval)).toBe(24);
    expect(ResourcePoolParallelizationMap.get(ResourcePools.schedule)).toBe(8);
    expect(ResourcePoolParallelizationMap.get(ResourcePools.callback)).toBe(200);
  });
});

describe("selectRunnableJobsFairly", () => {
  function makeJob({
    createdAt,
    generationID,
    orgID,
    orgLastSelectedAt,
    priority = 0,
    workstreamKey,
    workstreamLastSelectedAt,
  }: {
    createdAt: string;
    generationID: string;
    orgID: string;
    orgLastSelectedAt?: string;
    priority?: number;
    workstreamKey: string;
    workstreamLastSelectedAt?: string;
  }) {
    return {
      generationID,
      kind: "evaluateRecipeStep" as const,
      orgID,
      workstreamKey,
      priority,
      createdAt: new Date(createdAt),
      orgLastSelectedAt: orgLastSelectedAt ? new Date(orgLastSelectedAt) : undefined,
      workstreamLastSelectedAt: workstreamLastSelectedAt ? new Date(workstreamLastSelectedAt) : undefined,
    };
  }

  it("round-robins across orgs while preserving FIFO within each org", () => {
    const selectedJobs = selectRunnableJobsFairly({
      jobs: [
        makeJob({
          generationID: "org-a-1",
          orgID: "org-a",
          workstreamKey: "eval-a-1",
          createdAt: "2025-01-01T00:00:01.000Z",
        }),
        makeJob({
          generationID: "org-a-2",
          orgID: "org-a",
          workstreamKey: "eval-a-1",
          createdAt: "2025-01-01T00:00:02.000Z",
        }),
        makeJob({
          generationID: "org-b-1",
          orgID: "org-b",
          workstreamKey: "eval-b-1",
          createdAt: "2025-01-01T00:00:03.000Z",
        }),
        makeJob({
          generationID: "org-c-1",
          orgID: "org-c",
          workstreamKey: "eval-c-1",
          createdAt: "2025-01-01T00:00:04.000Z",
        }),
      ],
      limit: 4,
    });

    expect(selectedJobs.map(({ generationID }) => generationID)).toEqual(["org-a-1", "org-b-1", "org-c-1", "org-a-2"]);
  });

  it("keeps lower numeric priority ahead within each round", () => {
    const selectedJobs = selectRunnableJobsFairly({
      jobs: [
        makeJob({
          generationID: "org-a-1",
          orgID: "org-a",
          workstreamKey: "eval-a-1",
          priority: 1,
          createdAt: "2025-01-01T00:00:01.000Z",
        }),
        makeJob({
          generationID: "org-b-1",
          orgID: "org-b",
          workstreamKey: "eval-b-1",
          createdAt: "2025-01-01T00:00:05.000Z",
        }),
        makeJob({
          generationID: "org-a-2",
          orgID: "org-a",
          workstreamKey: "eval-a-1",
          priority: 1,
          createdAt: "2025-01-01T00:00:02.000Z",
        }),
        makeJob({
          generationID: "org-b-2",
          orgID: "org-b",
          workstreamKey: "eval-b-1",
          createdAt: "2025-01-01T00:00:06.000Z",
        }),
      ],
      limit: 4,
    });

    expect(selectedJobs.map(({ generationID }) => generationID)).toEqual(["org-b-1", "org-a-1", "org-b-2", "org-a-2"]);
  });

  it("interleaves workstreams within the same org while preserving FIFO inside each stream", () => {
    const selectedJobs = selectRunnableJobsFairly({
      jobs: [
        makeJob({
          generationID: "org-a-eval-1-1",
          orgID: "org-a",
          workstreamKey: "eval-1",
          createdAt: "2025-01-01T00:00:01.000Z",
        }),
        makeJob({
          generationID: "org-a-eval-1-2",
          orgID: "org-a",
          workstreamKey: "eval-1",
          createdAt: "2025-01-01T00:00:02.000Z",
        }),
        makeJob({
          generationID: "org-a-eval-2-1",
          orgID: "org-a",
          workstreamKey: "eval-2",
          createdAt: "2025-01-01T00:00:03.000Z",
        }),
        makeJob({
          generationID: "org-a-eval-3-1",
          orgID: "org-a",
          workstreamKey: "eval-3",
          createdAt: "2025-01-01T00:00:04.000Z",
        }),
      ],
      limit: 4,
    });

    expect(selectedJobs.map(({ generationID }) => generationID)).toEqual([
      "org-a-eval-1-1",
      "org-a-eval-2-1",
      "org-a-eval-3-1",
      "org-a-eval-1-2",
    ]);
  });

  it("keeps fairness across orgs after interleaving workstreams inside each org", () => {
    const selectedJobs = selectRunnableJobsFairly({
      jobs: [
        makeJob({
          generationID: "org-a-eval-1-1",
          orgID: "org-a",
          workstreamKey: "eval-1",
          createdAt: "2025-01-01T00:00:01.000Z",
        }),
        makeJob({
          generationID: "org-a-eval-1-2",
          orgID: "org-a",
          workstreamKey: "eval-1",
          createdAt: "2025-01-01T00:00:02.000Z",
        }),
        makeJob({
          generationID: "org-a-eval-2-1",
          orgID: "org-a",
          workstreamKey: "eval-2",
          createdAt: "2025-01-01T00:00:03.000Z",
        }),
        makeJob({
          generationID: "org-b-eval-1-1",
          orgID: "org-b",
          workstreamKey: "eval-1",
          createdAt: "2025-01-01T00:00:04.000Z",
        }),
      ],
      limit: 4,
    });

    expect(selectedJobs.map(({ generationID }) => generationID)).toEqual([
      "org-a-eval-1-1",
      "org-b-eval-1-1",
      "org-a-eval-2-1",
      "org-a-eval-1-2",
    ]);
  });

  it("prefers the least recently served workstream inside an org when only one slot is available", () => {
    const selectedJobs = selectRunnableJobsFairly({
      jobs: [
        makeJob({
          generationID: "deepseek-next",
          orgID: "org-a",
          workstreamKey: "z1",
          createdAt: "2025-01-01T00:00:01.000Z",
          workstreamLastSelectedAt: "2025-01-01T00:10:00.000Z",
        }),
        makeJob({
          generationID: "nova-next",
          orgID: "org-a",
          workstreamKey: "z2",
          createdAt: "2025-01-01T00:00:05.000Z",
        }),
      ],
      limit: 1,
    });

    expect(selectedJobs.map(({ generationID }) => generationID)).toEqual(["nova-next"]);
  });

  it("prefers the least recently served org when only one slot is available", () => {
    const selectedJobs = selectRunnableJobsFairly({
      jobs: [
        makeJob({
          generationID: "org-a-next",
          orgID: "org-a",
          workstreamKey: "eval-a",
          createdAt: "2025-01-01T00:00:01.000Z",
          orgLastSelectedAt: "2025-01-01T00:10:00.000Z",
        }),
        makeJob({
          generationID: "org-b-next",
          orgID: "org-b",
          workstreamKey: "eval-b",
          createdAt: "2025-01-01T00:00:05.000Z",
        }),
      ],
      limit: 1,
    });

    expect(selectedJobs.map(({ generationID }) => generationID)).toEqual(["org-b-next"]);
  });
});
