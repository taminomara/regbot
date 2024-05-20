import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { isAdmin } from "#root/bot/filters/index.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { BotCommand } from "@grammyjs/types";
import { i18n, isMultipleLocales } from "#root/bot/i18n.js";
import {
  getCommands,
  registerCommandHelpProvider,
} from "#root/bot/features/help.js";
import { config } from "#root/config.js";

export const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

feature.command(
  "setcommands",
  logHandle("command-setcommands"),
  chatAction("typing"),
  async (ctx: Context) => {
    const DEFAULT_LANGUAGE_CODE = "ru";

    // Set default commands for all users.
    await ctx.api.setMyCommands(getCommands(DEFAULT_LANGUAGE_CODE, false), {
      scope: { type: "all_private_chats" },
    });
    if (isMultipleLocales) {
      const requests = i18n.locales.map((code) =>
        ctx.api.setMyCommands(getCommands(DEFAULT_LANGUAGE_CODE, false), {
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
      ctx.api.setMyCommands(getCommands(DEFAULT_LANGUAGE_CODE, true), {
        scope: {
          type: "chat",
          chat_id: id,
        },
      }),
    );
    await Promise.all(requests);

    return ctx.reply(ctx.t("admin.commands-updated"));
  },
);

registerCommandHelpProvider(
  (localeCode: string, isAdmin: boolean): BotCommand[] => {
    if (!isAdmin) return [];
    return [
      {
        command: "setcommands",
        description: i18n.t(localeCode, "setcommands_command.description"),
      },
    ];
  },
);
