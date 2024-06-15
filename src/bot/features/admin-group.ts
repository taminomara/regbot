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
import type { Context, Conversation } from "#root/bot/context.js";
import {
  adminGroupUserMenu,
  adminPostInterviewMenu,
} from "#root/bot/features/admin-group-menu.js";
import {
  copyMessageTo,
  handleMessageEdit,
} from "#root/bot/features/edit-cache.js";
import { isAdmin } from "#root/bot/filters/index.js";
import { maybeExternal } from "#root/bot/helpers/conversations.js";
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
  conversation: Conversation | null,
  ctx: Context,
  userLite: UserLite,
) {
  if (userLite.adminGroupTopic !== null) {
    return userLite.adminGroupTopic;
  }

  const user = await maybeExternal(conversation, async () =>
    getUserOrFail(userLite.id),
  );

  const topic = await ctx.api.createForumTopic(
    config.ADMIN_GROUP,
    formatTopicName(user),
  );

  await maybeExternal(conversation, async () =>
    setUserAdminGroupTopicId(user.id, topic.message_thread_id),
  );

  await ctx.api.sendMessage(config.ADMIN_GROUP, await formatAboutMe(user), {
    message_thread_id: topic.message_thread_id,
    reply_markup: adminGroupUserMenu,
  });

  return topic.message_thread_id;
}

/**
 * Update topic name after the user changes their data.
 * Does nothing if there is no topic for this user.
 *
 * @param ctx used to interact with the bot.
 * @param user user for whom the topic needs to be updated.
 */
export async function updateAdminGroupTopicTitle(ctx: Context, user: UserLite) {
  if (user.adminGroupTopic === null) return;

  try {
    await ctx.api.editForumTopic(config.ADMIN_GROUP, user.adminGroupTopic, {
      name: formatTopicName(user),
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

/**
 * Send message from a user to the given topic.
 */
export async function copyMessageToAdminGroupTopic(
  conversation: Conversation | null,
  ctx: Filter<Context, "message">,
  adminGroupTopic: number | null,
) {
  if (adminGroupTopic === null) return;
  await copyMessageTo(conversation, ctx, config.ADMIN_GROUP, {
    message_thread_id: adminGroupTopic,
  });
}

export async function sendInterviewQuestionToAdminGroupTopic(
  ctx: Context,
  adminGroupTopic: number | null,
  question: string,
) {
  await sendMessageToAdminGroupTopic(
    ctx,
    adminGroupTopic,
    i18n.t(config.DEFAULT_LOCALE, "admin_group.message_question", {
      question,
    }),
  );
}
export async function sendInterviewFinishNotificationToAdminGroupTopic(
  ctx: Context,
  adminGroupTopic: number | null,
) {
  await sendMessageToAdminGroupTopic(
    ctx,
    adminGroupTopic,
    i18n.t(config.DEFAULT_LOCALE, "admin_group.interview_finished"),
    {
      reply_markup: adminPostInterviewMenu,
    },
  );
}
export async function sendMessageToAdminGroupTopic(
  ctx: Context,
  adminGroupTopic: number | null,
  message: string,
  other?: Other<"sendMessage", "chat_id" | "text" | "message_thread_id">,
) {
  if (adminGroupTopic === null) return;
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
    i18n.t(config.DEFAULT_LOCALE, "admin_group.about", {
      name: sanitizeHtmlOrEmpty(user.name),
      pronouns: sanitizeHtmlOrEmpty(user.pronouns),
      gender: sanitizeHtmlOrEmpty(user.gender),
      sexuality: sanitizeHtmlOrEmpty(user.sexuality),
      status: user.status,
      username: sanitizeHtmlOrEmpty(user.username),
      details,
    }),
  ].join("\n\n");
}

export function formatTopicName(user: UserLite) {
  return i18n.t(config.DEFAULT_LOCALE, "admin_group.topic_name", {
    name: user.name ?? "???",
    username: user.username ?? "???",
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

export async function banUser(ctx: Context, user: UserLite, banReason: string) {
  if (user.status === UserStatus.Banned) return;

  const bannedUser = await banUserDb(user.id, ctx.user.id, banReason);

  await sendMessageToAdminGroupTopic(
    ctx,
    bannedUser.adminGroupTopic,
    i18n.t(config.DEFAULT_LOCALE, "admin_group.admin_message_banned", {
      adminId: String(ctx.user.id),
      adminName: sanitizeHtmlOrEmpty(ctx.user.name),
      date: toFluentDateTime(bannedUser.bannedAt ?? new Date(0)),
      reason: banReason,
    }),
  );

  try {
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
          bannedUser.adminGroupTopic,
          i18n.t(config.DEFAULT_LOCALE, "admin_group.banning_privileged_user", {
            chat: {
              [config.MEMBERS_GROUP]: "MEMBERS_GROUP",
              [config.ADMIN_GROUP]: "ADMIN_GROUP",
              [config.CHANNEL]: "CHANNEL",
            }[chatId],
          }),
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
  } catch (error) {
    ctx.logger.error(error);
  }
}

export async function unbanUser(ctx: Context, user: UserLite) {
  if (user.status !== UserStatus.Banned) return;

  const unbannedUser = await unbanUserDb(user.id, ctx.user.id);

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
    unbannedUser.adminGroupTopic,
    i18n.t(config.DEFAULT_LOCALE, "admin_group.admin_message_unbanned", {
      adminId: String(ctx.user.id),
      adminName: sanitizeHtmlOrEmpty(ctx.user.name),
      date: toFluentDateTime(unbannedUser.verifiedAt ?? new Date(0)),
    }),
  );
}

const feature = composer
  .filter(isAdmin)
  .filter((ctx) => ctx.chatId === config.ADMIN_GROUP);

feature.command("about", logHandle("admin-about"), async (ctx) => {
  const user = await getUserForTopic(ctx);
  if (user !== undefined) {
    await ctx.api.sendMessage(config.ADMIN_GROUP, await formatAboutMe(user), {
      message_thread_id: ctx.msg?.message_thread_id,
      reply_markup: adminGroupUserMenu,
    });
  }
});

feature.command("ban", logHandle("admin-ban"), async (ctx) => {
  const user = await getUserForTopic(ctx);
  if (user !== undefined) {
    const reason =
      /\/ban(?:@[a-zA-Z0-9_]*)?\s*(?<reason>.*)/u.exec(ctx.msg.text)?.groups
        ?.reason ?? "";
    await banUser(ctx, user, reason);
  }
});

feature.command("unban", logHandle("admin-unban"), async (ctx) => {
  const user = await getUserForTopic(ctx);
  if (user !== undefined) {
    await unbanUser(ctx, user);
  }
});

feature
  .drop((ctx) => ctx.entities("bot_command").length > 0)
  .on("message", logHandle("admin-to-user"), async (ctx) => {
    if (ctx.message.message_thread_id === undefined) {
      return;
    }

    const user = await getUserLiteByAdminGroupTopic(
      ctx.message.message_thread_id,
    );

    if (user !== null) {
      await copyMessageTo(null, ctx, user.id);
    }
  });

feature.on(
  "edited_message",
  logHandle("admin-to-user-edit"),
  handleMessageEdit,
);
