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

export type SessionData = {
  // field?: string;
};

type ExtendedContextFlavor = {
  logger: Logger;
};

export type Context = ParseModeFlavor<
  HydrateFlavor<
    DefaultContext &
      ExtendedContextFlavor &
      SessionFlavor<SessionData> &
      I18nFlavor &
      AutoChatActionFlavor &
      ConversationFlavor
  >
>;

export type Conversation = DefaultConversation<Context>;
