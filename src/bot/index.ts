import { autoChatAction } from "@grammyjs/auto-chat-action";
import { hydrate } from "@grammyjs/hydrate";
import { hydrateReply, parseMode } from "@grammyjs/parse-mode";
import { RequestContext } from "@mikro-orm/core";
import { Bot, ErrorHandler, Bot as TelegramBot } from "grammy";
import { Counter } from "prom-client";

import { orm } from "#root/backend/data-source.js";
import { createUser, updateUser } from "#root/backend/user.js";
import { Context } from "#root/bot/context.js";
import { startBackgroundProcess } from "#root/bot/features/event-reminders.js";
import { setCommands } from "#root/bot/features/help.js";
import { composer as featuresComposer } from "#root/bot/features/index.js";
import { getUpdateInfo } from "#root/bot/helpers/logging.js";
import { i18n } from "#root/bot/i18n.js";
import {
  autoRetry as autoRetryMw,
  dataSource as dataSourceMw,
  errorReporter as errorReporterMw,
  logger as loggerMw,
  updateLogger as updateLoggerMw,
  user as userMw,
} from "#root/bot/middlewares/index.js";
import { session } from "#root/bot/sessions.js";
import { config } from "#root/config.js";
import { logger } from "#root/logger.js";

const metrics = {
  errors: new Counter({
    name: "tg_updates_processing_errors_count",
    help: "Number of update processing errors",
  }),
};

const errorHandler: ErrorHandler<Context> = (error) => {
  const { ctx } = error;
  metrics.errors.inc();
  ctx.logger.error({
    err: error.error,
    update: getUpdateInfo(ctx),
  });
};

export function createBot(token: string) {
  const bot = new TelegramBot<Context>(token);

  bot.api.config.use(autoRetryMw({ maxRetryAttempts: 100 }));
  bot.api.config.use(parseMode("HTML"));

  const protectedBot = bot.errorBoundary(errorHandler);

  // Middlewares

  protectedBot.use(loggerMw());
  protectedBot.use(updateLoggerMw());
  protectedBot.use(dataSourceMw());
  protectedBot.use(errorReporterMw());
  protectedBot.use(autoChatAction(bot.api));
  protectedBot.use(hydrateReply);
  protectedBot.use(hydrate());
  protectedBot.use(session());
  protectedBot.use(i18n);
  protectedBot.use(userMw());

  // Handlers
  protectedBot.use(featuresComposer);

  return bot;
}

export async function onStart(bot: Bot<Context>) {
  await RequestContext.create(orm.em, async () => {
    await setCommands(bot);
    await createUser(bot.botInfo.id);
    await updateUser(bot.botInfo.id, {
      name: bot.botInfo.first_name,
      username: bot.botInfo.username,
      locale: config.DEFAULT_LOCALE,
      pronouns: "they/she/it",
      gender: "machine",
      sexuality: "pansexual",
    });
    await orm.em.flush();
    startBackgroundProcess(bot);
    logger.info({
      msg: "Bot running...",
      id: bot.botInfo.id,
      username: bot.botInfo.username,
    });
  });
}
