import { Context } from "#root/bot/context.js";

export function withPayload(
  text:
    | string
    | ((ctx: Context) => string | Promise<string>)
    | (() => string | Promise<string>),
) {
  return {
    text,
    payload: (ctx: Context) => String(ctx.match),
  };
}
