import { Composer } from "grammy";
import { changeLanguageData } from "#root/bot/callback-data/index.js";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { i18n, isMultipleLocales } from "#root/bot/i18n.js";
import { createChangeLanguageKeyboard } from "#root/bot/keyboards/index.js";
import { registerCommandHelpProvider } from "#root/bot/features/help.js";
import { BotCommand } from "@grammyjs/types";

export const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("language", logHandle("command-language"), async (ctx) => {
  return ctx.reply(ctx.t("language.select"), {
    reply_markup: await createChangeLanguageKeyboard(ctx),
  });
});

feature.callbackQuery(
  changeLanguageData.filter(),
  logHandle("keyboard-language-select"),
  async (ctx) => {
    const { code: languageCode } = changeLanguageData.unpack(
      ctx.callbackQuery.data,
    );

    if (!i18n.locales.includes(languageCode)) {
      ctx.logger.error({
        msg: "unknown locale",
        languageCode,
      });
      return;
    }

    await ctx.i18n.setLocale(languageCode);

    return ctx.editMessageText(ctx.t("language.changed"), {
      reply_markup: await createChangeLanguageKeyboard(ctx),
    });
  },
);

registerCommandHelpProvider((localeCode: string): BotCommand[] => {
  return isMultipleLocales
    ? [
        {
          command: "language",
          description: i18n.t(localeCode, "language_command.description"),
        },
      ]
    : [];
});
