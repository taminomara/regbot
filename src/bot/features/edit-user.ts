import { createConversation } from "@grammyjs/conversations";
import { Composer, Keyboard } from "grammy";

import { UserLite } from "#root/backend/entities/user.js";
import {
  getUserOrFail,
  setUserGender,
  setUserName,
  setUserPronouns,
  setUserSexuality,
} from "#root/backend/user.js";
import type { Context, Conversation } from "#root/bot/context.js";
import { updateAdminGroupTopicTitle } from "#root/bot/features/admin-group.js";
import { waitForSkipCommands } from "#root/bot/helpers/conversations.js";

export const composer = new Composer<Context>();

export async function editName(
  conversation: Conversation,
  ctx: Context,
  user?: UserLite,
) {
  const userId = user?.id ?? ctx.interviewEditData?.userId;
  if (userId === undefined) return;

  await ctx.reply(
    user === undefined ? ctx.t("interview.edit_name") : ctx.t("interview.name"),
    { message_thread_id: ctx.msg?.message_thread_id },
  );
  const { message } = await waitForSkipCommands(conversation, "message:text");
  await conversation.external(async () => {
    await setUserName(userId, message.text);
  });

  if (user === undefined) {
    await sendEditConfirmation(ctx, conversation, userId);
  }
}

export async function editPronouns(
  conversation: Conversation,
  ctx: Context,
  user?: UserLite,
) {
  const userId = user?.id ?? ctx.interviewEditData?.userId;
  if (userId === undefined) return;

  await ctx.reply(
    user === undefined
      ? ctx.t("interview.edit_pronouns")
      : ctx.t("interview.pronouns"),
    {
      reply_markup: new Keyboard()
        .text(ctx.t("interview.pronouns_they_them"))
        .text(ctx.t("interview.pronouns_she_her"))
        .text(ctx.t("interview.pronouns_he_him"))
        .text(ctx.t("interview.pronouns_it_its"))
        .placeholder(ctx.t("interview.can_use_custom_pronouns"))
        .resized()
        .oneTime(),
      message_thread_id: ctx.msg?.message_thread_id,
    },
  );
  const { message } = await waitForSkipCommands(conversation, "message:text");
  await conversation.external(async () => {
    await setUserPronouns(userId, message.text);
  });

  if (user === undefined) {
    await sendEditConfirmation(ctx, conversation, userId);
  }
}

export async function editGender(
  conversation: Conversation,
  ctx: Context,
  user?: UserLite,
) {
  const userId = user?.id ?? ctx.interviewEditData?.userId;
  if (userId === undefined) return;

  await ctx.reply(
    user === undefined
      ? ctx.t("interview.edit_gender")
      : ctx.t("interview.gender"),
    {
      reply_markup: new Keyboard()
        .text(ctx.t("interview.gender_nonbinary"))
        .text(ctx.t("interview.gender_woman"))
        .text(ctx.t("interview.gender_man"))
        .placeholder(ctx.t("interview.can_use_custom_gender"))
        .resized()
        .oneTime(),
      message_thread_id: ctx.msg?.message_thread_id,
    },
  );
  const { message } = await waitForSkipCommands(conversation, "message:text");
  await conversation.external(async () => {
    await setUserGender(userId, message.text);
  });

  if (user === undefined) {
    await sendEditConfirmation(ctx, conversation, userId);
  }
}

export async function editSexuality(
  conversation: Conversation,
  ctx: Context,
  user?: UserLite,
) {
  const userId = user?.id ?? ctx.interviewEditData?.userId;
  if (userId === undefined) return;

  await ctx.reply(
    user === undefined
      ? ctx.t("interview.edit_sexuality")
      : ctx.t("interview.sexuality"),
    {
      reply_markup: new Keyboard()
        .text(ctx.t("interview.sexuality_bisexual"))
        .text(ctx.t("interview.sexuality_homosexual"))
        .text(ctx.t("interview.sexuality_heterosexual"))
        .placeholder(ctx.t("interview.can_use_custom_sexuality"))
        .resized()
        .oneTime(),
      message_thread_id: ctx.msg?.message_thread_id,
    },
  );
  const { message } = await waitForSkipCommands(conversation, "message:text");
  await conversation.external(async () => {
    await setUserSexuality(userId, message.text);
  });

  if (user === undefined) {
    await sendEditConfirmation(ctx, conversation, userId);
  }
}

async function sendEditConfirmation(
  ctx: Context,
  conversation: Conversation,
  userId: number,
) {
  await ctx.reply(ctx.t("interview.edit_success"), {
    reply_markup: { remove_keyboard: true },
    message_thread_id: ctx.msg?.message_thread_id,
  });
  const user = await conversation.external(async () => getUserOrFail(userId));
  await updateAdminGroupTopicTitle(ctx, user);
}

composer.use(createConversation(editName));
composer.use(createConversation(editPronouns));
composer.use(createConversation(editGender));
composer.use(createConversation(editSexuality));

async function enterEditMe(
  conversationIdent: string,
  ctx: Context,
  userId?: number,
) {
  if (!(await checkNoConversations(ctx))) {
    return;
  }

  ctx.interviewEditData = {
    userId: userId ?? ctx.user.id,
  };
  await ctx.conversation.enter(conversationIdent, { overwrite: true });
}

export async function enterEditName(ctx: Context, userId?: number) {
  await enterEditMe("editName", ctx, userId);
}

export async function enterEditPronouns(ctx: Context, userId?: number) {
  await enterEditMe("editPronouns", ctx, userId);
}

export async function enterEditGender(ctx: Context, userId?: number) {
  await enterEditMe("editGender", ctx, userId);
}

export async function enterEditSexuality(ctx: Context, userId?: number) {
  await enterEditMe("editSexuality", ctx, userId);
}

async function checkNoConversations(ctx: Context) {
  const activeConversations = await ctx.conversation.active();
  if ("interview" in activeConversations) {
    await ctx.reply(ctx.t("interview.finish_interview_first"), {
      message_thread_id: ctx.msg?.message_thread_id,
    });
    return false;
  }
  if ("editName" in activeConversations) {
    await ctx.reply(ctx.t("interview.edit_name_first"), {
      message_thread_id: ctx.msg?.message_thread_id,
    });
    return false;
  }
  if ("editPronouns" in activeConversations) {
    await ctx.reply(ctx.t("interview.edit_pronouns_first"), {
      message_thread_id: ctx.msg?.message_thread_id,
    });
    return false;
  }
  if ("editGender" in activeConversations) {
    await ctx.reply(ctx.t("interview.edit_gender_first"), {
      message_thread_id: ctx.msg?.message_thread_id,
    });
    return false;
  }
  if ("editSexuality" in activeConversations) {
    await ctx.reply(ctx.t("interview.edit_sexuality_first"), {
      message_thread_id: ctx.msg?.message_thread_id,
    });
    return false;
  }

  return true;
}
