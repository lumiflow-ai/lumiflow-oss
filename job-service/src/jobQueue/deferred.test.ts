import { describe, expect, it } from "vitest";

import { getJobDeferralFromResponse, JobDeferredError } from "@/jobQueue/deferred";

describe("job deferrals", () => {
  it("parses structured retryable responses from eval-service", async () => {
    const deferral = await getJobDeferralFromResponse(
      new Response(
        JSON.stringify({
          retryable: true,
          code: "rate_limited",
          message: "Too many requests",
          retryAfterSeconds: 2.5,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "3",
          },
        },
      ),
    );

    expect(deferral).toBeInstanceOf(JobDeferredError);
    expect(deferral?.retryAfterSeconds).toBe(2.5);
    expect(deferral?.code).toBe("rate_limited");
  });

  it("ignores non-retryable downstream errors", async () => {
    const deferral = await getJobDeferralFromResponse(
      new Response(JSON.stringify({ retryable: false }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    expect(deferral).toBeUndefined();
  });
});
