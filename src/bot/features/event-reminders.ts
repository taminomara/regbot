import { createCallbackData } from "callback-data";
import { Bot, Composer, InlineKeyboard } from "grammy";

import { EventPayment } from "#root/backend/entities/event.js";
import {
  Event,
  PopulatedEventSignup,
  lockEventForSendingReminders,
  updateEventSignup,
} from "#root/backend/event.js";
import { Context } from "#root/bot/context.js";
import { withdrawSignup } from "#root/bot/features/event-signup.js";
import { isApproved } from "#root/bot/filters/is-approved.js";
import { toFluentDateTime } from "#root/bot/helpers/i18n.js";
import { sanitizeHtmlOrEmpty } from "#root/bot/helpers/sanitize-html.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";
import { logger } from "#root/logger.js";

export const composer = new Composer<Context>();

const feature = composer.filter(isApproved);

async function delay(timeMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeMs);
  });
}

let process: BackgroundProcess | undefined;

export function startBackgroundProcess(bot: Bot<Context>) {
  if (process !== undefined) {
    throw new Error("trying to start more than one background process");
  }

  process = new BackgroundProcess(bot);
}

export async function stopBackgroundProcess() {
  if (process === undefined) {
    throw new Error("background process is not running");
  }

  await process.stop();
}

class BackgroundProcess {
  private bot: Bot<Context>;
  private aborting = false;
  private abortPromise: Promise<void>;
  private resolveAbort: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private timeoutId?: any;

  constructor(bot: Bot<Context>) {
    this.bot = bot;
    this.abortPromise = new Promise((resolve) => {
      this.resolveAbort = resolve;
    });
    this.scheduleNext(1000);
  }

  stop(): Promise<void> {
    this.aborting = true;

    if (this.timeoutId !== undefined) {
      // We're idling. Clear the timeout and return immediately.
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
      this.resolveAbort();
    } else {
      // We're not idling. Set the abort flag and wait
      // till the current operation finishes.
    }

    return this.abortPromise;
  }

  private scheduleNext(timeoutMs: number) {
    if (this.timeoutId !== undefined) {
      logger.error("WTF?");
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(
      async (bp) => bp.processReminders(),
      timeoutMs,
      this,
    );
  }

  private async processReminders() {
    this.timeoutId = undefined;

    let hasErrors = false;

    try {
      await this.processEventReminders();
    } catch (error) {
      logger.error(error, "Error when sending event reminders");
      hasErrors = true;
    }

    if (this.aborting) {
      this.resolveAbort();
    } else {
      this.scheduleNext(
        Math.random() * 2500 +
          (hasErrors ? 5000 : config.BACKGROUND_TASK_FREQUENCY_MS),
      );
    }
  }

  private async processEventReminders() {
    const toProcess = await lockEventForSendingReminders();
    if (toProcess !== null) {
      const { event, signups } = toProcess;

      logger.info({
        msg: "Processing event reminders",
        eventId: event.id,
        numSignups: signups.length,
      });

      await this.sendEventReminder(event);
      await Promise.all(
        signups.map((signup) => this.sendSignupReminder(signup)),
      );
    }
  }

  private async sendEventReminder(event: Event) {
    await delay(Math.random() * 1000);
    try {
      await this.bot.api.sendMessage(
        config.MEMBERS_GROUP,
        i18n.t(config.DEFAULT_LOCALE, "event_reminders.event_reminder", {
          eventId: String(event.id),
          name: sanitizeHtmlOrEmpty(event.name),
          date: toFluentDateTime(event.date),
          botUsername: this.bot.botInfo.username,
        }),
      );
    } catch (error) {
      logger.error(error, "Error when sending event reminder");
    }
  }

  private async sendSignupReminder(signup: PopulatedEventSignup) {
    await delay(1000 + Math.random() * 5000);
    try {
      let more = signup.event.reminderTextHtml ?? "";
      if (signup.event.payment === EventPayment.Donation) {
        if (more.length > 0) more += "\n\n";
        if (signup.event.price !== null) {
          more += i18n.t(
            signup.user.locale ?? config.DEFAULT_LOCALE,
            "event_reminders.payment_details_with_price",
            {
              price: sanitizeHtmlOrEmpty(signup.event.price),
              iban: sanitizeHtmlOrEmpty(
                signup.event.iban ?? config.PAYMENT_IBAN,
              ),
              recipient: sanitizeHtmlOrEmpty(
                signup.event.recipient ?? config.PAYMENT_RECIPIENT,
              ),
            },
          );
        } else {
          more += i18n.t(
            signup.user.locale ?? config.DEFAULT_LOCALE,
            "event_reminders.payment_details",
            {
              iban: sanitizeHtmlOrEmpty(
                signup.event.iban ?? config.PAYMENT_IBAN,
              ),
              recipient: sanitizeHtmlOrEmpty(
                signup.event.recipient ?? config.PAYMENT_RECIPIENT,
              ),
            },
          );
        }
      }

      await this.bot.api.sendMessage(
        signup.user.id,
        i18n.t(
          signup.user.locale ?? config.DEFAULT_LOCALE,
          "event_reminders.signup_reminder",
          {
            name: sanitizeHtmlOrEmpty(signup.event.name),
            date: toFluentDateTime(signup.event.date),
            more,
          },
        ),
        {
          reply_markup: makeSignupReminderKeyboard(
            signup.event.id,
            signup.user.locale ?? config.DEFAULT_LOCALE,
          ),
        },
      );
    } catch (error) {
      logger.error(error, "Error when sending signup reminder");
    }
  }
}

const willBeThereData = createCallbackData("willBeThere", {
  eventId: Number,
});
const cantMakeItData = createCallbackData("cantMakeIt", {
  eventId: Number,
});

function makeSignupReminderKeyboard(
  eventId: number,
  locale: string,
): InlineKeyboard {
  return new InlineKeyboard()
    .text(
      i18n.t(locale, "event_reminders.i_cant_make_it"),
      cantMakeItData.pack({ eventId }),
    )
    .text(
      i18n.t(locale, "event_reminders.i_will_be_there"),
      willBeThereData.pack({ eventId }),
    );
}

feature.callbackQuery(willBeThereData.filter(), async (ctx) => {
  const { eventId } = willBeThereData.unpack(ctx.callbackQuery.data);
  await updateEventSignup(eventId, ctx.user.id, {
    participationConfirmed: true,
  });
  await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
  await ctx.reply(ctx.t("event_reminders.waiting_for_you"), {
    reply_to_message_id: ctx?.msg?.message_id,
  });
});

feature.callbackQuery(cantMakeItData.filter(), async (ctx) => {
  const { eventId } = cantMakeItData.unpack(ctx.callbackQuery.data);
  await withdrawSignup(null, ctx, eventId, ctx.user);
  await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
});
