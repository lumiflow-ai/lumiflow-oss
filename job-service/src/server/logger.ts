import pino from "pino";

import { isDev, isTest } from "./config";

let loggerOptions: pino.LoggerOptions = {};
let logLevel: pino.LevelWithSilentOrString = process.env.LOG_LEVEL || "info";

if (isDev) {
  loggerOptions = { transport: { target: "pino-pretty" } };
  logLevel = process.env.LOG_LEVEL || "trace";
} else if (isTest) {
  loggerOptions = { transport: { target: "pino-pretty" } };
  logLevel = process.env.LOG_LEVEL || "warn";
}

export const logger = pino(loggerOptions);
logger.level = logLevel;
