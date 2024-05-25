import { performance } from "node:perf_hooks";
import { Middleware, Transformer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { getUpdateInfo } from "#root/bot/helpers/logging.js";
import { logger } from "#root/logger.js";

export function updateLogger(): Middleware<Context> {
  return async (ctx, next) => {
    ctx.logger.debug({
      msg: "Update received",
      update: getUpdateInfo(ctx),
    });

    const startTime = performance.now();
    try {
      await next();
    } finally {
      const endTime = performance.now();
      ctx.logger.debug({
        msg: "Update processed",
        elapsed: endTime - startTime,
      });
    }
  };
}

export function apiLogger(): Transformer {
  return (previous, method, payload, signal) => {
    logger.debug({
      msg: "Bot API call",
      method,
      payload,
    });

    return previous(method, payload, signal);
  };
}
