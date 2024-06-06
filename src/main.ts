#!/usr/bin/env tsx
import {
  runMigrations,
  shutDownConnection,
} from "#root/backend/data-source.js";
import { createBot, onStart } from "#root/bot/index.js";
import { config } from "#root/config.js";
import { logger } from "#root/logger.js";
import { metricsServer } from "#root/metrics.js";

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
  const server = metricsServer.listen(config.METRICS_PORT);

  // graceful shutdown
  onShutdown(async () => {
    await bot.stop();
    await shutDownConnection();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // start bot
  await bot.start({ onStart: async () => onStart(bot) });
}

try {
  await runMigrations(); // TODO: backup db in prod?
  await startPolling();
} catch (error) {
  logger.error(error);
  process.exit(1);
}
