export function canRunAttempt({ attemptCount, maxAttempts }: { attemptCount: number; maxAttempts: number }) {
  return attemptCount < maxAttempts;
}

export function getFailureOutcome({ attemptCount, maxAttempts }: { attemptCount: number; maxAttempts: number }) {
  const nextAttemptCount = attemptCount + 1;
  return {
    nextAttemptCount,
    status: nextAttemptCount >= maxAttempts ? ("failed" as const) : ("waiting" as const),
  };
}
