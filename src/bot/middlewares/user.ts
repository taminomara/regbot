import { Middleware } from "grammy";

import { getUserLite, updateUser } from "#root/backend/user.js";
import type { Context } from "#root/bot/context.js";
import { updateAdminGroupTopicTitle } from "#root/bot/features/admin-group.js";

export function user(): Middleware<Context> {
  return async (ctx, next) => {
    // `ctx.from` is empty for channel posts, so we use id of the @Channel_Bot.
    const userId = ctx.from?.id ?? 136_817_688;

    const name = ctx.from?.first_name
      ? [ctx.from.first_name, ctx.from.last_name]
          .filter((name) => name)
          .join(" ")
      : undefined;

    ctx.user = await getUserLite(userId, name);
    ctx.logger.debug({ msg: "Fetched user data", user: ctx.user });

    if (
      ctx.from !== undefined &&
      (ctx.user.username ?? null) !== ctx.from.username
    ) {
      ctx.user.username = ctx.from?.username ?? null;
      await updateUser(ctx.user.id, { username: ctx.user.username });
      await updateAdminGroupTopicTitle(ctx, ctx.user);
    }

    const locale = await ctx.i18n.getLocale();
    if (locale !== ctx.user.locale) {
      ctx.user.locale = locale;
      await updateUser(ctx.user.id, { locale });
    }

    await next();
  };
}
