import { type JobKind, JobKinds, JobParallelizationMap } from "@/jobQueue/globals";

import type { ResourcePool } from "./types";

export const ResourcePools = {
  schedule: "schedule" as const,
  eval: "eval" as const,
  callback: "callback" as const,
};

const JobResourcePools: Record<JobKind, ResourcePool> = {
  [JobKinds.evaluateRecipeStep]: ResourcePools.eval,
  [JobKinds.scheduleRecipeEvaluation]: ResourcePools.schedule,
  [JobKinds.notifyCallback]: ResourcePools.callback,
};

export const ResourcePoolParallelizationMap = new Map<ResourcePool, number>();
for (const [kind, parallelization] of JobParallelizationMap.entries()) {
  const resourcePool = getResourcePoolForKind(kind as JobKind);
  ResourcePoolParallelizationMap.set(
    resourcePool,
    Math.max(ResourcePoolParallelizationMap.get(resourcePool) ?? 0, parallelization),
  );
}

export const RegisteredResourcePools = Object.values(ResourcePools);

export function getResourcePoolForKind(kind: JobKind): ResourcePool {
  return JobResourcePools[kind];
}

export function getKindsForResourcePool(resourcePool: ResourcePool): readonly JobKind[] {
  return Object.entries(JobResourcePools)
    .filter(([, pool]) => pool === resourcePool)
    .map(([kind]) => kind as JobKind);
}
