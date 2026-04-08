import { describe, expect, it } from "vitest";

import { canRunAttempt, getFailureOutcome } from "@/jobQueue/attempts";

describe("job attempt accounting", () => {
  it("allows work while failure attempts remain", () => {
    expect(canRunAttempt({ attemptCount: 0, maxAttempts: 3 })).toBe(true);
    expect(canRunAttempt({ attemptCount: 2, maxAttempts: 3 })).toBe(true);
    expect(canRunAttempt({ attemptCount: 3, maxAttempts: 3 })).toBe(false);
  });

  it("increments only on execution failure and fails on the last allowed retry", () => {
    expect(getFailureOutcome({ attemptCount: 0, maxAttempts: 3 })).toEqual({
      nextAttemptCount: 1,
      status: "waiting",
    });
    expect(getFailureOutcome({ attemptCount: 2, maxAttempts: 3 })).toEqual({
      nextAttemptCount: 3,
      status: "failed",
    });
  });
});
