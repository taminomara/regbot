import { AutoChatActionFlavor } from "@grammyjs/auto-chat-action";
import {
  ConversationFlavor,
  Conversation as DefaultConversation,
} from "@grammyjs/conversations";
import { HydrateFlavor } from "@grammyjs/hydrate";
import { I18nFlavor } from "@grammyjs/i18n";
import { MenuFlavor } from "@grammyjs/menu";
import { ParseModeFlavor } from "@grammyjs/parse-mode";
import { Context as DefaultContext, SessionFlavor } from "grammy";

import { UserLite } from "#root/backend/user.js";
import { Logger } from "#root/logger.js";

export type SessionData = {
  // field?: string;
};

type ExtendedContextFlavor = {
  logger: Logger;
  user: UserLite;
  interviewEditData?: {
    userId: number;
    menuChatId?: number;
    menuMessageId?: number;
  };
};

export type Context = ParseModeFlavor<
  HydrateFlavor<
    DefaultContext &
      ExtendedContextFlavor &
      SessionFlavor<SessionData> &
      I18nFlavor &
      AutoChatActionFlavor &
      ConversationFlavor &
      MenuFlavor
  >
>;

export type Conversation = DefaultConversation<Context>;
