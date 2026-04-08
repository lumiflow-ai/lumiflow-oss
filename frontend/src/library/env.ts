type ProcessEnv = Record<string, string | undefined>;

/* Node.js environment helpers */

export function isProd(env: ProcessEnv = process.env) {
  return env.NODE_ENV === "production";
}

export function isDev(env: ProcessEnv = process.env) {
  return env.NODE_ENV === "development" || env.NODE_ENV === undefined;
}

export function isTest(env: ProcessEnv = process.env) {
  return env.NODE_ENV === "test";
}

/* Application environment helpers */

export function getAppEnvironment(env: ProcessEnv = process.env): string {
  if (env.APP_ENV) return env.APP_ENV;
  if (env.VERCEL_TARGET_ENV) return env.VERCEL_TARGET_ENV;
  if (env.NODE_ENV === "production") return "production";
  if (env.NODE_ENV === "test") return "test";
  if (env.NODE_ENV === "development" || env.NODE_ENV === undefined) return "development";
  return "unknown";
}

export function isStagingAppEnvironment(env: ProcessEnv = process.env) {
  return getAppEnvironment(env).toLowerCase() === "staging";
}
