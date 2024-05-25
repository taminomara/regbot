import type { Context } from "#root/bot/context.js";
import { User, UserLite } from "#root/backend/entities/user.js";
import {
  getUserByAdminGroupTopicOrFail,
  getUserLiteByAdminGroupTopic,
  getUserOrFail,
  setUserAdminGroupTopicId,
} from "#root/backend/user.js";
import { config } from "#root/config.js";
import { sanitizeHtmlOrEmpty } from "#root/bot/helpers/sanitize-html.js";
import { Composer, Filter, GrammyError } from "grammy";
import { logHandle } from "#root/bot/helpers/logging.js";
import { isAdmin } from "#root/bot/filters/index.js";
import {
  copyMessageTo,
  handleMessageEdit,
} from "#root/bot/features/edit-cache.js";
import { i18n } from "#root/bot/i18n.js";
import { logger } from "#root/logger.js";
import { adminGroupUserMenu } from "#root/bot/features/admin-group-menu.js";

export const composer = new Composer<Context>();

/**
 * Make sure that there is a topic in the admin forum about the given user.
 *
 * @param ctx used to interact with the bot.
 * @param userLite user for whom the topic needs to be present.
 * @returns ID of the user topic.
 */
export async function ensureHasAdminGroupTopic(
  ctx: Context,
  userLite: UserLite,
) {
  if (userLite.adminGroupTopic !== null) {
    return userLite.adminGroupTopic;
  }

  const user = await getUserOrFail(userLite.id);

  const topic = await ctx.api.createForumTopic(
    config.ADMIN_GROUP,
    formatTopicName(user),
  );

  await setUserAdminGroupTopicId(user.id, topic.message_thread_id);

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
        logger.debug("ignored TOPIC_NOT_MODIFIED error");
      } else {
        logger.warn(error);
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
  ctx: Filter<Context, "message">,
) {
  if (ctx.user.adminGroupTopic === null) return;
  await copyMessageTo(ctx, config.ADMIN_GROUP, {
    message_thread_id: ctx.user.adminGroupTopic,
  });
}

export async function sendInterviewQuestionToAdminGroupTopic(
  ctx: Context,
  question: string,
) {
  await sendMessageToAdminGroupTopic(
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "admin_group.message_question", {
      question,
    }),
  );
}
export async function sendInfoToAdminGroupTopic(ctx: Context, info: string) {
  await sendMessageToAdminGroupTopic(
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "admin_group.message_info", {
      info,
    }),
  );
}
export async function sendMessageToAdminGroupTopic(
  ctx: Context,
  message: string,
) {
  if (ctx.user.adminGroupTopic === null) return;

  await ctx.api.sendMessage(config.ADMIN_GROUP, message, {
    message_thread_id: ctx.user.adminGroupTopic,
  });
}

export function formatAboutMe(user: User) {
  return [
    i18n.t(config.DEFAULT_LOCALE, "admin_group.topic_header", {
      id: user.id,
      name: sanitizeHtmlOrEmpty(user.name),
    }),
    i18n.t(config.DEFAULT_LOCALE, "menu.about", {
      name: sanitizeHtmlOrEmpty(user.name),
      pronouns: sanitizeHtmlOrEmpty(user.pronouns),
      gender: sanitizeHtmlOrEmpty(user.gender),
      sexuality: sanitizeHtmlOrEmpty(user.sexuality),
    }),
  ].join("\n\n");
}

export function formatTopicName(user: UserLite) {
  return i18n.t(config.DEFAULT_LOCALE, "admin_group.topic_name", {
    name: sanitizeHtmlOrEmpty(user.name),
    username: sanitizeHtmlOrEmpty(user.username),
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
  return getUserByAdminGroupTopicOrFail(threadId);
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
      await copyMessageTo(ctx, user.id);
    }
  });

feature.on(
  "edited_message",
  logHandle("admin-to-user-edit"),
  handleMessageEdit,
);
