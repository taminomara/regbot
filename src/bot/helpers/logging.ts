import type { Update } from "@grammyjs/types";
import { Middleware } from "grammy";

import type { Context } from "#root/bot/context.js";

/**
 * Extracts detailed update info from context.
 */
export function getUpdateInfo(ctx: Context): Omit<Update, "update_id"> {
  // eslint-disable-next-line camelcase, @typescript-eslint/no-unused-vars
  const { update_id, ...update } = ctx.update;

  return update;
}

/**
 * A utility for logging commands and messages that arrive to the bot.
 *
 * @example
 *
 * ```ts
 * feature.command(
 *     "start",
 *     logHandle("command-start"),
 *     // ...other handles
 * );
 * ```
 *
 * */
export function logHandle(id: string): Middleware<Context> {
  return (ctx, next) => {
    ctx.logger.info({
      msg: `Handle "${id}"`,
      ...(id.startsWith("unhandled") ? { update: getUpdateInfo(ctx) } : {}),
    });

    return next();
  };
}
