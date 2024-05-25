import { Middleware } from "grammy";
import type { Context } from "#root/bot/context.js";
import { RequestContext } from "@mikro-orm/core";
import { orm } from "#root/backend/data-source.js";

export function dataSource(): Middleware<Context> {
  return async (ctx, next) => {
    await RequestContext.create(orm.em, next, {
      loggerContext: {
        // @ts-expect-error this extraneous property will be picked up by the `MikroPicoLogger`.
        logger: ctx.logger,
      },
    });
  };
}
