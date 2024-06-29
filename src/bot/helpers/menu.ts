import { Context } from "#root/bot/context.js";

/**
 * Run a callback with patched context.
 */
export async function patchCtx(
  ctx: Context,
  options: {
    match?: string | number;
    locale?: string;
  },
  callback: (ctx: Context) => void | Promise<void>,
) {
  const lastMatch = ctx.match;
  const lastLocale = await ctx.i18n.getLocale();
  try {
    if (options.match) ctx.match = String(options.match);
    if (options.locale) await ctx.i18n.setLocale(options.locale);
    await callback(ctx);
  } finally {
    if (options.match) ctx.match = lastMatch;
    if (options.locale) await ctx.i18n.setLocale(lastLocale);
  }
}
