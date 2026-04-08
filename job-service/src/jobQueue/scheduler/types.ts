import type { JobKind } from "@/jobQueue/globals";

export type ResourcePool = "schedule" | "eval" | "callback";

export type SchedulerRunnableJob = {
  generationID: string;
  kind: JobKind;
  orgID: string;
  workstreamKey: string;
  priority: number;
  createdAt: Date;
  orgLastSelectedAt: Date | undefined;
  workstreamLastSelectedAt: Date | undefined;
};
