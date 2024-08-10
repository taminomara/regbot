import { Composer } from "grammy";

import type { Context } from "#root/bot/context.js";
import { copyMessageToAdminGroupTopic } from "#root/bot/features/admin-group.js";
import { handleMessageEdit } from "#root/bot/features/edit-cache.js";
import { logHandle } from "#root/bot/helpers/logging.js";

export const composer = new Composer<Context>();

composer.command(
  ["cancel", "empty"],
  logHandle("unhandled:command:cancel-or-empty"),
  async (ctx) => {
    await ctx.reply(ctx.t("cant_perform_action_right_now"), {
      reply_to_message_id: ctx.msgId,
    });
  },
);
composer
  .on("message::bot_command")
  .filter((ctx) => ctx.msg?.text?.startsWith("/") ?? false)
  .use(logHandle("unhandled:command"), async (ctx) => {
    await ctx.reply(ctx.t("unhandled"), {
      reply_to_message_id: ctx.msgId,
    });
  });

const feature = composer.chatType("private");
feature.on(
  "edited_message",
  logHandle("unhandled:edited-message"),
  handleMessageEdit,
);
feature.on(
  "message",
  logHandle("unhandled:message"),
  copyMessageToAdminGroupTopic,
);
