import { BotCommand } from "@grammyjs/types";
import { Bot } from "grammy";

import { Context } from "#root/bot/context.js";
import { i18n, isMultipleLocales } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

export type CommandHelpProvider = (
  localeCode: string,
  isAdmin: boolean,
) => BotCommand[];

const providers: CommandHelpProvider[] = [];

export const registerCommandHelpProvider = (provider: CommandHelpProvider) => {
  providers.push(provider);
};

export const getCommands = (
  localeCode: string,
  isAdmin: boolean,
): BotCommand[] => {
  return providers.flatMap((provider) => provider(localeCode, isAdmin));
};

export async function setCommands(bot: Bot<Context>) {
  // Set default commands for all users.
  await bot.api.setMyCommands(getCommands(config.DEFAULT_LOCALE, false), {
    scope: { type: "all_private_chats" },
  });
  if (isMultipleLocales) {
    const requests = i18n.locales.map((code) =>
      bot.api.setMyCommands(getCommands(code, false), {
        language_code: code,
        scope: {
          type: "all_private_chats",
        },
      }),
    );

    await Promise.all(requests);
  }

  // Set admin commands for admins.
  const requests = config.BOT_ADMINS.map((id) =>
    bot.api.setMyCommands(getCommands(config.DEFAULT_LOCALE, true), {
      scope: {
        type: "chat",
        chat_id: id,
      },
    }),
  );
  await Promise.all(requests);
}
