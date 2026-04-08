import { orderJobsRoundRobin } from "./roundRobin";
import type { SchedulerRunnableJob } from "./types";

export function selectRunnableJobsFairly({
  jobs,
  limit,
}: {
  jobs: SchedulerRunnableJob[];
  limit: number;
}): SchedulerRunnableJob[] {
  return orderJobsRoundRobin(jobs).slice(0, limit);
}
