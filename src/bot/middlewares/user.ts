import { Middleware } from "grammy";

import { getUserLite, updateUser } from "#root/backend/user.js";
import type { Context } from "#root/bot/context.js";
import { updateAdminGroupTopicTitle } from "#root/bot/features/admin-group.js";
import { logger } from "#root/logger.js";

export function user(): Middleware<Context> {
  return async (ctx, next) => {
    // `ctx.from` is empty for channel posts, so we use id of the @Channel_Bot.
    const userId = ctx.from?.id ?? 136_817_688;

    ctx.user = await getUserLite(userId);
    logger.debug({ msg: "Fetched user data", user: ctx.user });

    if (ctx.from?.username && ctx.user.username !== ctx.from?.username) {
      ctx.user.username = ctx.from?.username;
      await updateUser(ctx.user.id, { username: ctx.user.username });
      await updateAdminGroupTopicTitle(ctx, ctx.user);
    }

    await next();
  };
}
