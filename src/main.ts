#!/usr/bin/env tsx

import { createBot } from "#root/bot/index.js";
import { config } from "#root/config.js";
import { logger } from "#root/logger.js";
import {
  needsMigrations,
  runMigrations,
  shutDownConnection,
} from "#root/backend/data-source.js";
import { setCommands } from "#root/bot/features/help.js";

function onShutdown(cleanUp: () => Promise<void>) {
  let isShuttingDown = false;
  const handleShutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info("Shutdown");
    await cleanUp();
  };
  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);
}

async function startPolling() {
  const bot = createBot(config.BOT_TOKEN);

  // graceful shutdown
  onShutdown(async () => {
    await bot.stop();
    await shutDownConnection();
  });

  // start bot
  await bot.start({
    onStart: async ({ username }) => {
      await setCommands(bot);

      logger.info({
        msg: "Bot running...",
        username,
      });
    },
  });
}

try {
  if (config.isDev) {
    await runMigrations();
  } else if (await needsMigrations()) {
    logger.error({ msg: "Found unapplied migrations" });
    process.exit(1);
  }

  await startPolling();
} catch (error) {
  logger.error(error);
  process.exit(1);
}
