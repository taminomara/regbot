import { autoChatAction } from "@grammyjs/auto-chat-action";
import { conversations } from "@grammyjs/conversations";
import { hydrate } from "@grammyjs/hydrate";
import { hydrateReply, parseMode } from "@grammyjs/parse-mode";
import { ErrorHandler, Bot as TelegramBot, session } from "grammy";

import { Context, SessionData } from "#root/bot/context.js";
import { composer as featuresComposer } from "#root/bot/features/index.js";
import { getUpdateInfo } from "#root/bot/helpers/logging.js";
import { SessionStorage } from "#root/bot/helpers/session-storage.js";
import { i18n } from "#root/bot/i18n.js";
import {
  apiLogger,
  dataSource,
  logger,
  updateLogger,
  user,
} from "#root/bot/middlewares/index.js";
import { config } from "#root/config.js";

const errorHandler: ErrorHandler<Context> = (error) => {
  const { ctx } = error;

  ctx.logger.error({
    err: error.error,
    update: getUpdateInfo(ctx),
  });
};

function getSessionKey(ctx: Omit<Context, "session">) {
  return ctx.chatId === config.ADMIN_GROUP
    ? `${ctx.chatId}/${ctx.msg?.message_thread_id}`
    : ctx.chat?.id.toString();
}

export function createBot(token: string) {
  const bot = new TelegramBot<Context>(token);

  bot.use(logger());
  if (config.isDev) {
    bot.use(updateLogger());
    bot.api.config.use(apiLogger());
  }

  bot.api.config.use(parseMode("HTML"));

  const protectedBot = bot.errorBoundary(errorHandler);

  // Middlewares

  protectedBot.use(dataSource());
  protectedBot.use(autoChatAction(bot.api));
  protectedBot.use(hydrateReply);
  protectedBot.use(hydrate());
  protectedBot.use(
    session<SessionData, Context>({
      initial: (): SessionData => ({}),
      storage: new SessionStorage(),
      getSessionKey,
    }),
  );
  protectedBot.use(conversations());
  protectedBot.use(i18n);
  protectedBot.use(user());

  // Handlers
  protectedBot.use(featuresComposer);

  return bot;
}

export type Bot = ReturnType<typeof createBot>;
