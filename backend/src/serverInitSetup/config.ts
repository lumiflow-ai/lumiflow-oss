import dotenvSafe from "dotenv-safe";

import { parseRequestBodyLimit } from "./requestBodyLimit";

export const isProd = process.env.NODE_ENV === "production";
export const isDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === undefined;
export const isTest = process.env.NODE_ENV === "test";

/** These will be used if no value is provided, even on production */
const BASE_DEFAULTS: Record<string, string> = {
  APP_ENV: isProd ? "production" : isDev ? "development" : isTest ? "test" : "unknown",
  APP_ACCESS_ALLOW_LIST: "",
  ADDITIONAL_ORG_ACCESS_DOMAINS: "",
  API_KEYS: "",
  BACKEND_LISTEN_PORT: "4000",
  BACKEND_REQUEST_BODY_LIMIT: "10mb",
  DB_DATABASE_NAME: "lumiflowdb",
  FAKE_EVAL_SERVICE: "0",
};

/** These will be used if no value is provided, but only in development or test environments */
const DEV_DEFAULTS: Record<string, string> = {
  AUTH_SECRET: "development-auth-secret-that-should-be-overridden",
  AUTH_COOKIE_DOMAIN: "localhost",
  AUTH_DEV_EMAIL: "dev@lumiflow.ai",
  AUTH_DEV_PASSWORD: "lumiflow",
  GOOGLE_CLIENT_ID: "local-google-client-id",
  GOOGLE_CLIENT_SECRET: "local-google-client-secret",
  BACKEND_LISTEN_PORT: "4000",

  BACKEND_PUBLIC_URL_AND_PORT: "http://localhost:4000",
  FRONTEND_PUBLIC_URL_AND_PORT: "http://localhost:3000",

  DB_CREDENTIALS: '{"username":"ai","password":"human","port":5432}',
  DB_DATABASE_NAME: "lumiflowdb",
  DB_HOST: "localhost",

  EVAL_HOST: "http://localhost:8000",

  JOB_HOST: "http://localhost:4004",
};

function resolveEnvValue(
  store: Record<string, string> | undefined | null,
  key: string,
  options: { treatEmptyAsUnset?: boolean } = {},
) {
  const storeValue = options.treatEmptyAsUnset && store?.[key] === "" ? undefined : store?.[key];
  const processValue = options.treatEmptyAsUnset && process.env[key] === "" ? undefined : process.env[key];

  return storeValue ?? processValue ?? (isDev || isTest ? DEV_DEFAULTS[key] : undefined) ?? BASE_DEFAULTS[key];
}

function loadEnv(
  store: Record<string, string> | undefined | null,
  key: string,
  options?: { treatEmptyAsUnset?: boolean },
) {
  const value = resolveEnvValue(store, key, options);

  if (value === undefined) {
    throw new Error(`Missing value for ${key} ${process.env.NODE_ENV}`);
  }

  return value;
}

function loadOptionalEnv(store: Record<string, string> | undefined | null, key: string) {
  return resolveEnvValue(store, key) ?? "";
}

const getRealConfig = () => {
  // Ensure all variables are present.
  const vars = dotenvSafe.config().parsed;

  // Validation
  const backendListenPort = Number(loadEnv(vars, "BACKEND_LISTEN_PORT"));

  if (!Number.isSafeInteger(backendListenPort)) {
    throw new Error(`Invalid value for port environment variable: ${backendListenPort}`);
  }

  const backendRequestBodyLimit = parseRequestBodyLimit(loadEnv(vars, "BACKEND_REQUEST_BODY_LIMIT"));

  const frontendHosts = loadEnv(vars, "FRONTEND_PUBLIC_URL_AND_PORT").split(",");
  const backendHosts = loadEnv(vars, "BACKEND_PUBLIC_URL_AND_PORT").split(",");
  const fakeEvalService = loadEnv(vars, "FAKE_EVAL_SERVICE", { treatEmptyAsUnset: true });

  if (fakeEvalService !== "0" && fakeEvalService !== "1") {
    throw new Error("Invalid value for FAKE_EVAL_SERVICE: Must be 0 or 1.");
  }
  if (isProd && fakeEvalService === "1") {
    throw new Error("FAKE_EVAL_SERVICE cannot be enabled in production.");
  }

  for (const frontendHost of frontendHosts) {
    new URL(frontendHost);

    if (frontendHost.endsWith("/")) {
      throw new Error("don't have a trailing slash on the frontend URL, it'll break CORS");
    }
  }

  for (const backendHost of backendHosts) {
    new URL(backendHost);
  }

  return {
    AUTH_SECRET: loadEnv(vars, "AUTH_SECRET"),
    AUTH_COOKIE_DOMAIN: loadEnv(vars, "AUTH_COOKIE_DOMAIN"),
    AUTH_DEV_EMAIL: loadOptionalEnv(vars, "AUTH_DEV_EMAIL"),
    AUTH_DEV_PASSWORD: loadOptionalEnv(vars, "AUTH_DEV_PASSWORD"),
    GOOGLE_CLIENT_ID: loadEnv(vars, "GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: loadEnv(vars, "GOOGLE_CLIENT_SECRET"),
    APP_ENV: loadEnv(vars, "APP_ENV"),
    APP_ACCESS_ALLOW_LIST: loadEnv(vars, "APP_ACCESS_ALLOW_LIST"),
    ADDITIONAL_ORG_ACCESS_DOMAINS: loadEnv(vars, "ADDITIONAL_ORG_ACCESS_DOMAINS"),
    API_KEYS: loadEnv(vars, "API_KEYS"),
    BACKEND_LISTEN_PORT: backendListenPort,
    BACKEND_REQUEST_BODY_LIMIT: backendRequestBodyLimit,
    BACKEND_PUBLIC_URL_AND_PORT: backendHosts,
    FRONTEND_PUBLIC_URL_AND_PORT: frontendHosts,
    DB_CREDENTIALS: parseDBCredentials(loadEnv(vars, "DB_CREDENTIALS")),
    DB_HOST: loadEnv(vars, "DB_HOST"),
    DB_DATABASE_NAME: loadEnv(vars, "DB_DATABASE_NAME"),
    EVAL_HOST: loadEnv(vars, "EVAL_HOST", { treatEmptyAsUnset: true }),
    FAKE_EVAL_SERVICE: fakeEvalService === "1",
    JOB_HOST: loadEnv(vars, "JOB_HOST"),
    IS_PROD: isProd,
    IS_DEV: isDev,
    IS_TEST: isTest,
  } as const;
};

export const CONFIG = getRealConfig();

/**
 * Takes the db credentials as a string from the environment variable and parses it.
 *
 * Some fields from the env variable are not included here, for example the host
 * isn't included because it's the host of the DB itself, not the RDS proxy.
 */
function parseDBCredentials(credentialString: string): {
  username: string | undefined;
  password: string | undefined;
  port: number | undefined;
} {
  const parsed = JSON.parse(credentialString);

  const username = parsed?.username;
  const password = parsed?.password;
  const port = Number(parsed?.port ?? 5432);

  if (!username || typeof username !== "string") {
    throw new Error("Invalid value for DB username: Must be a string.");
  }

  if (!password || typeof password !== "string") {
    throw new Error("Invalid value for DB password: Must be a string.");
  }

  if (!Number.isSafeInteger(port)) {
    throw new Error("Invalid value for DB port: Must be an integer.");
  }

  return { username, password, port };
}
