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

export const logger = pino({
  level: config.LOG_LEVEL,
  transport: {
    targets: [
      ...(config.isDev
        ? [
            {
              target: "pino-pretty",
              level: config.LOG_LEVEL,
              options: {
                ignore: "pid,hostname",
                colorize: true,
                translateTime: true,
              },
            },
          ]
        : [
            {
              target: "pino/file",
              level: config.LOG_LEVEL,
              options: {},
            },
          ]),
    ],
  },
  hooks: {
    logMethod(args, method, level) {
      metrics.logMessages.inc({
        level: logger.levels.labels[level] ?? `Level ${level}`,
      });
      return method.apply(this, args);
    },
  },
});

export type Logger = typeof logger;
