import { Context } from "#root/bot/context.js";

export function withPayload(
  text: string | ((ctx: Context) => string) | (() => string),
) {
  return {
    text,
    payload: (ctx: Context) => String(ctx.match),
  };
}
