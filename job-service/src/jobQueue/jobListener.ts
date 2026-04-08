import { activeJobs, Constants, jobClientPool, jobLogger } from "./globals";
import { attemptToStartJob } from "./processJob";
import { getKindsForResourcePool, RegisteredResourcePools } from "./scheduler/resourcePools";
import { schedulerStore } from "./scheduler/store";
import {
  checkCanProcessResourcePool,
  disableQueue,
  isQueueEnabled,
  signalJobProcessor,
  waitForWork,
} from "./signaling";

export function startJobListener() {
  const listenerLogger = jobLogger.child({ submodule: "listener" });
  const finishedShuttingDownSignal = (async () => {
    listenerLogger.info("Starting listener.");
    while (isQueueEnabled()) {
      const pgPool = await jobClientPool;
      for (const resourcePool of RegisteredResourcePools) {
        try {
          const numberOfResults = checkCanProcessResourcePool(resourcePool);
          listenerLogger.info({ resourcePool, numberOfJobsToLoad: numberOfResults }, "Loading jobs…");
          if (numberOfResults) {
            const kinds = getKindsForResourcePool(resourcePool);
            const runnableJobs = await schedulerStore.loadRunnableJobs({
              pgPool,
              logger: listenerLogger,
              kinds,
              limit: numberOfResults,
              abandonedIntervalS: Constants.jobAbandonedIntervalS,
              resourcePool,
            });
            listenerLogger.info(
              { resourcePool, kinds, numberOfJobsToLoad: numberOfResults, numberOfJobsLoaded: runnableJobs.length },
              "Loaded jobs. Attempting to start them…",
            );

            for (const { generationID, kind } of runnableJobs) {
              attemptToStartJob({ kind, generationID, logger: listenerLogger });
            }
          }
        } catch (error) {
          listenerLogger.warn({ resourcePool, error }, "Listen failed, trying again");
        }
      }
      listenerLogger.info("Waiting for signal or heartbeat…");
      await waitForWork();
    }
    listenerLogger.info("Stopping listener.");
  })();

  return {
    shutdown: async () => {
      /// Tell the above loop to stop checking for new values by setting isActive to false.
      disableQueue();
      /// Trigger the signal so we don't wait for the timer to trigger.
      signalJobProcessor();
      /// Wait for the listener run loop to finish.
      await finishedShuttingDownSignal;
      /// Wait for any in-progress work items.
      for (const jobsPerKind of activeJobs.values()) {
        await Promise.allSettled(jobsPerKind.values());
      }
      /// Wait for the pool to drain.
      await (await jobClientPool).end();
      return;
    },
  };
}
