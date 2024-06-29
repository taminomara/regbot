import { Composer } from "grammy";

import type { Context } from "#root/bot/context.js";
import { copyMessageToAdminGroupTopic } from "#root/bot/features/admin-group.js";
import { handleMessageEdit } from "#root/bot/features/edit-cache.js";
import { logHandle } from "#root/bot/helpers/logging.js";

export const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.on(
  "message::bot_command",
  logHandle("unhandled-command"),
  async (ctx) => {
    await ctx.reply(ctx.t("unhandled"), {
      reply_to_message_id: ctx.msgId,
    });
  },
);
feature.on(
  "edited_message",
  logHandle("unhandled-edited-message"),
  handleMessageEdit,
);
feature.on("message", logHandle("unhandled-message"), async (ctx) =>
  copyMessageToAdminGroupTopic(ctx),
);

feature.on("callback_query", logHandle("unhandled-callback-query"), (ctx) => {
  return ctx.answerCallbackQuery();
});
