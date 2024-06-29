import { AutoChatActionFlavor } from "@grammyjs/auto-chat-action";
import { HydrateFlavor } from "@grammyjs/hydrate";
import { MenuFlavor } from "@grammyjs/menu";
import { ParseModeFlavor } from "@grammyjs/parse-mode";
import { Context as DefaultContext, SessionFlavor } from "grammy";

import { I18nFlavor } from "#root/_messages.js";
import { UserLite } from "#root/backend/user.js";
import { SessionData } from "#root/bot/sessions.js";
import { Logger } from "#root/logger.js";

type ExtendedContextFlavor = {
  logger: Logger;
  user: UserLite;
};

export type Context = ParseModeFlavor<
  HydrateFlavor<
    DefaultContext &
      ExtendedContextFlavor &
      SessionFlavor<SessionData> &
      I18nFlavor &
      AutoChatActionFlavor &
      MenuFlavor
  >
>;
