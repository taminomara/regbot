import { BotCommand } from "@grammyjs/types";
import { Composer } from "grammy";

import { UserStatus } from "#root/backend/entities/user.js";
import type { Context } from "#root/bot/context.js";
import { ensureHasAdminGroupTopic } from "#root/bot/features/admin-group.js";
import { registerCommandHelpProvider } from "#root/bot/features/help.js";
import { enterInterview } from "#root/bot/features/interview.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { i18n } from "#root/bot/i18n.js";

export const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("start", logHandle("command-start"), async (ctx) => {
  if (
    !("interview" in (await ctx.conversation.active())) &&
    (!ctx.user.finishedInitialSurvey ||
      ctx.user.status in [UserStatus.New, UserStatus.InterviewInProgress])
  ) {
    await ctx.reply(ctx.t("welcome"));
    await enterInterview(ctx);
  } else {
    await ensureHasAdminGroupTopic(ctx, ctx.user);
  }
});

registerCommandHelpProvider((localeCode: string): BotCommand[] => {
  return [
    {
      command: "start",
      description: i18n.t(localeCode, "start_command.description"),
    },
  ];
});
