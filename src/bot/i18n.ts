import path from "node:path";

import { I18n } from "#root/_messages.gen.js";
import type { Context } from "#root/bot/context.js";
import { config } from "#root/config.js";

export const i18n = new I18n<Context>({
  defaultLocale: config.DEFAULT_LOCALE,
  directory: path.resolve(process.cwd(), "locales"),
  useSession: true,
  fluentBundleOptions: {
    useIsolating: false,
  },
});

export const isMultipleLocales = i18n.locales.length > 1;
