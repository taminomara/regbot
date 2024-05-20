import { Middleware } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logger as rootLogger } from "#root/logger.js";

export function logger(): Middleware<Context> {
  return async (ctx, next) => {
    ctx.logger = rootLogger.child({
      update_id: ctx.update.update_id,
    });
    await next();
  };
}
