import { pino } from "pino";
import { Counter } from "prom-client";

import { config } from "#root/config.js";
import { redactBotToken } from "#root/helpers/redact.js";

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

// Strip the bot token from every serialized line before it is written anywhere.
const redacted = (
  destination: pino.DestinationStream,
): pino.DestinationStream => ({
  write: (line) => destination.write(redactBotToken(line, config.BOT_TOKEN)),
});

const stream = logFile
  ? pino.multistream([
      { stream: redacted(logFile) },
      { stream: redacted(stderrFile) },
    ])
  : redacted(stderrFile);

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
