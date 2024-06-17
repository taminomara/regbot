import { BotCommand } from "@grammyjs/types";
import type { BotCommandScope } from "@grammyjs/types/settings.js";
import { Bot } from "grammy";

import { Context } from "#root/bot/context.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

export type CommandHelp = {
  command: string;
  scope: CommandScope;
  privileges: CommandPrivileges;
};

export enum CommandScope {
  PrivateChat,
  AdminGroup,
  MembersGroup,
}

export enum CommandPrivileges {
  AllUsers = 1,
  Admins = 2,
}

const COMMANDS: CommandHelp[] = [];

export function registerCommandHelp(...commands: CommandHelp[]) {
  COMMANDS.push(...commands);
}

function getCommands(
  scope: CommandScope,
  privileges: CommandPrivileges,
  locale: string,
): BotCommand[] {
  return COMMANDS.filter(
    (command) => command.scope === scope && command.privileges <= privileges,
  ).map(({ command }) => {
    return {
      command,
      description: i18n.translate(locale, `${command}_command.description`),
    };
  });
}

async function setCommandsFor(
  bot: Bot<Context>,
  tgScopes: BotCommandScope[],
  scope: CommandScope,
  privileges: CommandPrivileges,
) {
  const promises = tgScopes.flatMap((tgScope) => [
    bot.api.setMyCommands(
      getCommands(scope, privileges, config.DEFAULT_LOCALE),
      { scope: tgScope },
    ),
    ...i18n.locales.map((locale) =>
      bot.api.setMyCommands(
        getCommands(scope, privileges, config.DEFAULT_LOCALE),
        {
          language_code: locale,
          scope: tgScope,
        },
      ),
    ),
  ]);

  await Promise.all(promises);
}

export async function setCommands(bot: Bot<Context>) {
  // Private chats.
  await setCommandsFor(
    bot,
    [{ type: "all_private_chats" }],
    CommandScope.PrivateChat,
    CommandPrivileges.AllUsers,
  );
  await setCommandsFor(
    bot,
    config.BOT_ADMINS.map((id) => {
      return { type: "chat", chat_id: id };
    }),
    CommandScope.PrivateChat,
    CommandPrivileges.Admins,
  );

  // Members group.
  await setCommandsFor(
    bot,
    [{ type: "chat", chat_id: config.MEMBERS_GROUP }],
    CommandScope.MembersGroup,
    CommandPrivileges.AllUsers,
  );
  await setCommandsFor(
    bot,
    [{ type: "chat_administrators", chat_id: config.MEMBERS_GROUP }],
    CommandScope.MembersGroup,
    CommandPrivileges.Admins,
  );

  // Admin group.
  await setCommandsFor(
    bot,
    [{ type: "chat", chat_id: config.ADMIN_GROUP }],
    CommandScope.AdminGroup,
    CommandPrivileges.AllUsers,
  );
  await setCommandsFor(
    bot,
    [{ type: "chat_administrators", chat_id: config.ADMIN_GROUP }],
    CommandScope.AdminGroup,
    CommandPrivileges.Admins,
  );
}
