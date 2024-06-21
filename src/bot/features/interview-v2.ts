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
import { FINISH, conversation } from "#root/bot/helpers/conversations-v2.js";
import { config } from "#root/config.js";

export const composer = new Composer<Context>();

export const interviewConversation = conversation("interview")
  .proceed(async (ctx) => {
    await ctx.reply(ctx.t("welcome"));
    if (ctx.user.status === UserStatus.Approved) {
      await ctx.reply(ctx.t("interview.i_know_you"));
    } else {
      await ctx.reply(ctx.t("interview.i_dont_know_you"));
    }
  })
  .proceed(async (ctx) => {
    await ctx.reply(ctx.t("interview.name"));
  })
  .waitFor("message:text", async (ctx) => {
    await setUserName(ctx.user.id, ctx.message.text);
  })
  .proceed(async (ctx) => {
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
  })
  .waitFor("message:text", async (ctx) => {
    await setUserPronouns(ctx.user.id, ctx.message.text);
  })
  .proceed(async (ctx) => {
    await ctx.reply(ctx.t("interview.gender"), {
      reply_markup: new Keyboard()
        .text(ctx.t("interview.gender_nonbinary"))
        .text(ctx.t("interview.gender_woman"))
        .text(ctx.t("interview.gender_man"))
        .placeholder(ctx.t("interview.can_use_custom_gender"))
        .resized(),
    });
  })
  .waitFor("message:text", async (ctx) => {
    await setUserGender(ctx.user.id, ctx.message.text);
  })
  .proceed(async (ctx) => {
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
  })
  .waitFor("message:text", async (ctx) => {
    await setUserSexuality(ctx.user.id, ctx.message.text);
  })
  .proceed(async (ctx) => {
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
      return FINISH;
    } else {
      await ensureHasAdminGroupTopic(null, ctx, ctx.user);
    }
  })
  .proceed(
    handleQuestion("interview.areyou18", (ctx) =>
      new Keyboard()
        .text(ctx.t("interview.areyou18_yes"))
        .text(ctx.t("interview.areyou18_no"))
        .resized(),
    ),
  )
  .waitFor("message", handleResponse)
  .proceed(
    handleQuestion("interview.rules", (ctx) =>
      new Keyboard()
        .text(ctx.t("interview.rules_yes"))
        .text(ctx.t("interview.rules_no"))
        .resized(),
    ),
  )
  .waitFor("message", handleResponse)
  .proceed(handleQuestion("interview.experience"))
  .waitFor("message", handleResponse)
  .proceed(handleQuestion("interview.how_do_you_know_us"))
  .waitFor("message", handleResponse)
  .proceed(handleQuestion("interview.active_consent"))
  .waitFor("message", handleResponse)
  .proceed(handleQuestion("interview.lgbt_check"))
  .waitFor("message", handleResponse)
  .proceed(handleQuestion("interview.transgender_check"))
  .waitFor("message", handleResponse)
  .proceed(handleQuestion("interview.personal_borders"))
  .waitFor("message", handleResponse)
  .proceed(async (ctx) => {
    await ctx.replyWithChatAction("typing");
    await updateUser(ctx.user.id, { status: UserStatus.PendingApproval });
    await sendInterviewFinishNotificationToAdminGroupTopic(null, ctx, ctx.user);
    await ctx.reply(ctx.t("interview.interview_replies_saved"));
  })
  .build();

function handleQuestion(
  key: string,
  markup?: (ctx: Context) => ReplyKeyboardMarkup,
) {
  return async (ctx: Context) => {
    const question = ctx.translate(key);
    await ctx.reply(question, {
      reply_markup:
        markup !== undefined ? markup(ctx) : { remove_keyboard: true },
    });
    await sendInterviewQuestionToAdminGroupTopic(null, ctx, ctx.user, question);
  };
}

async function handleResponse(ctx: Filter<Context, "message">) {
  await copyMessageToAdminGroupTopic(null, ctx);
}

composer.chatType("private").use(interviewConversation);
