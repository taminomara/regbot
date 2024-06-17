import { AutoChatActionFlavor } from "@grammyjs/auto-chat-action";
import {
  ConversationFlavor,
  Conversation as DefaultConversation,
} from "@grammyjs/conversations";
import { HydrateFlavor } from "@grammyjs/hydrate";
import { MenuFlavor } from "@grammyjs/menu";
import { ParseModeFlavor } from "@grammyjs/parse-mode";
import { Context as DefaultContext, SessionFlavor } from "grammy";

import { I18nFlavor } from "#root/_messages.gen.js";
import { UserLite } from "#root/backend/user.js";
import { Logger } from "#root/logger.js";

export type SessionData = {
  // field?: string;
};

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
      ConversationFlavor &
      MenuFlavor
  >
>;

export type Conversation = DefaultConversation<Context>;
