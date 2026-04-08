import type { JobKind } from "./globals";
import { activeJobs, Constants, JobParallelizationMap, jobLogger } from "./globals";
import {
  getKindsForResourcePool,
  getResourcePoolForKind,
  ResourcePoolParallelizationMap,
} from "./scheduler/resourcePools";
import type { ResourcePool } from "./scheduler/types";

let isActive = true;
let listenerWaitingSignal: (() => void) | undefined;

/**
 * Returns the number of jobs that can be processed if submitted immediately.
 */
export function checkCanProcessResourcePool(resourcePool: ResourcePool) {
  if (!isActive) return 0;
  const activeJobsInPool = getKindsForResourcePool(resourcePool).reduce(
    (jobCount, kind) => jobCount + (activeJobs.get(kind)?.size ?? 0),
    0,
  );
  return Math.max(0, (ResourcePoolParallelizationMap.get(resourcePool) ?? 0) - activeJobsInPool);
}

export function checkCanProcessJob(kind: JobKind) {
  if (!isActive) return 0;
  const kindCapacityRemaining = Math.max(0, (JobParallelizationMap.get(kind) ?? 0) - (activeJobs.get(kind)?.size ?? 0));
  return Math.min(kindCapacityRemaining, checkCanProcessResourcePool(getResourcePoolForKind(kind)));
}

/**
 * Wait for new jobs to be submitted, either by waiting for 10 seconds to elapse, or for something to trigger the signal.
 */
export async function waitForWork() {
  await Promise.any([
    new Promise((resolve) => {
      setTimeout(resolve, Constants.listeningIntervalS * 1000);
    }),
    new Promise<void>((resolve) => {
      listenerWaitingSignal = resolve;
    }),
  ]);
  listenerWaitingSignal = undefined;
}

export function signalJobProcessor() {
  jobLogger.info(
    { submodule: "listener", isSignalValid: listenerWaitingSignal !== undefined },
    "Signaling jobs available before heartbeat triggers.",
  );
  listenerWaitingSignal?.();
  listenerWaitingSignal = undefined;
}

export function isQueueEnabled() {
  return isActive;
}

export function disableQueue() {
  isActive = false;
}
