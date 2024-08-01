import { Middleware } from "grammy";

import type { Context } from "#root/bot/context.js";

export function errorReporter(): Middleware<Context> {
  return async (ctx, next) => {
    try {
      await next();
    } catch (e) {
      try {
        await ctx.reply(ctx.t("error_ocurred"), {
          message_thread_id: ctx.msg?.message_thread_id,
        });
      } catch {
        // nothing
      }

      throw e;
    }
  };
}
