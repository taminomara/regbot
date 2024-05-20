import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { registerCommandHelpProvider } from "#root/bot/features/help.js";
import { BotCommand } from "@grammyjs/types";
import { i18n } from "#root/bot/i18n.js";
import { enterInitialSurvey } from "#root/bot/conversations/index.js";

export const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("start", logHandle("command-start"), async (ctx) => {
  await ctx.reply(ctx.t("welcome"));
  await enterInitialSurvey(ctx);
});

registerCommandHelpProvider((localeCode: string): BotCommand[] => {
  return [
    {
      command: "start",
      description: i18n.t(localeCode, "start_command.description"),
    },
  ];
});
