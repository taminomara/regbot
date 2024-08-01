import { Middleware } from "grammy";
import { performance } from "node:perf_hooks";
import { Counter, Gauge, Histogram, exponentialBuckets } from "prom-client";

import type { Context } from "#root/bot/context.js";
import { getUpdateInfo } from "#root/bot/helpers/logging.js";
import { config } from "#root/config.js";

const metrics = {
  updatesStarted: new Counter({
    name: "tg_updates_started_count",
    help: "Number of updates that started processing",
  }),
  updatesFinished: new Counter({
    name: "tg_updates_finished_count",
    help: "Number of updates that finished processing",
  }),
  updatesInFlight: new Gauge({
    name: "tg_updates_inflight",
    help: "Number of updates that are currently in flight",
  }),
  updatesProcessingTimeMs: new Histogram({
    name: "tg_updates_processing_time_ms",
    help: "Time it took to process an update, in milliseconds.",
    buckets: exponentialBuckets(10, 2, 11),
  }),
};

export function updateLogger(): Middleware<Context> {
  return async (ctx, next) => {
    metrics.updatesInFlight.inc();
    metrics.updatesStarted.inc();

    ctx.logger.info({
      msg: "Update received",
      ...(config.isDev ? { update: getUpdateInfo(ctx) } : {}),
    });

    const startTime = performance.now();
    try {
      await next();
    } finally {
      const endTime = performance.now();
      const elapsed = endTime - startTime;

      metrics.updatesInFlight.dec();
      metrics.updatesFinished.inc();
      metrics.updatesProcessingTimeMs.observe(elapsed);

      ctx.logger.info({
        msg: "Update processed",
        elapsed,
      });
    }
  };
}
