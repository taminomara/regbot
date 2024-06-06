import { Other } from "@grammyjs/hydrate";
import { Composer, Filter, GrammyError } from "grammy";

import {
  User,
  UserLite,
  UserStatus,
  getUserByAdminGroupTopic,
  getUserLiteByAdminGroupTopic,
  getUserOrFail,
  setUserAdminGroupTopicId,
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

  await ctx.api.sendMessage(config.ADMIN_GROUP, formatAboutMe(user), {
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
    if (
      error instanceof GrammyError &&
      error.error_code === 400 &&
      error.description.includes("TOPIC_NOT_MODIFIED")
    ) {
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

export function formatAboutMe(user: User) {
  return [
    i18n.t(config.DEFAULT_LOCALE, "admin_group.topic_header", {
      id: String(user.id),
      name: sanitizeHtmlOrEmpty(user.name),
    }),
    i18n.t(config.DEFAULT_LOCALE, "admin_group.about", {
      name: sanitizeHtmlOrEmpty(user.name),
      pronouns: sanitizeHtmlOrEmpty(user.pronouns),
      gender: sanitizeHtmlOrEmpty(user.gender),
      sexuality: sanitizeHtmlOrEmpty(user.sexuality),
      status: {
        [UserStatus.New]: "New",
        [UserStatus.InterviewInProgress]: "InterviewInProgress",
        [UserStatus.PendingApproval]: "PendingApproval",
        [UserStatus.Approved]: "Approved",
        [UserStatus.Rejected]: "Rejected",
        [UserStatus.Banned]: "Banned",
      }[user.status],
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

const feature = composer
  .filter(isAdmin)
  .filter((ctx) => ctx.chatId === config.ADMIN_GROUP);

feature.command("about", logHandle("admin-about"), async (ctx) => {
  const user = await getUserForTopic(ctx);
  if (user !== undefined) {
    await ctx.api.sendMessage(config.ADMIN_GROUP, formatAboutMe(user), {
      message_thread_id: ctx.msg?.message_thread_id,
      reply_markup: adminGroupUserMenu,
    });
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
