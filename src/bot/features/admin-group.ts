import { Other } from "@grammyjs/hydrate";
import { Composer, Filter, GrammyError } from "grammy";

import {
  User,
  UserLite,
  UserStatus,
  banUser as banUserDb,
  getUserByAdminGroupTopic,
  getUserLite,
  getUserLiteByAdminGroupTopic,
  getUserOrFail,
  setUserAdminGroupTopicId,
  unbanUser as unbanUserDb,
} from "#root/backend/user.js";
import type { Context } from "#root/bot/context.js";
import {
  adminPostInterviewMenu,
  sendAdminGroupUserMenu,
} from "#root/bot/features/admin-group-menu.js";
import {
  copyMessageTo,
  handleMessageEdit,
} from "#root/bot/features/edit-cache.js";
import {
  CommandPrivileges,
  CommandScope,
  registerCommandHelp,
} from "#root/bot/features/help.js";
import { isAdmin } from "#root/bot/filters/index.js";
import { toFluentDateTime } from "#root/bot/helpers/i18n.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { sanitizeHtmlOrEmpty } from "#root/bot/helpers/sanitize-html.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

export const composer = new Composer<Context>();

/**
 * Make sure that there is a topic in the admin forum about the given user.
 */
export async function ensureHasAdminGroupTopic(
  ctx: Context,
  userLite: UserLite,
) {
  if (userLite.adminGroupTopic !== null) {
    return userLite.adminGroupTopic;
  }

  const user = await getUserOrFail(userLite.id);

  // Account for changes made in DB but not propagated to `ctx.user`.
  if (user.adminGroupTopic !== null) {
    return user.adminGroupTopic;
  }

  const topic = await ctx.api.createForumTopic(
    config.ADMIN_GROUP,
    formatTopicName(user),
  );

  const userWithTopic = await setUserAdminGroupTopicId(
    user.id,
    topic.message_thread_id,
  );

  await sendAdminGroupUserMenu(ctx, userWithTopic);

  return topic.message_thread_id;
}

/**
 * Update topic name after the user changes their data.
 * Does nothing if there is no topic for this user.
 */
export async function updateAdminGroupTopicTitle(
  ctx: Context,
  userLite: UserLite,
) {
  userLite ??= ctx.user;

  const adminGroupTopic = await ensureHasAdminGroupTopic(ctx, userLite);

  try {
    await ctx.api.editForumTopic(config.ADMIN_GROUP, adminGroupTopic, {
      name: formatTopicName(userLite),
    });
  } catch (error) {
    if (error instanceof GrammyError && error.error_code === 400) {
      if (error.description.includes("TOPIC_NOT_MODIFIED")) {
        ctx.logger.debug("ignored TOPIC_NOT_MODIFIED error");
      } else {
        ctx.logger.warn(error);
      }
    } else {
      throw error;
    }
  }
}

export async function copyMessageToAdminGroupTopic(
  ctx: Filter<Context, "message">,
) {
  const adminGroupTopic = await ensureHasAdminGroupTopic(ctx, ctx.user);
  await copyMessageTo(ctx, config.ADMIN_GROUP, {
    message_thread_id: adminGroupTopic,
  });
}

export async function sendInterviewQuestionToAdminGroupTopic(
  ctx: Context,
  userLite: UserLite,
  question: string,
) {
  await sendMessageToAdminGroupTopic(
    ctx,
    userLite,
    i18n.t(config.DEFAULT_LOCALE, "admin_group.message_interview_question", {
      question,
    }),
    {},
  );
}

export async function sendInterviewFinishNotificationToAdminGroupTopic(
  ctx: Context,
  userLite: UserLite,
) {
  await sendMessageToAdminGroupTopic(
    ctx,
    userLite,
    i18n.t(config.DEFAULT_LOCALE, "admin_group.message_interview_finished"),
    {
      reply_markup: adminPostInterviewMenu,
    },
  );
}

export async function sendMessageToAdminGroupTopic(
  ctx: Context,
  userLite: UserLite,
  message: string,
  other?: Other<"sendMessage", "chat_id" | "text" | "message_thread_id">,
) {
  const adminGroupTopic = await ensureHasAdminGroupTopic(ctx, userLite);
  await ctx.api.sendMessage(config.ADMIN_GROUP, message, {
    ...other,
    message_thread_id: adminGroupTopic,
  });
}

export async function formatAboutMe(user: User) {
  let details = "";
  if (user.status === UserStatus.Rejected && user.verifiedBy !== null) {
    const admin = await getUserLite(user.verifiedBy);
    details = i18n.t(config.DEFAULT_LOCALE, "admin_group.rejection_details", {
      id: String(admin.id),
      name: sanitizeHtmlOrEmpty(admin.name),
      date: toFluentDateTime(user.verifiedAt ?? new Date(0)),
    });
  } else if (user.status === UserStatus.Banned && user.verifiedBy !== null) {
    const admin = await getUserLite(user.verifiedBy);
    details = i18n.t(config.DEFAULT_LOCALE, "admin_group.ban_details", {
      id: String(admin.id),
      name: sanitizeHtmlOrEmpty(admin.name),
      date: toFluentDateTime(user.verifiedAt ?? new Date(0)),
      reason: sanitizeHtmlOrEmpty(user.banReason),
    });
  }

  return [
    i18n.t(config.DEFAULT_LOCALE, "admin_group.topic_header", {
      id: String(user.id),
      name: sanitizeHtmlOrEmpty(user.name),
      username: sanitizeHtmlOrEmpty(user.username),
    }),
    i18n.t(config.DEFAULT_LOCALE, "admin_group.topic_body", {
      name: sanitizeHtmlOrEmpty(user.name),
      pronouns: sanitizeHtmlOrEmpty(user.pronouns),
      gender: sanitizeHtmlOrEmpty(user.gender),
      sexuality: sanitizeHtmlOrEmpty(user.sexuality),
      status: user.status,
      details,
    }),
  ].join("\n\n");
}

export function formatTopicName(userLite: UserLite) {
  return i18n.t(config.DEFAULT_LOCALE, "admin_group.topic_name", {
    name: userLite.name ?? "???",
    username: userLite.username ?? "???",
  });
}

export async function getUserForTopic(ctx: Context) {
  if (ctx.chat?.id !== config.ADMIN_GROUP) {
    ctx.logger.warn("Not an admin group");
    return;
  }
  const threadId = ctx.msg?.message_thread_id;
  if (threadId === undefined) {
    ctx.logger.warn("No message thread ID");
    return;
  }
  return (await getUserByAdminGroupTopic(threadId)) ?? undefined;
}

export async function banUser(
  ctx: Context,
  userLite: UserLite,
  banReason: string,
) {
  if (userLite.status === UserStatus.Banned) return;

  const bannedUser = await banUserDb(userLite.id, ctx.user.id, banReason);

  await sendMessageToAdminGroupTopic(
    ctx,
    bannedUser,
    i18n.t(config.DEFAULT_LOCALE, "admin_group.message_banned", {
      adminId: String(ctx.user.id),
      adminName: sanitizeHtmlOrEmpty(ctx.user.name),
      date: toFluentDateTime(bannedUser.bannedAt ?? new Date(0)),
      reason: banReason,
    }),
    {},
  );

  for (const chatId of [
    config.MEMBERS_GROUP,
    config.ADMIN_GROUP,
    config.CHANNEL,
  ]) {
    const channelMember = await ctx.api.getChatMember(chatId, bannedUser.id);
    if (
      channelMember.status === "administrator" &&
      !channelMember.can_be_edited
    ) {
      await sendMessageToAdminGroupTopic(
        ctx,
        bannedUser,
        i18n.t(
          config.DEFAULT_LOCALE,
          "admin_group.message_banned_privileged_user",
          {
            chat: {
              [config.MEMBERS_GROUP]: "MEMBERS_GROUP",
              [config.ADMIN_GROUP]: "ADMIN_GROUP",
              [config.CHANNEL]: "CHANNEL",
            }[chatId],
          },
        ),
        {},
      );
      continue;
    } else if (channelMember.status === "administrator") {
      await ctx.api.promoteChatMember(chatId, bannedUser.id, {
        is_anonymous: false,
        can_manage_chat: false,
        can_delete_messages: false,
        can_manage_video_chats: false,
        can_restrict_members: false,
        can_promote_members: false,
        can_change_info: false,
        can_invite_users: false,
        can_post_stories: false,
        can_edit_stories: false,
        can_delete_stories: false,
        can_post_messages: false,
        can_edit_messages: false,
        can_pin_messages: false,
        can_manage_topics: false,
      });
    }
    if (chatId !== config.CHANNEL) {
      await ctx.api.banChatMember(chatId, bannedUser.id);
    }
  }
}

export async function unbanUser(ctx: Context, userLite: UserLite) {
  if (userLite.status !== UserStatus.Banned) return;

  const unbannedUser = await unbanUserDb(userLite.id, ctx.user.id);

  for (const chatId of [
    config.MEMBERS_GROUP,
    config.ADMIN_GROUP,
    config.CHANNEL,
  ]) {
    const channelMember = await ctx.api.getChatMember(chatId, unbannedUser.id);
    if (channelMember.status === "kicked") {
      await ctx.api.unbanChatMember(chatId, unbannedUser.id);
    }
  }

  await sendMessageToAdminGroupTopic(
    ctx,
    unbannedUser,
    i18n.t(config.DEFAULT_LOCALE, "admin_group.message_unbanned", {
      adminId: String(ctx.user.id),
      adminName: sanitizeHtmlOrEmpty(ctx.user.name),
      date: toFluentDateTime(unbannedUser.verifiedAt ?? new Date(0)),
    }),
    {},
  );
}

const feature = composer
  .filter(isAdmin)
  .filter((ctx) => ctx.chatId === config.ADMIN_GROUP);

feature.command("about", logHandle("command:about"), async (ctx) => {
  const user = await getUserForTopic(ctx);
  if (user === undefined || user.adminGroupTopic === null) return;

  await sendAdminGroupUserMenu(ctx, user);
});
registerCommandHelp({
  command: "about",
  scope: CommandScope.AdminGroup,
  privileges: CommandPrivileges.Admins,
});

feature.command("ban", logHandle("command:ban"), async (ctx) => {
  const user = await getUserForTopic(ctx);
  if (user !== undefined) {
    const reason =
      /\/ban(?:@[a-zA-Z0-9_]*)?\s*(?<reason>.*)/u.exec(ctx.msg.text)?.groups
        ?.reason ?? "";
    await banUser(ctx, user, reason);
  }
});
registerCommandHelp({
  command: "ban",
  scope: CommandScope.AdminGroup,
  privileges: CommandPrivileges.Admins,
});

feature.command("unban", logHandle("command:unban"), async (ctx) => {
  const user = await getUserForTopic(ctx);
  if (user !== undefined) {
    await unbanUser(ctx, user);
  }
});
registerCommandHelp({
  command: "unban",
  scope: CommandScope.AdminGroup,
  privileges: CommandPrivileges.Admins,
});

feature
  .drop((ctx) => ctx.entities("bot_command").length > 0)
  .on("message", logHandle("message-to-user"), async (ctx) => {
    if (ctx.message.message_thread_id === undefined) {
      return;
    }

    const user = await getUserLiteByAdminGroupTopic(
      ctx.message.message_thread_id,
    );

    if (user !== null) {
      await copyMessageTo(ctx, user.id);
    }
  });

feature.on(
  "edited_message",
  logHandle("message-to-user-edit"),
  handleMessageEdit,
);
