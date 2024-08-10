import {
  UserLite,
  UserStatus,
  approveUser,
  rejectUser,
} from "#root/backend/user.js";
import type { Context } from "#root/bot/context.js";
import {
  getUserForTopic,
  sendMessageToAdminGroupTopic,
} from "#root/bot/features/admin-group.js";
import { postInterviewSignup } from "#root/bot/features/event-signup.js";
import { toFluentDateTime } from "#root/bot/helpers/i18n.js";
import { sanitizeHtmlOrEmpty } from "#root/bot/helpers/sanitize-html.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

import { userLink } from "../helpers/links.js";

export async function approve(ctx: Context) {
  const user = await getUserForTopic(ctx);
  if (user === undefined || user.status !== UserStatus.PendingApproval) return;

  const approvedUser = await approveUser(user.id, ctx.user.id);

  await sendMessageToAdminGroupTopic(
    ctx,
    approvedUser,
    i18n.t(config.DEFAULT_LOCALE, "interview.admin_message_approved", {
      adminLink: userLink(ctx.user.id),
      adminName: sanitizeHtmlOrEmpty(ctx.user.name),
      date: toFluentDateTime(approvedUser.verifiedAt ?? new Date(0)),
    }),
  );

  await sendApproveMessage(ctx, approvedUser);
  await postInterviewSignup(ctx, approvedUser);
}

export async function sendApproveMessage(ctx: Context, approvedUser: UserLite) {
  const memberGroup = await ctx.api.getChat(config.MEMBERS_GROUP);
  await ctx.api.sendMessage(
    approvedUser.id,
    i18n.t(
      approvedUser.locale || config.DEFAULT_LOCALE,
      "interview.message_approved",
      {
        chatLink: memberGroup.invite_link ?? "",
      },
    ),
    {
      protect_content: true,
      reply_markup: { remove_keyboard: true },
      ...({
        message_effect_id: "5046509860389126442",
      } as object),
    },
  );
}

export async function reject(ctx: Context) {
  const user = await getUserForTopic(ctx);
  if (user === undefined || user.status !== UserStatus.PendingApproval) return;

  const rejectedUser = await rejectUser(user.id, ctx.user.id);

  await sendMessageToAdminGroupTopic(
    ctx,
    rejectedUser,
    i18n.t(config.DEFAULT_LOCALE, "interview.admin_message_rejected", {
      adminLink: userLink(ctx.user.id),
      adminName: sanitizeHtmlOrEmpty(ctx.user.name),
      date: toFluentDateTime(rejectedUser.verifiedAt ?? new Date(0)),
    }),
  );

  await ctx.api.sendMessage(
    rejectedUser.id,
    i18n.t(
      rejectedUser.locale || config.DEFAULT_LOCALE,
      "interview.message_rejected",
    ),
  );
}
