import type { SchedulerRunnableJob } from "./types";

function compareJobs(lhs: SchedulerRunnableJob, rhs: SchedulerRunnableJob) {
  const prioritySort = lhs.priority - rhs.priority;
  if (prioritySort !== 0) return prioritySort;

  const createdAtSort = lhs.createdAt.getTime() - rhs.createdAt.getTime();
  if (createdAtSort !== 0) return createdAtSort;

  const generationIDSort = lhs.generationID.localeCompare(rhs.generationID, "en");
  if (generationIDSort !== 0) return generationIDSort;

  return lhs.orgID.localeCompare(rhs.orgID, "en");
}

function getLastSelectedValue(lastSelectedAt: Date | undefined) {
  return lastSelectedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
}

function compareLastSelectedValues(lhs: number, rhs: number) {
  if (lhs === rhs) return 0;
  if (lhs === Number.NEGATIVE_INFINITY) return -1;
  if (rhs === Number.NEGATIVE_INFINITY) return 1;
  return lhs - rhs;
}

type WorkstreamState = {
  lastSelectedValue: number;
  jobs: SchedulerRunnableJob[];
  workstreamKey: string;
};

type OrgState = {
  lastSelectedValue: number;
  orgID: string;
  workstreams: Map<string, WorkstreamState>;
};

function compareWorkstreamStates(lhs: WorkstreamState, rhs: WorkstreamState) {
  const lastSelectedSort = compareLastSelectedValues(lhs.lastSelectedValue, rhs.lastSelectedValue);
  if (lastSelectedSort !== 0) return lastSelectedSort;

  const lhsHeadJob = lhs.jobs.at(0);
  const rhsHeadJob = rhs.jobs.at(0);
  if (lhsHeadJob && rhsHeadJob) {
    const headSort = compareJobs(lhsHeadJob, rhsHeadJob);
    if (headSort !== 0) return headSort;
  }

  return lhs.workstreamKey.localeCompare(rhs.workstreamKey, "en");
}

function getNextWorkstream(orgState: OrgState) {
  return Array.from(orgState.workstreams.values())
    .filter((workstreamState) => workstreamState.jobs.length > 0)
    .sort(compareWorkstreamStates)
    .at(0);
}

function createOrgState(jobs: SchedulerRunnableJob[]): OrgState | undefined {
  const orgID = jobs.at(0)?.orgID;
  if (!orgID) return undefined;

  const jobsPerWorkstream = new Map<string, SchedulerRunnableJob[]>();
  for (const job of jobs) {
    const existingJobs = jobsPerWorkstream.get(job.workstreamKey);
    if (existingJobs) {
      existingJobs.push(job);
      continue;
    }

    jobsPerWorkstream.set(job.workstreamKey, [job]);
  }

  const workstreams = new Map<string, WorkstreamState>();
  for (const [workstreamKey, workstreamJobs] of jobsPerWorkstream.entries()) {
    workstreamJobs.sort(compareJobs);
    workstreams.set(workstreamKey, {
      workstreamKey,
      jobs: workstreamJobs,
      lastSelectedValue: getLastSelectedValue(workstreamJobs.at(0)?.workstreamLastSelectedAt),
    });
  }

  return {
    orgID,
    workstreams,
    lastSelectedValue: getLastSelectedValue(jobs.at(0)?.orgLastSelectedAt),
  };
}

export function orderJobsRoundRobin(jobs: SchedulerRunnableJob[]) {
  const jobsPerOrg = new Map<string, SchedulerRunnableJob[]>();
  for (const job of jobs) {
    const existingJobs = jobsPerOrg.get(job.orgID);
    if (existingJobs) {
      existingJobs.push(job);
      continue;
    }

    jobsPerOrg.set(job.orgID, [job]);
  }

  let selectionClock =
    jobs.reduce((largestTimestamp, job) => {
      return Math.max(
        largestTimestamp,
        getLastSelectedValue(job.orgLastSelectedAt),
        getLastSelectedValue(job.workstreamLastSelectedAt),
      );
    }, Date.now()) + 1;

  const orgStates = new Map<string, OrgState>();
  for (const [orgID, orgJobs] of jobsPerOrg.entries()) {
    const orgState = createOrgState(orgJobs);
    if (orgState) {
      orgStates.set(orgID, orgState);
    }
  }

  const orderedJobs: SchedulerRunnableJob[] = [];
  while (orgStates.size > 0) {
    const nextSelection = Array.from(orgStates.values())
      .map((orgState) => {
        return {
          nextWorkstream: getNextWorkstream(orgState),
          orgState,
        };
      })
      .filter(
        (selection): selection is { nextWorkstream: WorkstreamState; orgState: OrgState } =>
          selection.nextWorkstream !== undefined,
      )
      .sort((lhs, rhs) => {
        const orgLastSelectedSort = compareLastSelectedValues(
          lhs.orgState.lastSelectedValue,
          rhs.orgState.lastSelectedValue,
        );
        if (orgLastSelectedSort !== 0) return orgLastSelectedSort;

        const workstreamSort = compareWorkstreamStates(lhs.nextWorkstream, rhs.nextWorkstream);
        if (workstreamSort !== 0) return workstreamSort;

        return lhs.orgState.orgID.localeCompare(rhs.orgState.orgID, "en");
      })
      .at(0);

    if (!nextSelection) {
      break;
    }

    const nextJob = nextSelection.nextWorkstream.jobs.shift();
    if (!nextJob) {
      nextSelection.orgState.workstreams.delete(nextSelection.nextWorkstream.workstreamKey);
      continue;
    }

    orderedJobs.push(nextJob);
    nextSelection.orgState.lastSelectedValue = selectionClock;
    nextSelection.nextWorkstream.lastSelectedValue = selectionClock;
    selectionClock += 1;

    if (nextSelection.nextWorkstream.jobs.length === 0) {
      nextSelection.orgState.workstreams.delete(nextSelection.nextWorkstream.workstreamKey);
    }

    if (nextSelection.orgState.workstreams.size === 0) {
      orgStates.delete(nextSelection.orgState.orgID);
    }
  }

  return orderedJobs;
}
