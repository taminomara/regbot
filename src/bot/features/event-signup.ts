import { createCallbackData } from "callback-data";
import { Composer, InlineKeyboard } from "grammy";
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
import { Context, Conversation, SessionData } from "#root/bot/context.js";
import { createApproveSignupKeyboard } from "#root/bot/features/admin-group-menu.js";
import { sendMessageToAdminGroupTopic } from "#root/bot/features/admin-group.js";
import { isApproved } from "#root/bot/filters/is-approved.js";
import { maybeExternal } from "#root/bot/helpers/conversations.js";
import { editMessageTextSafe } from "#root/bot/helpers/edit-text.js";
import { toFluentDateTime } from "#root/bot/helpers/i18n.js";
import { sanitizeHtmlOrEmpty } from "#root/bot/helpers/sanitize-html.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

export const composer = new Composer<Context>();

const feature = composer.chatType("private");

export async function postInterviewSignup(
  conversation: Conversation | null,
  ctx: Context,
  session: SessionData,
) {
  const { postInterviewSignupEventId } = session;
  session.postInterviewSignupEventId = undefined;

  if (
    postInterviewSignupEventId === undefined ||
    postInterviewSignupEventId.length === 0
  ) {
    return;
  }

  for (const eventId of postInterviewSignupEventId) {
    const event = await getEventForSignup(conversation, ctx, eventId);
    if (event === undefined) continue;
    if (event.signup !== undefined) {
      await ctx.reply(
        ctx.t("event_signup.already_registered", {
          name: sanitizeHtmlOrEmpty(event.name),
          date: toFluentDateTime(event.date),
        }),
        {
          reply_markup: createUserSignupKeyboard(ctx, eventId),
        },
      );
      continue;
    }

    await ctx.reply(
      ctx.t("event_signup.prompt_signup", {
        name: sanitizeHtmlOrEmpty(event.name),
        date: toFluentDateTime(event.date),
      }),
      {
        reply_markup: createUserSignupKeyboard(ctx, eventId),
      },
    );
  }
}

export async function signupForEvent(
  conversation: Conversation | null,
  ctx: Context,
  eventId: number,
) {
  const event = await getEventForSignup(conversation, ctx, eventId);
  if (event === undefined) return;

  const { signup, signupPerformed } = await maybeExternal(
    conversation,
    async () => signupForEventDb(event, ctx.user.id, ctx.me.id),
  );

  if (!signupPerformed) return;

  await sendConfirmation(conversation, ctx, event, signup, ctx.user);
}

export async function confirmSignup(
  conversation: Conversation | null,
  ctx: Context,
  eventId: number,
  userId: number,
) {
  const event = await getEventForSignup(conversation, ctx, eventId);
  if (event === undefined) return;

  const { signup, confirmPerformed } = await maybeExternal(
    conversation,
    async () => confirmSignupDb(event, userId, ctx.user.id),
  );

  if (!confirmPerformed) return;

  await sendConfirmation(conversation, ctx, event, signup, ctx.user);
}

export async function rejectSignup(
  conversation: Conversation | null,
  ctx: Context,
  eventId: number,
  userId: number,
) {
  const event = await getEventForSignup(conversation, ctx, eventId);
  if (event === undefined) return;

  const { signup, rejectPerformed, requireRefund } = await maybeExternal(
    conversation,
    async () => rejectSignupDb(event, userId, ctx.user.id),
  );

  if (!rejectPerformed) return;

  await sendConfirmation(
    conversation,
    ctx,
    event,
    signup,
    ctx.user,
    requireRefund,
  );
}

export async function withdrawSignup(
  conversation: Conversation | null,
  ctx: Context,
  eventId: number,
  userId: number,
) {
  const event = await getEventForSignup(conversation, ctx, eventId);
  if (event === undefined) return;

  const { requireRefund, withdrawPerformed } = await maybeExternal(
    conversation,
    async () => withdrawSignupDb(event, userId),
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

async function getEventForSignup(
  conversation: Conversation | null,
  ctx: Context,
  eventId: number,
) {
  if (!(await isApproved(ctx))) return;

  const event = await maybeExternal(conversation, async () =>
    getEventWithUserSignup(eventId, ctx.user.id),
  );
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

const userConfirmSignupData = createCallbackData("userConfirmSignupData", {
  eventId: Number,
});
const userRejectSignupData = createCallbackData("userRejectSignupData", {});

export function createUserSignupKeyboard(ctx: Context, eventId: number) {
  return new InlineKeyboard()
    .text(ctx.t("event_signup.prompt_signup_no"), userRejectSignupData.pack({}))
    .text(
      ctx.t("event_signup.prompt_signup_yes"),
      userConfirmSignupData.pack({ eventId }),
    );
}

feature.callbackQuery(userConfirmSignupData.filter(), async (ctx) => {
  const { eventId } = userConfirmSignupData.unpack(ctx.callbackQuery.data);
  await ctx.editMessageReplyMarkup({
    reply_markup: new InlineKeyboard(),
  });
  await signupForEvent(null, ctx, eventId);
});

feature.callbackQuery(userRejectSignupData.filter(), async (ctx) => {
  await editMessageTextSafe(
    ctx,
    ctx.t("event_signup.prompt_signup_reject_ok"),
    {
      reply_markup: new InlineKeyboard(),
    },
  );
});
