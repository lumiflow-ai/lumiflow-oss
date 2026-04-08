import { afterEach, describe, expect, it, vi } from "vitest";

describe("CONFIG", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the local eval service when EVAL_HOST is unset or empty in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EVAL_HOST", "");

    const { CONFIG } = await import("./config");

    expect(CONFIG.EVAL_HOST).toBe("http://localhost:8000");
    expect(CONFIG.FAKE_EVAL_SERVICE).toBe(false);
  });

  it("enables backend mock eval previews only when FAKE_EVAL_SERVICE is 1", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("FAKE_EVAL_SERVICE", "1");

    const { CONFIG } = await import("./config");

    expect(CONFIG.FAKE_EVAL_SERVICE).toBe(true);
  });

  it("rejects backend mock eval previews in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FAKE_EVAL_SERVICE", "1");
    vi.stubEnv("AUTH_SECRET", "production-auth-secret");
    vi.stubEnv("AUTH_COOKIE_DOMAIN", "example.com");
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-client-secret");
    vi.stubEnv("BACKEND_PUBLIC_URL_AND_PORT", "https://api.example.com");
    vi.stubEnv("FRONTEND_PUBLIC_URL_AND_PORT", "https://app.example.com");
    vi.stubEnv("DB_CREDENTIALS", '{"username":"ai","password":"human","port":5432}');
    vi.stubEnv("DB_HOST", "database.example.com");
    vi.stubEnv("EVAL_HOST", "https://eval.example.com");
    vi.stubEnv("JOB_HOST", "https://job.example.com");

    await expect(import("./config")).rejects.toThrow("FAKE_EVAL_SERVICE cannot be enabled in production.");
  });

  it("does not require development login credentials in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "production-auth-secret");
    vi.stubEnv("AUTH_COOKIE_DOMAIN", "example.com");
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-client-secret");
    vi.stubEnv("BACKEND_PUBLIC_URL_AND_PORT", "https://api.example.com");
    vi.stubEnv("FRONTEND_PUBLIC_URL_AND_PORT", "https://app.example.com");
    vi.stubEnv("DB_CREDENTIALS", '{"username":"ai","password":"human","port":5432}');
    vi.stubEnv("DB_HOST", "database.example.com");
    vi.stubEnv("EVAL_HOST", "https://eval.example.com");
    vi.stubEnv("JOB_HOST", "https://job.example.com");
    delete process.env.AUTH_DEV_EMAIL;
    delete process.env.AUTH_DEV_PASSWORD;

    const { CONFIG } = await import("./config");

    expect(CONFIG.IS_PROD).toBe(true);
    expect(CONFIG.AUTH_DEV_EMAIL).toBe("");
    expect(CONFIG.AUTH_DEV_PASSWORD).toBe("");
  });
});
