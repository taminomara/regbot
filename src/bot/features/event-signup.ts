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
import { Context, Conversation } from "#root/bot/context.js";
import {
  createConfirmPaymentKeyboard,
  createConfirmSignupKeyboard,
} from "#root/bot/features/admin-group-menu.js";
import { sendMessageToAdminGroupTopic } from "#root/bot/features/admin-group.js";
import { sendEventMenu } from "#root/bot/features/menu.js";
import { isApproved } from "#root/bot/filters/is-approved.js";
import { maybeExternal } from "#root/bot/helpers/conversations.js";
import { toFluentDateTime } from "#root/bot/helpers/i18n.js";
import { sanitizeHtmlOrEmpty } from "#root/bot/helpers/sanitize-html.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

export async function postInterviewSignup(
  conversation: Conversation | null,
  ctx: Context,
  user?: User,
) {
  if (user === undefined) {
    user =
      (await maybeExternal(conversation, async () => getUser(ctx.user.id))) ??
      undefined;
  }

  if (user === undefined || user.pendingSignup === null) return;

  const event = await getEventForSignup(
    conversation,
    ctx,
    user.pendingSignup,
    user,
  );
  if (event === undefined) return;

  if (event.signup === undefined) {
    await sendEventMenu(
      conversation,
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

  await maybeExternal(conversation, async () =>
    updateUser(user.id, { pendingSignup: null }),
  );
}

export async function signupForEvent(
  conversation: Conversation | null,
  ctx: Context,
  eventId: number,
  user: UserLite,
  participationOptions: string[] | null,
) {
  const event = await getEventForSignup(conversation, ctx, eventId, user);
  if (event === undefined) return;

  const { signup, signupPerformed } = await maybeExternal(
    conversation,
    async () =>
      signupForEventDb(event, user.id, ctx.me.id, participationOptions),
  );

  if (!signupPerformed) return;

  await sendConfirmation(conversation, ctx, event, signup, user);
}

export async function confirmSignup(
  conversation: Conversation | null,
  ctx: Context,
  eventId: number,
  user: UserLite,
) {
  const event = await getEventForSignup(conversation, ctx, eventId, user);
  if (event === undefined) return;

  const { signup, confirmPerformed } = await maybeExternal(
    conversation,
    async () => confirmSignupDb(event, user.id, ctx.user.id),
  );

  if (!confirmPerformed) return;

  await sendConfirmation(conversation, ctx, event, signup, user);
}

export async function confirmPayment(
  conversation: Conversation | null,
  ctx: Context,
  eventId: number,
  user: UserLite,
) {
  const event = await getEventForSignup(conversation, ctx, eventId, user);
  if (event === undefined) return;

  const { signup, confirmPerformed } = await maybeExternal(
    conversation,
    async () => confirmPaymentDb(event, user.id, ctx.user.id),
  );

  if (!confirmPerformed) return;

  await sendConfirmation(conversation, ctx, event, signup, user);
}

export async function rejectSignup(
  conversation: Conversation | null,
  ctx: Context,
  eventId: number,
  user: UserLite,
) {
  const event = await getEventForSignup(conversation, ctx, eventId, user);
  if (event === undefined) return;

  const { signup, rejectPerformed, requireRefund } = await maybeExternal(
    conversation,
    async () => rejectSignupDb(event, user.id, ctx.user.id),
  );

  if (!rejectPerformed) return;

  await sendConfirmation(conversation, ctx, event, signup, user, requireRefund);
}

export async function withdrawSignup(
  conversation: Conversation | null,
  ctx: Context,
  eventId: number,
  user: UserLite,
) {
  const event = await getEventForSignup(conversation, ctx, eventId, user);
  if (event === undefined) return;

  const { requireRefund, withdrawPerformed } = await maybeExternal(
    conversation,
    async () => withdrawSignupDb(event, user.id),
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
    conversation,
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
  conversation: Conversation | null,
  ctx: Context,
  eventId: number,
  user: UserLite,
) {
  if (!(await isApproved(ctx))) return;

  const event = await maybeExternal(conversation, async () =>
    getEventWithUserSignup(eventId, user.id),
  );
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
  conversation: Conversation | null,
  ctx: Context,
  event: Event,
  signup: EventSignup,
  user: UserLite,
  requireRefund?: boolean,
) {
  const admin = await maybeExternal(conversation, async () =>
    signup.approvedBy === null ? undefined : getUserLite(signup.approvedBy),
  );

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
      await ctx.api.sendMessage(
        user.id,
        i18n.t(
          user.locale ?? config.DEFAULT_LOCALE,
          "event_signup.pending_approval",
        ),
      );
      await sendMessageToAdminGroupTopic(
        conversation,
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
      break;
    }
    case SignupStatus.PendingPayment: {
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
      await sendMessageToAdminGroupTopic(
        conversation,
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
      break;
    }
    case SignupStatus.Approved: {
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
      );
      await sendMessageToAdminGroupTopic(
        conversation,
        ctx,
        user,
        i18n.t(config.DEFAULT_LOCALE, "event_signup.admin_message_registered", {
          name: sanitizeHtmlOrEmpty(event.name),
          date: toFluentDateTime(event.date),
          adminId: String(admin?.id),
          adminName: sanitizeHtmlOrEmpty(admin?.name),
          approveDate: toFluentDateTime(signup.approvedAt ?? new Date(0)),
          options,
        }),
      );
      break;
    }
    case SignupStatus.Rejected: {
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
      await sendMessageToAdminGroupTopic(
        conversation,
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
