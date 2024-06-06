import moment from "moment-timezone";

import {
  Event,
  EventSignup,
  SignupStatus,
  confirmSignup as confirmSignupDb,
  getEventWithUserSignup,
  rejectSignup as rejectSignupDb,
  signupForEvent as signupForEventDb,
  withdrawSignup as withdrawSignupDb,
} from "#root/backend/event.js";
import { UserLite, getUserLite } from "#root/backend/user.js";
import { Context } from "#root/bot/context.js";
import { createApproveSignupKeyboard } from "#root/bot/features/admin-group-menu.js";
import { sendMessageToAdminGroupTopic } from "#root/bot/features/admin-group.js";
import { isApproved } from "#root/bot/filters/is-approved.js";
import { toFluentDateTime } from "#root/bot/helpers/i18n.js";
import { sanitizeHtmlOrEmpty } from "#root/bot/helpers/sanitize-html.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

export async function signupForEvent(ctx: Context, eventId: number) {
  const event = await getEventForSignup(ctx, eventId);
  if (event === undefined) return;

  const { signup, signupPerformed } = await signupForEventDb(
    event,
    ctx.user.id,
    ctx.me.id,
  );

  if (!signupPerformed) return;

  await sendConfirmation(ctx, event, signup, ctx.user);
}

export async function confirmSignup(
  ctx: Context,
  eventId: number,
  userId: number,
) {
  const event = await getEventForSignup(ctx, eventId);
  if (event === undefined) return;

  const { signup, confirmPerformed } = await confirmSignupDb(
    event,
    userId,
    ctx.user.id,
  );

  if (!confirmPerformed) return;

  await sendConfirmation(ctx, event, signup, ctx.user);
}

export async function rejectSignup(
  ctx: Context,
  eventId: number,
  userId: number,
) {
  const event = await getEventForSignup(ctx, eventId);
  if (event === undefined) return;

  const { signup, rejectPerformed, requireRefund } = await rejectSignupDb(
    event,
    userId,
    ctx.user.id,
  );

  if (!rejectPerformed) return;

  await sendConfirmation(ctx, event, signup, ctx.user, requireRefund);
}

export async function withdrawSignup(
  ctx: Context,
  eventId: number,
  userId: number,
) {
  const event = await getEventForSignup(ctx, eventId);
  if (event === undefined) return;

  const { requireRefund, withdrawPerformed } = await withdrawSignupDb(
    event,
    userId,
  );

  if (!withdrawPerformed) return;

  await ctx.api.sendMessage(
    userId,
    ctx.t(
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
    ctx.user.adminGroupTopic,
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

async function getEventForSignup(ctx: Context, eventId: number) {
  if (!(await isApproved(ctx))) return;

  const event = await getEventWithUserSignup(eventId, ctx.user.id);
  if (event === null) {
    ctx.logger.warn({ msg: "Unknown event", eventId });
    await ctx.reply(ctx.t("event_signup.unknown_event"));
    return;
  }
  if (moment.utc(event.date).isBefore(moment.now())) {
    await ctx.reply(ctx.t("event_signup.event_in_past"));
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

  switch (signup.status) {
    case SignupStatus.PendingApproval: {
      await ctx.api.sendMessage(
        user.id,
        ctx.t("event_signup.pending_approval", {
          name: sanitizeHtmlOrEmpty(event.name),
          date: toFluentDateTime(event.date),
        }),
      );
      await sendMessageToAdminGroupTopic(
        ctx,
        user.adminGroupTopic,
        i18n.t(
          config.DEFAULT_LOCALE,
          "event_signup.admin_message_pending_approval",
          {
            name: sanitizeHtmlOrEmpty(event.name),
            date: toFluentDateTime(event.date),
          },
        ),
        {
          reply_markup: createApproveSignupKeyboard(event.id),
        },
      );
      break;
    }
    case SignupStatus.PendingPayment: {
      await ctx.api.sendMessage(
        user.id,
        ctx.t("event_signup.pending_payment", {
          name: sanitizeHtmlOrEmpty(event.name),
          date: toFluentDateTime(event.date),
          price: sanitizeHtmlOrEmpty(event.price),
          iban: sanitizeHtmlOrEmpty(config.PAYMENT_IBAN),
          recipient: sanitizeHtmlOrEmpty(config.PAYMENT_RECIPIENT),
        }),
      );
      await sendMessageToAdminGroupTopic(
        ctx,
        user.adminGroupTopic,
        i18n.t(
          config.DEFAULT_LOCALE,
          "event_signup.admin_message_pending_payment",
          {
            name: sanitizeHtmlOrEmpty(event.name),
            date: toFluentDateTime(event.date),
          },
        ),
        {
          reply_markup: createApproveSignupKeyboard(event.id),
        },
      );
      break;
    }
    case SignupStatus.Approved: {
      await ctx.api.sendMessage(
        user.id,
        ctx.t("event_signup.registered", {
          name: sanitizeHtmlOrEmpty(event.name),
          date: toFluentDateTime(event.date),
        }),
      );
      await sendMessageToAdminGroupTopic(
        ctx,
        user.adminGroupTopic,
        i18n.t(config.DEFAULT_LOCALE, "event_signup.admin_message_registered", {
          name: sanitizeHtmlOrEmpty(event.name),
          date: toFluentDateTime(event.date),
          adminId: String(admin?.id),
          adminName: sanitizeHtmlOrEmpty(admin?.name),
          approveDate: toFluentDateTime(signup.approvedAt ?? new Date(0)),
        }),
      );
      break;
    }
    case SignupStatus.Rejected: {
      await ctx.api.sendMessage(
        user.id,
        ctx.t(
          requireRefund
            ? "event_signup.rejected_with_refund"
            : "event_signup.rejected",
          {
            name: sanitizeHtmlOrEmpty(event.name),
            date: toFluentDateTime(event.date),
          },
        ),
      );
      await sendMessageToAdminGroupTopic(
        ctx,
        user.adminGroupTopic,
        i18n.t(
          config.DEFAULT_LOCALE,
          requireRefund
            ? "event_signup.admin_message_rejected_with_refund"
            : "event_signup.admin_message_rejected",
          {
            name: sanitizeHtmlOrEmpty(event.name),
            date: toFluentDateTime(event.date),
            adminId: String(admin?.id),
            adminName: sanitizeHtmlOrEmpty(admin?.name),
            rejectDate: toFluentDateTime(signup.approvedAt ?? new Date(0)),
          },
        ),
      );
      break;
    }
  }
}
