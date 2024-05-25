import { createConversation } from "@grammyjs/conversations";
import type { Context, Conversation } from "#root/bot/context.js";
import { Composer, Filter, Keyboard } from "grammy";
import { waitForSkipCommands } from "#root/bot/helpers/conversations.js";
import { updateUser, UserStatus } from "#root/backend/user.js";
import {
  copyMessageToAdminGroupTopic,
  ensureHasAdminGroupTopic,
  sendInfoToAdminGroupTopic,
  sendInterviewQuestionToAdminGroupTopic,
} from "#root/bot/features/admin-group.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";
import {
  editGender,
  editName,
  editPronouns,
  editSexuality,
} from "#root/bot/features/edit-user.js";

export const composer = new Composer<Context>();

export const enterInterview = async (ctx: Context) => {
  await ctx.conversation.enter("interview", { overwrite: true });
};

async function interview(conversation: Conversation, ctx: Context) {
  const user = await conversation.external(() => ctx.user);

  if (user.status in [UserStatus.New, UserStatus.InterviewInProgress]) {
    await ctx.reply(ctx.t("interview.i_dont_know_you"));
  } else {
    await ctx.reply(ctx.t("interview.i_know_you"));
  }

  if (!user.finishedInitialSurvey) {
    ctx.chatAction = "typing";

    await editName(conversation, ctx, user);
    await editPronouns(conversation, ctx, user);
    await editGender(conversation, ctx, user);
    await editSexuality(conversation, ctx, user);

    await conversation.external(async () => {
      await ensureHasAdminGroupTopic(ctx, user);
      await updateUser(user.id, { finishedInitialSurvey: true });
    });
  }

  if (user.status in [UserStatus.New, UserStatus.InterviewInProgress]) {
    await conversation.external(async () => {
      await updateUser(user.id, { status: UserStatus.InterviewInProgress });
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
      await sendInterviewQuestionToAdminGroupTopic(ctx, question);
      const reply = await waitForSkipCommands(conversation, "message:text");
      await copyMessageToAdminGroupTopic(reply);
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
      await sendInterviewQuestionToAdminGroupTopic(ctx, question);
      const reply = await waitForSkipCommands(conversation, "message:text");
      await copyMessageToAdminGroupTopic(reply);
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
          chat_id: user.id,
        },
      },
    );

    {
      const question = ctx.t("interview.experience");
      await ctx.reply(question);
      await sendInterviewQuestionToAdminGroupTopic(ctx, question);
      await waitForNext(conversation, ctx);
    }
    {
      const question = ctx.t("interview.how_do_you_know_us");
      await ctx.reply(question);
      await sendInterviewQuestionToAdminGroupTopic(ctx, question);
      await waitForNext(conversation, ctx);
    }
    {
      const question = ctx.t("interview.active_consent");
      await ctx.reply(question);
      await sendInterviewQuestionToAdminGroupTopic(ctx, question);
      await waitForNext(conversation, ctx);
    }
    {
      const question = ctx.t("interview.lgbt_check");
      await ctx.reply(question);
      await sendInterviewQuestionToAdminGroupTopic(ctx, question);
      await waitForNext(conversation, ctx);
    }
    {
      const question = ctx.t("interview.transgender_check");
      await ctx.reply(question);
      await sendInterviewQuestionToAdminGroupTopic(ctx, question);
      await waitForNext(conversation, ctx);
    }
    {
      const question = ctx.t("interview.personal_borders");
      await ctx.reply(question);
      await sendInterviewQuestionToAdminGroupTopic(ctx, question);
      await waitForNext(conversation, ctx);
    }

    ctx.chatAction = "typing";

    await ctx.api.deleteMyCommands({
      scope: {
        type: "chat",
        chat_id: user.id,
      },
    });

    await sendInfoToAdminGroupTopic(
      ctx,
      i18n.t(config.DEFAULT_LOCALE, "interview.admin_message"),
    );
    await conversation.external(async () => {
      await updateUser(user.id, { status: UserStatus.PendingApproval });
    });

    await ctx.reply(ctx.t("interview.interview_replies_saved"), {
      reply_markup: { remove_keyboard: true },
    });
  } else {
    await ctx.reply(ctx.t("interview.replies_saved"), {
      reply_markup: { remove_keyboard: true },
    });
  }
}

composer.use(createConversation(interview));

async function waitForNext(conversation: Conversation, ctx: Context) {
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
      await copyMessageToAdminGroupTopic(reply);
    }
  }
}
