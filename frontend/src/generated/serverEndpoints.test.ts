import { describe, expect, it } from "vitest";

import { __visibleForTesting, HTTPResponseError } from "./serverEndpoints";

describe("serverEndpoints", () => {
  describe("shouldRetryGETOnError", () => {
    it("does not retry authentication or authorization failures", () => {
      expect(__visibleForTesting.shouldRetryGETOnError(new HTTPResponseError("Authentication Error", 401))).toBe(false);
      expect(__visibleForTesting.shouldRetryGETOnError(new HTTPResponseError("Authorization Error", 403))).toBe(false);
    });

    it("retries transient failures", () => {
      expect(__visibleForTesting.shouldRetryGETOnError(new HTTPResponseError("Server Error", 500))).toBe(true);
      expect(__visibleForTesting.shouldRetryGETOnError(new TypeError("Network Error"))).toBe(true);
    });
  });
});
