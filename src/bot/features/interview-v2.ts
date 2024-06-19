// State-machine based approach to interview, because the native conversations
// engine breaks too often.
import { ReplyKeyboardMarkup } from "@grammyjs/types";
import { Composer, Filter, Keyboard } from "grammy";

import { UserStatus } from "#root/backend/entities/user.js";
import {
  setUserGender,
  setUserName,
  setUserPronouns,
  setUserSexuality,
  updateUser,
} from "#root/backend/user.js";
import { Context } from "#root/bot/context.js";
import {
  copyMessageToAdminGroupTopic,
  ensureHasAdminGroupTopic,
  sendInterviewFinishNotificationToAdminGroupTopic,
  sendInterviewQuestionToAdminGroupTopic,
} from "#root/bot/features/admin-group.js";
import { postInterviewSignup } from "#root/bot/features/event-signup.js";
import { sendApproveMessage } from "#root/bot/features/interview.js";
import { config } from "#root/config.js";

export const composer = new Composer<Context>();

type Message = Filter<Context, "message:text">;
enum InterviewStepResult {
  DoNext,
  WaitForResponseAndDoNext,
  WaitForResponseAndRepeat,
  FinishInterview,
}
type InterviewStep = (ctx: Message) => Promise<InterviewStepResult>;

export async function startInterview(ctx: Message) {
  ctx.session.interviewStep = 0;
  await runInterview(ctx);
}

/**
 * Move an interview one step back and repeat.
 * This is used for repeating questions after the user changes their language.
 */
export async function backtrackInterview(ctx: Message) {
  if (ctx.session.interviewStep === undefined) return;

  if (ctx.session.interviewStep > 0) {
    ctx.session.interviewStep -= 1;
  }
  await runInterview(ctx);
}

async function runInterview(ctx: Message) {
  if (ctx.session.interviewStep === undefined) return;

  while (ctx.session.interviewStep < interviewSteps.length) {
    const result = await interviewSteps[ctx.session.interviewStep](ctx);
    switch (result) {
      case InterviewStepResult.WaitForResponseAndRepeat:
        // Repeat the same stage after user gives their answer.
        return;
      case InterviewStepResult.WaitForResponseAndDoNext:
        // Run the next stage after user gives their answer.
        ctx.session.interviewStep += 1;
        return;
      case InterviewStepResult.FinishInterview:
        // Finish the interview early.
        ctx.session.interviewStep = interviewSteps.length;
        break;
      case InterviewStepResult.DoNext:
        // Immediately continue to the next stage.
        ctx.session.interviewStep += 1;
        break;
    }
  }

  // Interview is finished.
  ctx.session.interviewStep = undefined;
}

const interviewSteps: InterviewStep[] = [
  // Welcome
  async (ctx) => {
    await ctx.reply(ctx.t("welcome"));
    if (ctx.user.status === UserStatus.Approved) {
      await ctx.reply(ctx.t("interview.i_know_you"));
    } else {
      await ctx.reply(ctx.t("interview.i_dont_know_you"));
    }
    return InterviewStepResult.DoNext;
  },

  // Name
  async (ctx) => {
    await ctx.reply(ctx.t("interview.name"));
    return InterviewStepResult.WaitForResponseAndDoNext;
  },
  async (ctx) => {
    await setUserName(ctx.user.id, ctx.message.text);
    return InterviewStepResult.DoNext;
  },

  // Pronouns
  async (ctx) => {
    await ctx.reply(ctx.t("interview.pronouns"), {
      reply_markup: new Keyboard()
        .text(ctx.t("interview.pronouns_they_them"))
        .text(ctx.t("interview.pronouns_she_her"))
        .row()
        .text(ctx.t("interview.pronouns_he_him"))
        .text(ctx.t("interview.pronouns_it_its"))
        .placeholder(ctx.t("interview.can_use_custom_pronouns"))
        .resized(),
    });
    return InterviewStepResult.WaitForResponseAndDoNext;
  },
  async (ctx) => {
    await setUserPronouns(ctx.user.id, ctx.message.text);
    return InterviewStepResult.DoNext;
  },

  // Gender
  async (ctx) => {
    await ctx.reply(ctx.t("interview.gender"), {
      reply_markup: new Keyboard()
        .text(ctx.t("interview.gender_nonbinary"))
        .text(ctx.t("interview.gender_woman"))
        .text(ctx.t("interview.gender_man"))
        .placeholder(ctx.t("interview.can_use_custom_gender"))
        .resized(),
    });
    return InterviewStepResult.WaitForResponseAndDoNext;
  },
  async (ctx) => {
    await setUserGender(ctx.user.id, ctx.message.text);
    return InterviewStepResult.DoNext;
  },

  // Sexuality
  async (ctx) => {
    await ctx.reply(ctx.t("interview.sexuality"), {
      reply_markup: new Keyboard()
        .text(ctx.t("interview.sexuality_pansexual"))
        .text(ctx.t("interview.sexuality_bisexual"))
        .row()
        .text(ctx.t("interview.sexuality_homosexual"))
        .text(ctx.t("interview.sexuality_heterosexual"))
        .placeholder(ctx.t("interview.can_use_custom_sexuality"))
        .resized(),
    });
    return InterviewStepResult.WaitForResponseAndDoNext;
  },
  async (ctx) => {
    await setUserSexuality(ctx.user.id, ctx.message.text);
    return InterviewStepResult.DoNext;
  },

  // Intermediate checkpoint
  async (ctx) => {
    // Allow trusted users in without an interview.
    const chatMember = await ctx.api.getChatMember(
      config.MEMBERS_GROUP,
      ctx.user.id,
    );

    if (["member", "creator", "administrator"].includes(chatMember.status)) {
      // We're done here.
      ctx.user.status = UserStatus.Approved;
      await updateUser(ctx.user.id, { status: UserStatus.Approved });
      await ensureHasAdminGroupTopic(null, ctx, ctx.user);
      await sendApproveMessage(ctx, ctx.user);
      await postInterviewSignup(null, ctx);
      return InterviewStepResult.FinishInterview;
    } else {
      await ensureHasAdminGroupTopic(null, ctx, ctx.user);
      return InterviewStepResult.DoNext;
    }
  },

  // Normal interview questions.
  ...makeGenericInterviewQuestion("interview.areyou18", (ctx) =>
    new Keyboard()
      .text(ctx.t("interview.areyou18_yes"))
      .text(ctx.t("interview.areyou18_no"))
      .resized(),
  ),
  ...makeGenericInterviewQuestion("interview.rules", (ctx) =>
    new Keyboard()
      .text(ctx.t("interview.rules_yes"))
      .text(ctx.t("interview.rules_no"))
      .resized(),
  ),
  ...makeGenericInterviewQuestion("interview.experience"),
  ...makeGenericInterviewQuestion("interview.how_do_you_know_us"),
  ...makeGenericInterviewQuestion("interview.active_consent"),
  ...makeGenericInterviewQuestion("interview.lgbt_check"),
  ...makeGenericInterviewQuestion("interview.transgender_check"),
  ...makeGenericInterviewQuestion("interview.personal_borders"),

  // Finish the interview.
  async (ctx) => {
    await ctx.replyWithChatAction("typing");
    await updateUser(ctx.user.id, { status: UserStatus.PendingApproval });
    await sendInterviewFinishNotificationToAdminGroupTopic(null, ctx, ctx.user);
    await ctx.reply(ctx.t("interview.interview_replies_saved"));
    return InterviewStepResult.FinishInterview;
  },
];

function makeGenericInterviewQuestion(
  key: string,
  markup?: (ctx: Context) => ReplyKeyboardMarkup,
): InterviewStep[] {
  return [
    async (ctx) => {
      const question = ctx.translate(key);
      await ctx.reply(question, {
        reply_markup:
          markup !== undefined ? markup(ctx) : { remove_keyboard: true },
      });
      await sendInterviewQuestionToAdminGroupTopic(
        null,
        ctx,
        ctx.user,
        question,
      );
      return InterviewStepResult.WaitForResponseAndDoNext;
    },
    async (ctx) => {
      await copyMessageToAdminGroupTopic(null, ctx);
      return InterviewStepResult.DoNext;
    },
  ];
}

composer
  .chatType("private")
  .drop((ctx) => ctx.session.interviewStep === undefined)
  .on("message:text", runInterview);
