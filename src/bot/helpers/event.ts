import moment from "moment-timezone";
import { isDate } from "util/types";

import { EventPayment } from "#root/backend/entities/event.js";
import { Event, EventWithSignup } from "#root/backend/event.js";
import { config } from "#root/config.js";

import { Context } from "../context.js";
import { toFluentDateTime } from "./i18n.js";
import { signupLink } from "./links.js";
import { sanitizeHtmlOrEmpty } from "./sanitize-html.js";

// TODO: make it not hardcoded
export const DEFAULT_EVENT_TEXT = `
<b>{ title }</b>

Следующий квартирник будет { date | D MMMM }!

Что будет: уютная кинки-секс-квирная тусовочка. У нас правило активного согласия, БДР и 4C 🥰 Для ЛГБТ людей и союзников.
- Сбор в { date | HH:mm }, круг знакомств в { datePlus1h | HH:mm }.
- Будет тусовочно-общательное место aka кухня-гостиная, комната для тихих практик (обнимашки, шибари, воск), комната для более громких практик (секс, порка, и вот это вот всё).
- У нас есть точка подвеса!
- Разрешены все БДСМ практики кроме игр с дыханием.
- В наличии есть душ.
- Правила вечеринки: <a href="https://t.me/regbot?rulesLink">смотри тут</a>.

Где и когда: { date | dddd, D MMMM }, с { date | HH:mm } и до утра. Тбилиси, район Ваке, 20 минут пешком от Руставели.

Вход: { price }.

Регистрация <a href="https://t.me/regbot?signupLink">по ссылке</a>.

Приходите, берите с собой девайсы и хорошее настроение)
`.trim();

export function formatEventTitleForMenu(ctx: Context, event: EventWithSignup) {
  let titlePrefix = "";
  if (event.cancelled) {
    titlePrefix = `${ctx.t("event.title_cancelled_prefix")} `;
  } else if (event.dateChanged) {
    titlePrefix = `${ctx.t("event.title_date_change_prefix")} `;
  }
  if (event.signup !== undefined) {
    titlePrefix += `${ctx.t("event.title_signup_prefix", { status: event.signup.status })} `;
  }

  return ctx.t("event.title_with_date", {
    title: event.name,
    date: toFluentDateTime(event.date),
    titlePrefix,
  });
}

function formatEventTitleForPost(ctx: Context, event: Event) {
  let titlePrefix = "";
  if (event.cancelled) {
    titlePrefix = `${ctx.t("event.title_cancelled_prefix")} `;
  } else if (event.dateChanged) {
    titlePrefix = `${ctx.t("event.title_date_change_prefix")} `;
  }

  return ctx.t("event.title", {
    title: event.name,
    titlePrefix,
  });
}

export function formatEventText(ctx: Context, event: Event) {
  return simpleTemplate(event.announceTextHtml, {
    title: formatEventTitleForPost(ctx, event),
    date: event.date,
    datePlus30m: moment(event.date).add({ minutes: 30 }).toDate(),
    datePlus1h: moment(event.date).add({ hours: 1 }).toDate(),
    rulesLink:
      "https://taminomara.notion.site/1f06a005adb344ffb0f3be28804bbd9f", // TODO: make it not hardcoded (here and in locales)
    signupLink: signupLink(ctx.me.username, event.id),
    price: formatEventPrice(ctx, event),
  });
}

function formatEventPrice(ctx: Context, event: Event) {
  switch (event.payment) {
    case EventPayment.NotRequired:
      return ctx.t("event.free");
    case EventPayment.Donation:
      if (event.price === null) {
        return ctx.t("event.free_donation");
      } else {
        return sanitizeHtmlOrEmpty(event.price);
      }
    case EventPayment.Required:
      return sanitizeHtmlOrEmpty(event.price);
  }
}

export function simpleTemplate(
  template: string,
  data: Record<string, string | number | Date>,
): string {
  return template
    .replaceAll(
      /\{\s*([a-zA-Z0-9]+)\s*(?:\|\s*([^}]+)\s*)?\}|(\{\{)|(\}\})/gm,
      (_, name, format, lbrace, rbrace) => {
        if (lbrace !== undefined) return "{";
        if (rbrace !== undefined) return "}";
        const val = data[name];
        if (!val) return "";
        if (isDate(val))
          return moment
            .utc(val)
            .locale(config.DEFAULT_LOCALE)
            .tz(config.TIMEZONE)
            .format(format ?? "dd, DD.MM HH:MM")
            .trim();
        return val.toString();
      },
    )
    .replaceAll(/https:\/\/t.me\/regbot\?([a-zA-Z0-9]+)/gm, (_, name) =>
      data[name].toString(),
    );
}
