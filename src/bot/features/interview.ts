import { Composer, Filter, Keyboard } from "grammy";

import {
  UserLite,
  UserStatus,
  approveUser,
  rejectUser,
  updateUser,
} from "#root/backend/user.js";
import type { Context, Conversation } from "#root/bot/context.js";
import {
  copyMessageToAdminGroupTopic,
  ensureHasAdminGroupTopic,
  getUserForTopic,
  sendInterviewFinishNotificationToAdminGroupTopic,
  sendInterviewQuestionToAdminGroupTopic,
  sendMessageToAdminGroupTopic,
} from "#root/bot/features/admin-group.js";
import {
  editGender,
  editName,
  editPronouns,
  editSexuality,
} from "#root/bot/features/edit-user.js";
import { postInterviewSignup } from "#root/bot/features/event-signup.js";
import {
  createConversation,
  waitForSkipCommands,
} from "#root/bot/helpers/conversations.js";
import { toFluentDateTime } from "#root/bot/helpers/i18n.js";
import { sanitizeHtmlOrEmpty } from "#root/bot/helpers/sanitize-html.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

export const composer = new Composer<Context>();

export const enterInterview = async (ctx: Context) => {
  await ctx.conversation.enter("interview", { overwrite: true });
};

async function interview(conversation: Conversation, ctx: Context) {
  if (
    [UserStatus.New, UserStatus.InterviewInProgress].includes(ctx.user.status)
  ) {
    await ctx.reply(ctx.t("interview.i_dont_know_you"));
  } else {
    await ctx.reply(ctx.t("interview.i_know_you"));
  }

  if (!ctx.user.finishedInitialSurvey) {
    ctx.chatAction = "typing";

    await editName(conversation, ctx, true);
    await editPronouns(conversation, ctx, true);
    await editGender(conversation, ctx, true);
    await editSexuality(conversation, ctx, true);

    await conversation.external(async () => {
      await updateUser(ctx.user.id, { finishedInitialSurvey: true });
    });
  }

  const adminGroupTopic = await ensureHasAdminGroupTopic(
    conversation,
    ctx,
    ctx.user,
  );

  if (
    [UserStatus.New, UserStatus.InterviewInProgress].includes(ctx.user.status)
  ) {
    await conversation.external(async () => {
      await updateUser(ctx.user.id, { status: UserStatus.InterviewInProgress });
    });

    {
      const question = ctx.t("interview.areyou18");
      await ctx.reply(question, {
        reply_markup: new Keyboard()
          .text(ctx.t("interview.areyou18_yes"))
          .text(ctx.t("interview.areyou18_no"))
          .resized()
          .oneTime(),
      });
      await sendInterviewQuestionToAdminGroupTopic(
        ctx,
        adminGroupTopic,
        question,
      );
      const reply = await waitForSkipCommands(conversation, "message:text");
      await copyMessageToAdminGroupTopic(conversation, reply, adminGroupTopic);
    }
    {
      const question = ctx.t("interview.rules");
      await ctx.reply(question, {
        reply_markup: new Keyboard()
          .text(ctx.t("interview.rules_yes"))
          .text(ctx.t("interview.rules_no"))
          .resized()
          .oneTime(),
      });
      await sendInterviewQuestionToAdminGroupTopic(
        ctx,
        adminGroupTopic,
        question,
      );
      const reply = await waitForSkipCommands(conversation, "message:text");
      await copyMessageToAdminGroupTopic(conversation, reply, adminGroupTopic);
    }

    await ctx.reply(ctx.t("interview.multiline_questions"), {
      reply_markup: new Keyboard().text("/next").resized().persistent(),
    });

    await ctx.api.setMyCommands(
      [
        {
          command: "/next",
          description: ctx.t("interview.next"),
        },
      ],
      {
        scope: {
          type: "chat",
          chat_id: ctx.user.id,
        },
      },
    );

    {
      const question = ctx.t("interview.experience");
      await ctx.reply(question);
      await sendInterviewQuestionToAdminGroupTopic(
        ctx,
        adminGroupTopic,
        question,
      );
      await waitForNext(conversation, ctx, adminGroupTopic);
    }
    {
      const question = ctx.t("interview.how_do_you_know_us");
      await ctx.reply(question);
      await sendInterviewQuestionToAdminGroupTopic(
        ctx,
        adminGroupTopic,
        question,
      );
      await waitForNext(conversation, ctx, adminGroupTopic);
    }
    {
      const question = ctx.t("interview.active_consent");
      await ctx.reply(question);
      await sendInterviewQuestionToAdminGroupTopic(
        ctx,
        adminGroupTopic,
        question,
      );
      await waitForNext(conversation, ctx, adminGroupTopic);
    }
    {
      const question = ctx.t("interview.lgbt_check");
      await ctx.reply(question);
      await sendInterviewQuestionToAdminGroupTopic(
        ctx,
        adminGroupTopic,
        question,
      );
      await waitForNext(conversation, ctx, adminGroupTopic);
    }
    {
      const question = ctx.t("interview.transgender_check");
      await ctx.reply(question);
      await sendInterviewQuestionToAdminGroupTopic(
        ctx,
        adminGroupTopic,
        question,
      );
      await waitForNext(conversation, ctx, adminGroupTopic);
    }
    {
      const question = ctx.t("interview.personal_borders");
      await ctx.reply(question);
      await sendInterviewQuestionToAdminGroupTopic(
        ctx,
        adminGroupTopic,
        question,
      );
      await waitForNext(conversation, ctx, adminGroupTopic);
    }

    ctx.chatAction = "typing";

    await ctx.api.deleteMyCommands({
      scope: {
        type: "chat",
        chat_id: ctx.user.id,
      },
    });

    await conversation.external(async () => {
      await updateUser(ctx.user.id, { status: UserStatus.PendingApproval });
    });
    await sendInterviewFinishNotificationToAdminGroupTopic(
      ctx,
      adminGroupTopic,
    );

    await ctx.reply(ctx.t("interview.interview_replies_saved"), {
      reply_markup: { remove_keyboard: true },
    });
  } else {
    await sendApproveMessage(ctx, ctx.user);
    await postInterviewSignup(conversation, ctx);
  }
}

composer.use(createConversation(interview));

async function waitForNext(
  conversation: Conversation,
  ctx: Context,
  adminGroupTopic: number,
) {
  let hasResponses = false;
  while (true) {
    const reply = await conversation.waitUntil(
      (ctx): ctx is Filter<Context, "message:text"> =>
        ctx.has("message:text") &&
        (ctx.entities("bot_command").length === 0 || ctx.hasCommand("next")),
    );
    if (reply.hasCommand("next")) {
      if (hasResponses) {
        return;
      }

      await ctx.reply(ctx.t("interview.send_more_replies"));
    } else {
      hasResponses = true;
      await copyMessageToAdminGroupTopic(conversation, reply, adminGroupTopic);
    }
  }
}

export async function approve(ctx: Context) {
  const user = await getUserForTopic(ctx);
  if (user === undefined || user.status !== UserStatus.PendingApproval) return;

  const approvedUser = await approveUser(user.id, ctx.user.id);

  await sendMessageToAdminGroupTopic(
    ctx,
    approvedUser.adminGroupTopic,
    i18n.t(config.DEFAULT_LOCALE, "interview.admin_message_approved", {
      adminId: String(ctx.user.id),
      adminName: sanitizeHtmlOrEmpty(ctx.user.name),
      date: toFluentDateTime(approvedUser.verifiedAt ?? new Date(0)),
    }),
  );

  await sendApproveMessage(ctx, approvedUser);
  await postInterviewSignup(null, ctx, approvedUser);
}

async function sendApproveMessage(ctx: Context, approvedUser: UserLite) {
  const memberGroup = await ctx.api.getChat(config.MEMBERS_GROUP);
  await ctx.api.sendMessage(
    approvedUser.id,
    i18n.t(
      approvedUser.locale || config.DEFAULT_LOCALE,
      "interview.user_message_approved",
      {
        chatLink: memberGroup.invite_link ?? "",
      },
    ),
    {
      protect_content: true,
      reply_markup: { remove_keyboard: true },
    },
  );
}

export async function reject(ctx: Context) {
  const user = await getUserForTopic(ctx);
  if (user === undefined || user.status !== UserStatus.PendingApproval) return;

  const rejectedUser = await rejectUser(user.id, ctx.user.id);

  await sendMessageToAdminGroupTopic(
    ctx,
    rejectedUser.adminGroupTopic,
    i18n.t(config.DEFAULT_LOCALE, "interview.admin_message_rejected", {
      adminId: String(ctx.user.id),
      adminName: sanitizeHtmlOrEmpty(ctx.user.name),
      date: toFluentDateTime(rejectedUser.verifiedAt ?? new Date(0)),
    }),
  );

  const memberGroup = await ctx.api.getChat(config.MEMBERS_GROUP);
  await ctx.api.sendMessage(
    rejectedUser.id,
    i18n.t(
      rejectedUser.locale || config.DEFAULT_LOCALE,
      "interview.user_message_rejected",
      {
        chatLink: memberGroup.invite_link ?? "",
      },
    ),
  );
}
