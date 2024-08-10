import moment from "moment-timezone";

import {
  Event,
  EventSignup,
  SignupStatus,
  confirmPayment as confirmPaymentDb,
  confirmSignup as confirmSignupDb,
  getEventWithUserSignup,
  rejectSignup as rejectSignupDb,
  signupForEvent as signupForEventDb,
  withdrawSignup as withdrawSignupDb,
} from "#root/backend/event.js";
import {
  User,
  UserLite,
  getUser,
  getUserLite,
  updateUser,
} from "#root/backend/user.js";
import { Context } from "#root/bot/context.js";
import {
  createConfirmPaymentKeyboard,
  createConfirmSignupKeyboard,
} from "#root/bot/features/admin-group-menu.js";
import { sendMessageToAdminGroupTopic } from "#root/bot/features/admin-group.js";
import { sendEventMenu } from "#root/bot/features/menu.js";
import { isApproved } from "#root/bot/filters/is-approved.js";
import { toFluentDateTime } from "#root/bot/helpers/i18n.js";
import { sanitizeHtmlOrEmpty } from "#root/bot/helpers/sanitize-html.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

import { userLink } from "../helpers/links.js";

export async function postInterviewSignup(ctx: Context, user?: User) {
  if (user === undefined) {
    user = (await getUser(ctx.user.id)) ?? undefined;
  }

  if (user === undefined || user.pendingSignup === null) return;

  const event = await getEventForSignup(ctx, user.pendingSignup, user);
  if (event !== undefined) {
    if (event.signup === undefined) {
      await sendEventMenu(
        ctx,
        user.id,
        event,
        i18n.t(
          user.locale ?? config.DEFAULT_LOCALE,
          "event_signup.prompt_signup",
          {
            name: sanitizeHtmlOrEmpty(event.name),
            date: toFluentDateTime(event.date),
          },
        ),
        user.locale ?? config.DEFAULT_LOCALE,
      );
    } else {
      await ctx.api.sendMessage(
        user.id,
        i18n.t(
          user.locale ?? config.DEFAULT_LOCALE,
          "event_signup.already_registered",
          {
            name: sanitizeHtmlOrEmpty(event.name),
            date: toFluentDateTime(event.date),
          },
        ),
      );
    }
  }

  await updateUser(user.id, { pendingSignup: null });
}

export async function signupForEvent(
  ctx: Context,
  eventId: number,
  user: UserLite,
  participationOptions: string[] | null,
) {
  const event = await getEventForSignup(ctx, eventId, user);
  if (event === undefined) return;

  const { signup, signupPerformed } = await signupForEventDb(
    event,
    user.id,
    ctx.me.id,
    participationOptions,
  );

  if (!signupPerformed) return;

  await sendConfirmation(ctx, event, signup, user);
}

export async function confirmSignup(
  ctx: Context,
  eventId: number,
  user: UserLite,
) {
  const event = await getEventForSignup(ctx, eventId, user);
  if (event === undefined) return;

  const { signup, confirmPerformed } = await confirmSignupDb(
    event,
    user.id,
    ctx.user.id,
  );

  if (!confirmPerformed) return;

  await sendConfirmation(ctx, event, signup, user);
}

export async function confirmPayment(
  ctx: Context,
  eventId: number,
  user: UserLite,
) {
  const event = await getEventForSignup(ctx, eventId, user);
  if (event === undefined) return;

  const { signup, confirmPerformed } = await confirmPaymentDb(
    event,
    user.id,
    ctx.user.id,
  );

  if (!confirmPerformed) return;

  await sendConfirmation(ctx, event, signup, user);
}

export async function rejectSignup(
  ctx: Context,
  eventId: number,
  user: UserLite,
) {
  const event = await getEventForSignup(ctx, eventId, user);
  if (event === undefined) return;

  const { signup, rejectPerformed, requireRefund } = await rejectSignupDb(
    event,
    user.id,
    ctx.user.id,
  );

  if (!rejectPerformed) return;

  await sendConfirmation(ctx, event, signup, user, requireRefund);
}

export async function withdrawSignup(
  ctx: Context,
  eventId: number,
  user: UserLite,
) {
  const event = await getEventForSignup(ctx, eventId, user);
  if (event === undefined) return;

  const { requireRefund, withdrawPerformed } = await withdrawSignupDb(
    event,
    user.id,
  );

  if (!withdrawPerformed) return;

  await ctx.api.sendMessage(
    user.id,
    i18n.t(
      user.locale ?? config.DEFAULT_LOCALE,
      requireRefund
        ? "event_signup.withdrawn_with_refund"
        : "event_signup.withdrawn",
      {
        name: sanitizeHtmlOrEmpty(event.name),
        date: toFluentDateTime(event.date),
      },
    ),
  );
  await sendMessageToAdminGroupTopic(
    ctx,
    user,
    i18n.t(
      config.DEFAULT_LOCALE,
      requireRefund
        ? "event_signup.admin_message_withdrawn_with_refund"
        : "event_signup.admin_message_withdrawn",
      {
        name: sanitizeHtmlOrEmpty(event.name),
        date: toFluentDateTime(event.date),
      },
    ),
  );
}

async function getEventForSignup(
  ctx: Context,
  eventId: number,
  user: UserLite,
) {
  if (!(await isApproved(ctx))) return;

  const event = await getEventWithUserSignup(eventId, user.id);
  if (event === null) {
    ctx.logger.warn({ msg: "Unknown event", eventId });
    await ctx.api.sendMessage(
      user.id,
      i18n.t(
        user.locale ?? config.DEFAULT_LOCALE,
        "event_signup.unknown_event",
      ),
    );
    return;
  }
  if (!event.registrationOpen) {
    await ctx.api.sendMessage(
      user.id,
      i18n.t(
        user.locale ?? config.DEFAULT_LOCALE,
        "event_signup.registration_closed",
      ),
    );
    return;
  }
  if (moment.utc(event.date).isBefore(moment.now())) {
    await ctx.api.sendMessage(
      user.id,
      i18n.t(
        user.locale ?? config.DEFAULT_LOCALE,
        "event_signup.event_in_past",
      ),
    );
    return;
  }

  return event;
}

async function sendConfirmation(
  ctx: Context,
  event: Event,
  signup: EventSignup,
  user: UserLite,
  requireRefund?: boolean,
) {
  const admin =
    signup.approvedBy === null
      ? undefined
      : await getUserLite(signup.approvedBy);

  const options =
    event.participationOptions === null
      ? ""
      : i18n.t(config.DEFAULT_LOCALE, "event_signup.chosen_options", {
          options: sanitizeHtmlOrEmpty(
            (signup.participationOptions ?? []).join("; "),
          ),
        });

  switch (signup.status) {
    case SignupStatus.PendingApproval: {
      await sendMessageToAdminGroupTopic(
        ctx,
        user,
        i18n.t(
          config.DEFAULT_LOCALE,
          "event_signup.admin_message_pending_approval",
          {
            name: sanitizeHtmlOrEmpty(event.name),
            date: toFluentDateTime(event.date),
            options,
          },
        ),
        {
          reply_markup: createConfirmSignupKeyboard(event.id, user.id),
        },
      );
      await ctx.api.sendMessage(
        user.id,
        i18n.t(
          user.locale ?? config.DEFAULT_LOCALE,
          "event_signup.pending_approval",
        ),
      );
      break;
    }
    case SignupStatus.PendingPayment: {
      await sendMessageToAdminGroupTopic(
        ctx,
        user,
        i18n.t(
          config.DEFAULT_LOCALE,
          "event_signup.admin_message_pending_payment",
          {
            name: sanitizeHtmlOrEmpty(event.name),
            date: toFluentDateTime(event.date),
            options,
          },
        ),
        {
          reply_markup: createConfirmPaymentKeyboard(event.id, user.id),
        },
      );
      await ctx.api.sendMessage(
        user.id,
        i18n.t(
          user.locale ?? config.DEFAULT_LOCALE,
          "event_signup.pending_payment",
          {
            price: sanitizeHtmlOrEmpty(event.price),
            iban: sanitizeHtmlOrEmpty(event.iban ?? config.PAYMENT_IBAN),
            recipient: sanitizeHtmlOrEmpty(
              event.recipient ?? config.PAYMENT_RECIPIENT,
            ),
          },
        ),
      );
      break;
    }
    case SignupStatus.Approved: {
      await sendMessageToAdminGroupTopic(
        ctx,
        user,
        i18n.t(config.DEFAULT_LOCALE, "event_signup.admin_message_registered", {
          name: sanitizeHtmlOrEmpty(event.name),
          date: toFluentDateTime(event.date),
          adminLink: userLink(admin?.id),
          adminName: sanitizeHtmlOrEmpty(admin?.name),
          approveDate: toFluentDateTime(signup.approvedAt ?? new Date(0)),
          options,
        }),
      );
      await ctx.api.sendMessage(
        user.id,
        i18n.t(
          user.locale ?? config.DEFAULT_LOCALE,
          "event_signup.registered",
          {
            name: sanitizeHtmlOrEmpty(event.name),
            date: toFluentDateTime(event.date),
          },
        ),
        {
          ...({
            message_effect_id: "5159385139981059251",
          } as object),
        },
      );
      break;
    }
    case SignupStatus.Rejected: {
      await sendMessageToAdminGroupTopic(
        ctx,
        user,
        i18n.t(
          config.DEFAULT_LOCALE,
          requireRefund
            ? "event_signup.admin_message_rejected_with_refund"
            : "event_signup.admin_message_rejected",
          {
            name: sanitizeHtmlOrEmpty(event.name),
            date: toFluentDateTime(event.date),
            adminLink: userLink(admin?.id),
            adminName: sanitizeHtmlOrEmpty(admin?.name),
            rejectDate: toFluentDateTime(signup.approvedAt ?? new Date(0)),
          },
        ),
      );
      await ctx.api.sendMessage(
        user.id,
        i18n.t(
          user.locale ?? config.DEFAULT_LOCALE,
          requireRefund
            ? "event_signup.rejected_with_refund"
            : "event_signup.rejected",
          {
            name: sanitizeHtmlOrEmpty(event.name),
            date: toFluentDateTime(event.date),
          },
        ),
      );
      break;
    }
  }
}
