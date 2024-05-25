import { Context as DefaultContext, SessionFlavor } from "grammy";
import { AutoChatActionFlavor } from "@grammyjs/auto-chat-action";
import { HydrateFlavor } from "@grammyjs/hydrate";
import { I18nFlavor } from "@grammyjs/i18n";
import { ParseModeFlavor } from "@grammyjs/parse-mode";
import { Logger } from "#root/logger.js";
import {
  ConversationFlavor,
  Conversation as DefaultConversation,
} from "@grammyjs/conversations";
import { UserLite } from "#root/backend/user.js";
import { MenuFlavor } from "@grammyjs/menu";

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
