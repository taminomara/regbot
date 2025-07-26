// State-machine based approach to interview, because the native conversations
// engine breaks too often.
import { ReplyKeyboardMarkup } from "@grammyjs/types";
import { Composer, Filter, InlineKeyboard, Keyboard } from "grammy";

import { UserStatus } from "#root/backend/entities/user.js";
import {
  setUserGender,
  setUserName,
  setUserPositioning,
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
import {
  conversation,
  repeatConversationStep,
  switchConversation,
} from "#root/bot/helpers/conversations-v2.js";
import { config } from "#root/config.js";

import { isApproved } from "../filters/index.js";
import { logHandle } from "../helpers/logging.js";
import { parseTelegramEntities } from "../helpers/parse-telegram-entities.js";

export const composer = new Composer<Context>();

const feature = composer.chatType("private");

export const interviewConversation = conversation<Context>(
  "interview",
  logHandle("conversation:interview"),
)
  .proceed(async (ctx) => {
    await ctx.reply(ctx.t("welcome"));

    const chatMember = await ctx.api.getChatMember(
      config.MEMBERS_GROUP,
      ctx.user.id,
    );

    if (
      ctx.user.status === UserStatus.Approved ||
      ["member", "creator", "administrator"].includes(chatMember.status)
    ) {
      await ctx.reply(ctx.t("interview.i_know_you"));
    } else {
      await ctx.reply(ctx.t("interview.i_dont_know_you"));
    }
    await updateUser(ctx.user.id, { status: UserStatus.InterviewInProgress });
  })
  .proceed(async (ctx) => {
    await ctx.reply(ctx.t("interview.name"));
  })
  .waitFilterQueryIgnoreCmd("message:text", async (ctx) => {
    if (ctx.message.text.length > 150) {
      ctx.reply(ctx.t("interview.too_long"));
      return repeatConversationStep();
    }
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
  .waitFilterQueryIgnoreCmd("message:text", async (ctx) => {
    if (ctx.message.text.length > 150) {
      ctx.reply(ctx.t("interview.too_long"));
      return repeatConversationStep();
    }
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
  .waitFilterQueryIgnoreCmd("message:text", async (ctx) => {
    if (ctx.message.text.length > 150) {
      ctx.reply(ctx.t("interview.too_long"));
      return repeatConversationStep();
    }
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
  .waitFilterQueryIgnoreCmd("message:text", async (ctx) => {
    if (ctx.message.text.length > 150) {
      ctx.reply(ctx.t("interview.too_long"));
      return repeatConversationStep();
    }
    await setUserSexuality(ctx.user.id, ctx.message.text);
  })
  .proceed(async (ctx) => {
    await ctx.reply(ctx.t("interview.positioning"), {
      reply_markup: new Keyboard()
        .text(ctx.t("interview.positioning_top"))
        .text(ctx.t("interview.positioning_bottom"))
        .text(ctx.t("interview.positioning_switch"))
        .placeholder(ctx.t("interview.can_use_custom_positioning"))
        .resized(),
    });
  })
  .waitFilterQueryIgnoreCmd("message:text", async (ctx) => {
    if (ctx.message.text.length > 150) {
      ctx.reply(ctx.t("interview.too_long"));
      return repeatConversationStep();
    }
    await setUserPositioning(ctx.user.id, ctx.message.text);
  })
  .proceed(async (ctx) => {
    // Allow trusted users in without an interview.
    const chatMember = await ctx.api.getChatMember(
      config.MEMBERS_GROUP,
      ctx.user.id,
    );

    if (
      (await isApproved(ctx)) ||
      ["member", "creator", "administrator"].includes(chatMember.status)
    ) {
      // We're done here, but we need to ask some final questions.
      return switchConversation(interviewPostConversation, {
        isApproved: true,
      });
    } else {
      await ensureHasAdminGroupTopic(ctx, ctx.user);
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
  .waitFilterQueryIgnoreCmd("message", handleResponse)
  .proceed(
    handleQuestion("interview.rules", (ctx) =>
      new Keyboard()
        .text(ctx.t("interview.rules_yes"))
        .text(ctx.t("interview.rules_no"))
        .resized(),
    ),
  )
  .waitFilterQueryIgnoreCmd("message", handleResponse)
  .proceed(handleQuestion("interview.experience"))
  .waitFilterQueryIgnoreCmd("message", handleResponse)
  .proceed(handleQuestion("interview.how_do_you_know_us"))
  .waitFilterQueryIgnoreCmd("message", handleResponse)
  .proceed(handleQuestion("interview.active_consent"))
  .waitFilterQueryIgnoreCmd("message", handleResponse)
  .proceed(handleQuestion("interview.lgbt_check"))
  .waitFilterQueryIgnoreCmd("message", handleResponse)
  .proceed(handleQuestion("interview.transgender_check"))
  .waitFilterQueryIgnoreCmd("message", handleResponse)
  .proceed(handleQuestion("interview.personal_borders"))
  .waitFilterQueryIgnoreCmd("message", handleResponse)
  .proceed(async () => {
    return switchConversation(interviewPostConversation, { isApproved: false });
  })
  .build();
feature.chatType("private").use(interviewConversation);

export const interviewPostConversation = conversation<
  Context,
  { isApproved: boolean }
>("interview:post", logHandle("conversation:interview"))
  .proceed(async (ctx, params) => {
    await ctx.reply(ctx.t("interview.about_me"), {
      reply_markup: new InlineKeyboard().text(
        ctx.t("interview.about_me_later"),
        "aboutMeLater",
      ),
    });
    return params;
  })
  .either()
  .waitCallbackQuery("aboutMeLater", async (ctx, params) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(ctx.t("interview.about_me_later_response"));
    return params;
  })
  .waitFilterQueryIgnoreCmd("message:text", async (ctx, params) => {
    const aboutMeHtml = parseTelegramEntities(
      ctx.message.text,
      ctx.message.entities,
    )
      .replace(new RegExp(`^\\s*@${ctx.me.username}`), "")
      .trim();

    await updateUser(ctx.user.id, { aboutMeHtml });
    return params;
  })
  .done()
  .proceed(async (ctx, { isApproved }) => {
    await ctx.replyWithChatAction("typing");

    await ensureHasAdminGroupTopic(ctx, ctx.user);

    if (isApproved) {
      ctx.user.status = UserStatus.Approved;
      await updateUser(ctx.user.id, { status: UserStatus.Approved });
      await sendApproveMessage(ctx, ctx.user);
      await postInterviewSignup(ctx);
    } else {
      await updateUser(ctx.user.id, { status: UserStatus.PendingApproval });
      await sendInterviewFinishNotificationToAdminGroupTopic(ctx, ctx.user);
      await ctx.reply(ctx.t("interview.interview_replies_saved"));
    }
  })
  .build();
feature.chatType("private").use(interviewPostConversation);

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
    await sendInterviewQuestionToAdminGroupTopic(ctx, ctx.user, question);
  };
}

async function handleResponse(ctx: Filter<Context, "message">) {
  await copyMessageToAdminGroupTopic(ctx);
}
