import { createCallbackData } from "callback-data";
import { Composer, InlineKeyboard } from "grammy";
import ISO6391 from "iso-639-1";

import { updateUser } from "#root/backend/user.js";
import type { Context } from "#root/bot/context.js";
import {
  CommandPrivileges,
  CommandScope,
  registerCommandHelp,
} from "#root/bot/features/help.js";
import { editMessageTextSafe } from "#root/bot/helpers/edit-text.js";
import { chunk } from "#root/bot/helpers/keyboard.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { i18n, isMultipleLocales } from "#root/bot/i18n.js";

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

    const locale = await ctx.i18n.getLocale();
    await updateUser(ctx.user.id, { locale });

    await editMessageTextSafe(ctx, ctx.t("language.changed"), {
      reply_markup: await createChangeLanguageKeyboard(ctx),
    });
  },
);

if (isMultipleLocales) {
  registerCommandHelp({
    command: "language",
    scope: CommandScope.PrivateChat,
    privileges: CommandPrivileges.AllUsers,
  });
}
