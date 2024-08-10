import { GrammyError, Middleware } from "grammy";

import type { Context } from "#root/bot/context.js";
import { logger } from "#root/logger.js";

export function errorReporter(): Middleware<Context> {
  return async (ctx, next) => {
    try {
      await next();
    } catch (e) {
      if (e instanceof GrammyError && e.method === "answerCallbackQuery") {
        logger.error(e);
        return; // ignore callback query answering failures.
      }

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
