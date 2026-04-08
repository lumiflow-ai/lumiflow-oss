import { randomUUID } from "node:crypto";

import { Configuration } from "@/server/config";
import { logger } from "@/server/logger";
import { createPGPool } from "@/server/persistence";

export const Constants = {
  runnerID: randomUUID(),
  listeningIntervalS: 10,
  jobHeartbeatIntervalS: 5,
  jobValidityIntervalS: 25,
  jobAbandonedIntervalS: 30,
  maxJobAttempts: Configuration.MAX_JOB_ATTEMPTS,
};

export const JobKinds = {
  evaluateRecipeStep: "evaluateRecipeStep" as const,
  scheduleRecipeEvaluation: "scheduleRecipeEvaluation" as const,
  notifyCallback: "notifyCallback" as const,
};

/// Define how many jobs of a given type may be handled at once.
const JobParallelization = {
  // Keep LLM-bound kinds below the capacity of the single eval-service instance
  // until the shared resource-pool scheduler lands.
  [JobKinds.evaluateRecipeStep]: 24,
  // Scheduling work fans out aggressively, so keep it well below eval concurrency.
  [JobKinds.scheduleRecipeEvaluation]: 8,
  [JobKinds.notifyCallback]: 200,
};
export type JobKind = keyof typeof JobParallelization;
export const JobParallelizationMap = new Map(Object.entries(JobParallelization));

export const RegisteredJobKinds = Array.from(JobParallelizationMap.keys());

export const jobClientPool = createPGPool();
export const jobLogger = logger.child({
  module: "jobQueue",
  constants: { ...Constants },
  parallelization: Object.fromEntries(JobParallelizationMap),
});
export const activeJobs: Map<string, Map<string, Promise<unknown>>> = new Map();
