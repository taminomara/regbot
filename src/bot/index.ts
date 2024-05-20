import { autoChatAction } from "@grammyjs/auto-chat-action";
import { hydrate } from "@grammyjs/hydrate";
import { hydrateReply, parseMode } from "@grammyjs/parse-mode";
import {
  StorageAdapter,
  Bot as TelegramBot,
  session,
  ErrorHandler,
} from "grammy";
import { Context, SessionData } from "#root/bot/context.js";
import { composer as featuresComposer } from "#root/bot/features/index.js";
import { i18n } from "#root/bot/i18n.js";
import { updateLogger, logger } from "#root/bot/middlewares/index.js";
import { config } from "#root/config.js";
import { getUpdateInfo } from "#root/bot/helpers/logging.js";
import { conversations } from "@grammyjs/conversations";
import { composer as conversationsComposer } from "#root/bot/conversations/index.js";

type Options = {
  sessionStorage?: StorageAdapter<SessionData>;
};

const errorHandler: ErrorHandler<Context> = (error) => {
  const { ctx } = error;

  ctx.logger.error({
    err: error.error,
    update: getUpdateInfo(ctx),
  });
};

export function createBot(token: string, options: Options = {}) {
  const { sessionStorage } = options;

  const bot = new TelegramBot<Context>(token);
  const protectedBot = bot.errorBoundary(errorHandler);

  // Middlewares
  bot.api.config.use(parseMode("HTML"));

  protectedBot.use(logger());
  if (config.isDev) {
    protectedBot.use(updateLogger());
  }

  protectedBot.use(autoChatAction(bot.api));
  protectedBot.use(hydrateReply);
  protectedBot.use(hydrate());
  protectedBot.use(
    session({
      initial: () => ({}),
      storage: sessionStorage,
    }),
  );
  protectedBot.use(conversations());
  protectedBot.use(i18n);

  // Handlers
  protectedBot.use(conversationsComposer);
  protectedBot.use(featuresComposer);

  return bot;
}

export type Bot = ReturnType<typeof createBot>;
