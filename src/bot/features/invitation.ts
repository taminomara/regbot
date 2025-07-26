import { dropInvitation, findInvitation } from "#root/backend/invitation.js";
import { UserLite, UserStatus, updateUser } from "#root/backend/user.js";
import { sendProfileMenu } from "#root/bot/features/menu.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

import { Context } from "../context.js";
import { sendInvitationApprovalNotificationToAdminGroupTopic } from "./admin-group.js";

export async function applyInvitationIfAny(ctx: Context) {
  if (ctx.user.username === null) {
    return;
  }

  const invitation = await findInvitation(ctx.user.username);
  if (invitation == null) {
    return;
  }

  const chatMember = await ctx.api.getChatMember(
    config.MEMBERS_GROUP,
    ctx.user.id,
  );

  let status;
  if (invitation.isBanned) {
    status = UserStatus.Banned;
  } else if (
    ["member", "creator", "administrator"].includes(chatMember.status)
  ) {
    // User is in chat, we know for sure this is the right one.
    status = UserStatus.Approved;
  } else {
    // User is not in the chat, we need manual approval from admins.
    status = UserStatus.PendingApproval;
  }

  ctx.user = await updateUser(ctx.user.id, {
    name: invitation.name,
    pronouns: invitation.pronouns,
    gender: invitation.gender,
    sexuality: invitation.sexuality,
    positioning: invitation.positioning,
    aboutMeHtml: invitation.aboutMeHtml,
    adminGroupTopic: invitation.adminGroupTopic,
    status,
    hasUnverifiedFields: true,
  });
  dropInvitation(invitation.id);

  if (status === UserStatus.PendingApproval) {
    // Note: send this after updating user topic.
    await sendInvitationApprovalNotificationToAdminGroupTopic(ctx, ctx.user);
  }

  ctx.logger.info("user restored from invitation");
}

export async function maybeNotifyAboutOutdatedProfile(
  ctx: Context,
  user: UserLite,
) {
  if (!user.hasUnverifiedFields) {
    return;
  }

  if (user.status === UserStatus.PendingApproval) {
    await ctx.api.sendMessage(
      user.id,
      i18n.t(
        user.locale ?? config.DEFAULT_LOCALE,
        "menu.pending_approval_after_invitation",
      ),
    );
  } else {
    await ctx.api.sendMessage(
      user.id,
      i18n.t(
        user.locale ?? config.DEFAULT_LOCALE,
        "menu.unverified_fields_notice",
      ),
    );
    await sendProfileMenu(ctx, user);
    return updateUser(user.id, { hasUnverifiedFields: false });
  }
}
