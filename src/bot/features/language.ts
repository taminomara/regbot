import { Composer, GrammyError, InlineKeyboard } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { i18n, isMultipleLocales } from "#root/bot/i18n.js";
import { registerCommandHelpProvider } from "#root/bot/features/help.js";
import { BotCommand } from "@grammyjs/types";
import { createCallbackData } from "callback-data";
import ISO6391 from "iso-639-1";
import { chunk } from "#root/bot/helpers/keyboard.js";
import { logger } from "#root/logger.js";

export const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("language", logHandle("command-language"), async (ctx) => {
  return ctx.reply(ctx.t("language.select"), {
    reply_markup: await createChangeLanguageKeyboard(ctx),
  });
});

const changeLanguageData = createCallbackData("language", {
  code: String,
});

async function createChangeLanguageKeyboard(ctx: Context) {
  const currentLocaleCode = await ctx.i18n.getLocale();

  const getLabel = (code: string) => {
    const isActive = code === currentLocaleCode;

    return `${isActive ? "✅ " : ""}${ISO6391.getNativeName(code)}`;
  };

  return InlineKeyboard.from(
    chunk(
      i18n.locales.map((localeCode) => ({
        text: getLabel(localeCode),
        callback_data: changeLanguageData.pack({
          code: localeCode,
        }),
      })),
      2,
    ),
  );
}

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

    try {
      await ctx.editMessageText(ctx.t("language.changed"), {
        reply_markup: await createChangeLanguageKeyboard(ctx),
      });
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === 400) {
        if (error.description.includes("message is not modified")) {
          logger.debug("ignored MESSAGE_NOT_MODIFIED error");
        } else {
          logger.warn(error);
        }
      } else {
        throw error;
      }
    }
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
