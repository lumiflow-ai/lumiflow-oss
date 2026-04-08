import dotenvSafe from "dotenv-safe";

/** Allows skipping of config checks. Used for code generation. */
const skipConfig = Boolean(process.env.SKIP_CONFIG);
export const isProd = process.env.NODE_ENV === "production";
export const isDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === undefined;
export const isTest = process.env.NODE_ENV === "test";

/** These will be used if no value is provided, even on production */
const BASE_DEFAULTS: Record<string, string> = {
  JOB_SERVICE_LISTEN_PORT: "4004",
  MAX_JOB_ATTEMPTS: "3",
};

/** These will be used if no value is provided, even on production */
const DEV_DEFAULTS: Record<string, string> = {
  JOB_SERVICE_HOST: "http://localhost:4004",
  FRONTEND_PUBLIC_URL_AND_PORT: "http://localhost:3000",
  EVAL_HOST: "http://localhost:8000",

  DB_CREDENTIALS: '{"username":"ai","password":"human","port":5432}',
  DB_DATABASE_NAME: "lumiflowdb",
  DB_HOST: "localhost",
};

function loadEnv(store: Record<string, string> | undefined | null, key: string) {
  const value =
    store?.[key] ?? process.env[key] ?? (isDev || isTest ? DEV_DEFAULTS[key] : undefined) ?? BASE_DEFAULTS[key];

  if (value === undefined) {
    throw new Error(`Missing value for ${key} ${process.env.NODE_ENV}`);
  }

  return value;
}

const getRealConfig = () => {
  // Ensure all variables are present.
  const vars = dotenvSafe.config().parsed;

  // Validation
  const jobServiceListenPort = Number(loadEnv(vars, "JOB_SERVICE_LISTEN_PORT"));

  if (!Number.isSafeInteger(jobServiceListenPort)) {
    throw new Error(`Invalid value for port environment variable: ${jobServiceListenPort}`);
  }

  const maxJobAttempts = Number(loadEnv(vars, "MAX_JOB_ATTEMPTS"));
  if (!Number.isSafeInteger(maxJobAttempts) || maxJobAttempts <= 0) {
    throw new Error(`Invalid value for MAX_JOB_ATTEMPTS: ${maxJobAttempts}`);
  }

  const jobServiceHosts = loadEnv(vars, "JOB_SERVICE_HOST").split(",");
  const frontendHost = loadEnv(vars, "FRONTEND_PUBLIC_URL_AND_PORT");

  for (const jobServiceHost of jobServiceHosts) {
    new URL(jobServiceHost);

    if (jobServiceHost.endsWith("/")) {
      throw new Error("don't have a trailing slash on the job-service host URL, it'll break CORS");
    }
  }
  if (frontendHost.includes(",")) {
    throw new Error("FRONTEND_PUBLIC_URL_AND_PORT must be a single URL, not a comma-separated list");
  }

  new URL(frontendHost);
  if (frontendHost.endsWith("/")) {
    throw new Error("don't have a trailing slash on the frontend host URL");
  }

  return {
    LISTEN_PORT: jobServiceListenPort,
    HOST: jobServiceHosts,
    FRONTEND_PUBLIC_URL_AND_PORT: frontendHost,
    DB_CREDENTIALS: parseDBCredentials(loadEnv(vars, "DB_CREDENTIALS")),
    DB_HOST: loadEnv(vars, "DB_HOST"),
    DB_DATABASE_NAME: loadEnv(vars, "DB_DATABASE_NAME"),
    EVAL_HOST: loadEnv(vars, "EVAL_HOST"),
    MAX_JOB_ATTEMPTS: maxJobAttempts,
    IS_PROD: isProd,
    IS_DEV: isDev,
    IS_TEST: isTest,
  } as const;
};

export const Configuration = skipConfig ? ({} as ReturnType<typeof getRealConfig>) : getRealConfig();

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
