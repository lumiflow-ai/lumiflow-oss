import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { handleStagingAccess } from "./stagingAccess";

describe("staging middleware authorization", () => {
  it("skips staging access checks outside staging", async () => {
    const fakeEnv = { APP_ENV: "production" };
    const fakeFetchAccount = async (
      _request: NextRequest,
      _env?: Record<string, string | undefined>,
    ): Promise<number | null> => {
      throw new Error("should not be called");
    };
    const response = await handleStagingAccess(new NextRequest("http://localhost/app"), fakeEnv, fakeFetchAccount);
    expect(response).toBeNull();
  });

  it("allows staging requests when backend account check succeeds", async () => {
    const fakeEnv = { APP_ENV: "staging", NEXT_PUBLIC_BACKEND_URL: "http://backend/" };
    const fakeFetchAccount = async (
      _request: NextRequest,
      env?: Record<string, string | undefined>,
    ): Promise<number | null> => {
      expect(env).toBe(fakeEnv);
      return 200;
    };
    const response = await handleStagingAccess(
      new NextRequest("http://localhost/app/fake-org"),
      fakeEnv,
      fakeFetchAccount,
    );
    expect(response).toBeNull();
  });

  it("redirects to logout when backend rejects staging access", async () => {
    const fakeEnv = { APP_ENV: "staging", NEXT_PUBLIC_BACKEND_URL: "http://backend/" };
    const fakeFetchAccount = async (
      _request: NextRequest,
      env?: Record<string, string | undefined>,
    ): Promise<number | null> => {
      expect(env).toBe(fakeEnv);
      return 403;
    };
    const response = await handleStagingAccess(new NextRequest("http://localhost/app"), fakeEnv, fakeFetchAccount);
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("http://backend/logout?path=%2Fapp");
  });

  it("allows staging requests to reach login when no account is present", async () => {
    const fakeEnv = { VERCEL_TARGET_ENV: "staging", NEXT_PUBLIC_BACKEND_URL: "http://backend/" };
    const fakeFetchAccount = async (
      _request: NextRequest,
      _env?: Record<string, string | undefined>,
    ): Promise<number | null> => {
      return null;
    };
    const response = await handleStagingAccess(new NextRequest("http://localhost/app"), fakeEnv, fakeFetchAccount);
    expect(response).toBeNull();
  });

  it("falls back to VERCEL_TARGET_ENV when APP_ENV is missing", async () => {
    const fakeEnv = { VERCEL_TARGET_ENV: "staging", NEXT_PUBLIC_BACKEND_URL: "http://backend/" };
    const fakeFetchAccount = async (
      _request: NextRequest,
      _env?: Record<string, string | undefined>,
    ): Promise<number | null> => {
      return 403;
    };
    const response = await handleStagingAccess(
      new NextRequest("http://localhost/app/fake-org"),
      fakeEnv,
      fakeFetchAccount,
    );
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("http://backend/logout?path=%2Fapp");
  });
});
