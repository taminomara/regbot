// @ts-expect-error there's some type fuckery going on that I don't care to fix right now
import { FluentDateTime } from "@grammyjs/i18n/node_modules/@fluent/bundle/index.js";

import { config } from "#root/config.js";

export function toFluentDateTime(date: Date) {
  return new FluentDateTime(date.getTime(), {
    timeZone: config.TIMEZONE,
  });
}
