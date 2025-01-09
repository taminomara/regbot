import { createCallbackData } from "callback-data";
import { Api, Bot, Composer, InlineKeyboard } from "grammy";
import { Counter, Gauge } from "prom-client";

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

const metrics = {
  eventRemindersProcessingStarted: new Counter({
    name: "event_reminders_processing_started_count",
    help: "Number of background checks for event reminders started",
  }),
  eventRemindersProcessingFinished: new Counter({
    name: "event_reminders_processing_finished_count",
    help: "Number of background checks for event reminders finished",
  }),
  eventRemindersProcessingInFlight: new Gauge({
    name: "event_reminders_processing_inflight",
    help: "Number of background checks for event reminders inflight",
  }),
  eventRemindersProcessingErrors: new Counter({
    name: "event_reminders_processing_errors_count",
    help: "Number of errors during background checks for event reminders",
  }),
  eventRemindersProcessed: new Counter({
    name: "event_reminders_processed_count",
    help: "Number of events with pending reminders processed",
  }),
};

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

    metrics.eventRemindersProcessingStarted.inc();
    metrics.eventRemindersProcessingInFlight.inc();
    try {
      await this.processEventReminders();
    } catch (error) {
      logger.error(error, "Error when sending event reminders");
      hasErrors = true;
      metrics.eventRemindersProcessingErrors.inc();
    } finally {
      metrics.eventRemindersProcessingInFlight.dec();
      metrics.eventRemindersProcessingFinished.inc();
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
      metrics.eventRemindersProcessed.inc();

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

  async sendSignupReminder(
    signup: PopulatedEventSignup,
    opts: { withTitle?: boolean; withKeyboard?: boolean } = {},
  ) {
    await delay(1000 + Math.random() * 5000);
    try {
      await sendSignupReminder(this.bot.api, signup, opts);
    } catch (error) {
      logger.error(error, "Error when sending signup reminder");
    }
  }
}

export async function sendSignupReminder(
  api: Api,
  signup: PopulatedEventSignup,
  opts: { withTitle?: boolean; withKeyboard?: boolean } = {},
) {
  let more = signup.event.reminderTextHtml ?? "";
  if (signup.event.payment === EventPayment.Donation) {
    let paymentDetails;
    if (signup.event.price !== null) {
      paymentDetails = i18n.t(
        signup.user.locale ?? config.DEFAULT_LOCALE,
        "event_reminders.payment_details_with_price",
        {
          price: sanitizeHtmlOrEmpty(signup.event.price),
          iban: sanitizeHtmlOrEmpty(signup.event.iban ?? config.PAYMENT_IBAN),
          recipient: sanitizeHtmlOrEmpty(
            signup.event.recipient ?? config.PAYMENT_RECIPIENT,
          ),
        },
      );
    } else {
      paymentDetails = i18n.t(
        signup.user.locale ?? config.DEFAULT_LOCALE,
        "event_reminders.payment_details",
        {
          iban: sanitizeHtmlOrEmpty(signup.event.iban ?? config.PAYMENT_IBAN),
          recipient: sanitizeHtmlOrEmpty(
            signup.event.recipient ?? config.PAYMENT_RECIPIENT,
          ),
        },
      );
    }

    if (more.length > 0) more += "\n\n";
    more += i18n.t(
      signup.user.locale ?? config.DEFAULT_LOCALE,
      "event_reminders.donate_reminder",
      {
        paymentDetails,
      },
    );
  }

  await api.sendMessage(
    signup.user.id,
    i18n.t(
      signup.user.locale ?? config.DEFAULT_LOCALE,
      opts.withTitle ?? true
        ? "event_reminders.signup_reminder"
        : "event_reminders.signup_reminder_today",
      {
        name: sanitizeHtmlOrEmpty(signup.event.name),
        date: toFluentDateTime(signup.event.date),
        more,
      },
    ),
    {
      reply_markup:
        opts.withKeyboard ?? true
          ? makeSignupReminderKeyboard(
              signup.event.id,
              signup.user.locale ?? config.DEFAULT_LOCALE,
            )
          : undefined,
    },
  );
}

const willBeThereData = createCallbackData("willBeThere", {
  eventId: Number,
});
const cantMakeItData = createCallbackData("cantMakeIt", {
  eventId: Number,
});

export function makeSignupReminderKeyboard(
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
  await withdrawSignup(ctx, eventId, ctx.user);
  await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
});
