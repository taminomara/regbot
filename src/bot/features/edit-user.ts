import { Composer, Keyboard } from "grammy";

import {
  getUser,
  getUserByAdminGroupTopic,
  getUserOrFail,
  setUserGender,
  setUserName,
  setUserPronouns,
  setUserSexuality,
} from "#root/backend/user.js";
import type { Context, Conversation } from "#root/bot/context.js";
import { updateAdminGroupTopicTitle } from "#root/bot/features/admin-group.js";
import {
  createConversation,
  waitForSkipCommands,
} from "#root/bot/helpers/conversations.js";
import { config } from "#root/config.js";

export const composer = new Composer<Context>();

export async function editName(
  conversation: Conversation,
  ctx: Context,
  inInterview?: boolean,
) {
  const user = await conversation.external(async () => {
    const threadId = ctx.msg?.message_thread_id;
    if (threadId !== undefined && ctx.chatId === config.ADMIN_GROUP) {
      return getUserByAdminGroupTopic(threadId);
    }
    return getUser(ctx.user.id);
  });
  if (user === null) return;

  await ctx.reply(
    inInterview ? ctx.t("interview.name") : ctx.t("interview.edit_name"),
    { message_thread_id: ctx.msg?.message_thread_id },
  );
  const { reply, command } = await waitForSkipCommands(
    conversation,
    "message:text",
    inInterview ? [] : ["cancel"],
  );
  if (command !== "cancel") {
    await conversation.external(async () => {
      await setUserName(user.id, reply.message.text);
    });
  }

  if (!inInterview) {
    await sendEditConfirmation(
      conversation,
      reply,
      user.id,
      command === "cancel",
    );
  }
}

export async function editPronouns(
  conversation: Conversation,
  ctx: Context,
  inInterview?: boolean,
) {
  const user = await conversation.external(async () => {
    const threadId = ctx.msg?.message_thread_id;
    if (threadId !== undefined && ctx.chatId === config.ADMIN_GROUP) {
      return getUserByAdminGroupTopic(threadId);
    }
    return getUser(ctx.user.id);
  });
  if (user === null) return;

  await ctx.reply(
    inInterview
      ? ctx.t("interview.pronouns")
      : ctx.t("interview.edit_pronouns"),
    {
      reply_markup: new Keyboard()
        .text(ctx.t("interview.pronouns_they_them"))
        .text(ctx.t("interview.pronouns_she_her"))
        .row()
        .text(ctx.t("interview.pronouns_he_him"))
        .text(ctx.t("interview.pronouns_it_its"))
        .placeholder(ctx.t("interview.can_use_custom_pronouns"))
        .resized()
        .oneTime(),
      message_thread_id: ctx.msg?.message_thread_id,
    },
  );
  const { reply, command } = await waitForSkipCommands(
    conversation,
    "message:text",
    inInterview ? [] : ["cancel"],
  );
  if (command !== "cancel") {
    await conversation.external(async () => {
      await setUserPronouns(user.id, reply.message.text);
    });
  }

  if (!inInterview) {
    await sendEditConfirmation(
      conversation,
      reply,
      user.id,
      command === "cancel",
    );
  }
}

export async function editGender(
  conversation: Conversation,
  ctx: Context,
  inInterview?: boolean,
) {
  const user = await conversation.external(async () => {
    const threadId = ctx.msg?.message_thread_id;
    if (threadId !== undefined && ctx.chatId === config.ADMIN_GROUP) {
      return getUserByAdminGroupTopic(threadId);
    }
    return getUser(ctx.user.id);
  });
  if (user === null) return;

  await ctx.reply(
    inInterview ? ctx.t("interview.gender") : ctx.t("interview.edit_gender"),
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
  const { reply, command } = await waitForSkipCommands(
    conversation,
    "message:text",
    inInterview ? [] : ["cancel"],
  );
  if (command !== "cancel") {
    await conversation.external(async () => {
      await setUserGender(user.id, reply.message.text);
    });
  }

  if (!inInterview) {
    await sendEditConfirmation(
      conversation,
      reply,
      user.id,
      command === "cancel",
    );
  }
}

export async function editSexuality(
  conversation: Conversation,
  ctx: Context,
  inInterview?: boolean,
) {
  const user = await conversation.external(async () => {
    const threadId = ctx.msg?.message_thread_id;
    if (threadId !== undefined && ctx.chatId === config.ADMIN_GROUP) {
      return getUserByAdminGroupTopic(threadId);
    }
    return getUser(ctx.user.id);
  });
  if (user === null) return;

  await ctx.reply(
    inInterview
      ? ctx.t("interview.sexuality")
      : ctx.t("interview.edit_sexuality"),
    {
      reply_markup: new Keyboard()
        .text(ctx.t("interview.sexuality_pansexual"))
        .text(ctx.t("interview.sexuality_bisexual"))
        .row()
        .text(ctx.t("interview.sexuality_homosexual"))
        .text(ctx.t("interview.sexuality_heterosexual"))
        .placeholder(ctx.t("interview.can_use_custom_sexuality"))
        .resized()
        .oneTime(),
      message_thread_id: ctx.msg?.message_thread_id,
    },
  );

  const { reply, command } = await waitForSkipCommands(
    conversation,
    "message:text",
    inInterview ? [] : ["cancel"],
  );
  if (command !== "cancel") {
    await conversation.external(async () => {
      await setUserSexuality(user.id, reply.message.text);
    });
  }

  if (!inInterview) {
    await sendEditConfirmation(
      conversation,
      reply,
      user.id,
      command === "cancel",
    );
  }
}

async function sendEditConfirmation(
  conversation: Conversation,
  ctx: Context,
  userId: number,
  canceled: boolean,
) {
  await ctx.reply(
    ctx.t(canceled ? "interview.edit_cancel" : "interview.edit_success"),
    {
      reply_markup: { remove_keyboard: true },
      message_thread_id: ctx.msg?.message_thread_id,
      reply_to_message_id: ctx.msgId,
    },
  );
  const user = await conversation.external(async () => getUserOrFail(userId));
  await updateAdminGroupTopicTitle(ctx, user);
}

composer.use(createConversation(editName));
composer.use(createConversation(editPronouns));
composer.use(createConversation(editGender));
composer.use(createConversation(editSexuality));

async function enterEditMe(conversationIdent: string, ctx: Context) {
  if (!(await checkNoConversations(ctx))) {
    return;
  }

  await ctx.conversation.enter(conversationIdent, { overwrite: true });
}

export async function enterEditName(ctx: Context) {
  await enterEditMe("editName", ctx);
}

export async function enterEditPronouns(ctx: Context) {
  await enterEditMe("editPronouns", ctx);
}

export async function enterEditGender(ctx: Context) {
  await enterEditMe("editGender", ctx);
}

export async function enterEditSexuality(ctx: Context) {
  await enterEditMe("editSexuality", ctx);
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
