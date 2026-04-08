import pino from "pino";

import { isDev, isTest } from "./config";

const loggerOptions: pino.LoggerOptions = {
  serializers: { error: pino.stdSerializers.err },
  transport: { target: "pino-pretty" },
};
let logLevel: pino.LevelWithSilentOrString = process.env.LOG_LEVEL || "info";

if (isDev) {
  logLevel = process.env.LOG_LEVEL || "trace";
} else if (isTest) {
  logLevel = process.env.LOG_LEVEL || "warn";
}

export const logger = pino(loggerOptions);
logger.level = logLevel;
