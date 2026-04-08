import { describe, expect, it } from "vitest";

import { getAppEnvironment } from "./env";

describe("getAppEnvironment", () => {
  it("prefers APP_ENV when set", () => {
    const env = { APP_ENV: "staging", VERCEL_TARGET_ENV: "preview", NODE_ENV: "production" };
    expect(getAppEnvironment(env)).toBe("staging");
  });

  it("falls back to VERCEL_TARGET_ENV", () => {
    const env = { VERCEL_TARGET_ENV: "preview", NODE_ENV: "production" };
    expect(getAppEnvironment(env)).toBe("preview");
  });

  it("uses NODE_ENV to infer production or test", () => {
    expect(getAppEnvironment({ NODE_ENV: "production" })).toBe("production");
    expect(getAppEnvironment({ NODE_ENV: "test" })).toBe("test");
  });

  it("returns development when NODE_ENV is undefined", () => {
    expect(getAppEnvironment({})).toBe("development");
  });

  it("returns unknown for unexpected environments", () => {
    expect(getAppEnvironment({ NODE_ENV: "madeup" })).toBe("unknown");
  });
});
