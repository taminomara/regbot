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
import {
  User,
  UserLite,
  getUser,
  getUserLite,
  updateUser,
} from "#root/backend/user.js";
import { Context, Conversation } from "#root/bot/context.js";
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
    await ctx.api.sendMessage(
      user.id,
      i18n.t(
        user.locale ?? config.DEFAULT_LOCALE,
        "event_signup.prompt_signup",
        {
          name: sanitizeHtmlOrEmpty(event.name),
          date: toFluentDateTime(event.date),
        },
      ),
      {
        reply_markup: createUserSignupKeyboard(user.pendingSignup, user),
      },
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
) {
  const event = await getEventForSignup(conversation, ctx, eventId, user);
  if (event === undefined) return;

  const { signup, signupPerformed } = await maybeExternal(
    conversation,
    async () => signupForEventDb(event, user.id, ctx.me.id),
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
    ctx,
    user.adminGroupTopic,
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

  switch (signup.status) {
    case SignupStatus.PendingApproval: {
      await ctx.api.sendMessage(
        user.id,
        i18n.t(
          user.locale ?? config.DEFAULT_LOCALE,
          "event_signup.pending_approval",
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
        i18n.t(
          user.locale ?? config.DEFAULT_LOCALE,
          "event_signup.pending_payment",
          {
            name: sanitizeHtmlOrEmpty(event.name),
            date: toFluentDateTime(event.date),
            price: sanitizeHtmlOrEmpty(event.price),
            iban: sanitizeHtmlOrEmpty(config.PAYMENT_IBAN),
            recipient: sanitizeHtmlOrEmpty(config.PAYMENT_RECIPIENT),
          },
        ),
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

export function createUserSignupKeyboard(eventId: number, user: UserLite) {
  return new InlineKeyboard()
    .text(
      i18n.t(
        user.locale ?? config.DEFAULT_LOCALE,
        "event_signup.prompt_signup_no",
      ),
      userRejectSignupData.pack({}),
    )
    .text(
      i18n.t(
        user.locale ?? config.DEFAULT_LOCALE,
        "event_signup.prompt_signup_yes",
      ),
      userConfirmSignupData.pack({ eventId }),
    );
}

feature.callbackQuery(userConfirmSignupData.filter(), async (ctx) => {
  const { eventId } = userConfirmSignupData.unpack(ctx.callbackQuery.data);
  await ctx.editMessageReplyMarkup({
    reply_markup: new InlineKeyboard(),
  });
  await signupForEvent(null, ctx, eventId, ctx.user);
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
