import { BotCommand } from "@grammyjs/types";

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
