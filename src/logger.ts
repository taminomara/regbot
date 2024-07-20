import { pino } from "pino";
import { Counter } from "prom-client";

import { config } from "#root/config.js";

const metrics = {
  logMessages: new Counter({
    name: "log_messages_count",
    help: "Number of logged messages",
    labelNames: ["level"] as const,
  }),
};

const logFile = config.LOG_FILE ? pino.destination(config.LOG_FILE) : undefined;
const stderrFile = pino.transport(
  config.isDev
    ? {
        target: "pino-pretty",
        options: {
          ignore: "pid,hostname",
          colorize: true,
          translateTime: true,
        },
      }
    : {
        target: "pino/file",
        options: {},
      },
);

const stream = logFile ? pino.multistream([logFile, stderrFile]) : stderrFile;

export const logger = pino(
  {
    level: config.LOG_LEVEL,
    hooks: {
      logMethod(args, method, level) {
        metrics.logMessages.inc({
          level: logger.levels.labels[level] ?? `Level ${level}`,
        });
        return method.apply(this, args);
      },
    },
  },
  stream,
);

export type Logger = typeof logger;

export function reopenLogFile() {
  if (logFile) logFile.reopen();
}
