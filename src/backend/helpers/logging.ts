import { DefaultLogger, LogContext, LoggerNamespace } from "@mikro-orm/core";

import { Logger as PicoLogger, logger } from "#root/logger.js";

export class MikroPicoLogger extends DefaultLogger {
  // eslint-disable-next-line class-methods-use-this
  log(namespace: LoggerNamespace, message: string, context?: LogContext) {
    const logger = MikroPicoLogger.getUpstreamLogger(context || {});

    const data = {
      msg: `ORM ${namespace}: ${message}`,
      query: context?.query,
      label: context?.label,
      params: context?.params,
      took: context?.took,
    };

    switch (context?.level ?? "debug") {
      case "debug":
      case "info": {
        logger.debug(data);
        break;
      }
      case "warning": {
        logger.warn(data);
        break;
      }
      case "error": {
        logger.error(data);
        break;
      }
    }
  }

  private static getUpstreamLogger(context: LogContext): PicoLogger {
    return context.logger ?? logger;
  }
}
