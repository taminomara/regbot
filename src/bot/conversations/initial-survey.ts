import { createConversation } from "@grammyjs/conversations";
import type { Context, Conversation } from "#root/bot/context.js";
import { Composer, Keyboard } from "grammy";
import { waitForSkipCommands } from "#root/bot/helpers/conversations.js";

export const composer = new Composer<Context>();

export const enter = async (ctx: Context) => {
  await ctx.conversation.enter("initialSurvey");
};

async function initialSurvey(conversation: Conversation, ctx: Context) {
  await ctx.reply(ctx.t("initial_survey.i_dont_know_you"));
  // await ctx.reply(ctx.t("initial_survey.i_know_you"));

  await ctx.reply(ctx.t("initial_survey.name"));
  const { message: _name } = await waitForSkipCommands(
    conversation,
    "message:text",
  );

  await ctx.reply(ctx.t("initial_survey.pronouns"), {
    reply_markup: new Keyboard()
      .text(ctx.t("initial_survey.pronouns_they_them"))
      .text(ctx.t("initial_survey.pronouns_she_her"))
      .text(ctx.t("initial_survey.pronouns_he_him"))
      .text(ctx.t("initial_survey.pronouns_it_its"))
      .placeholder(ctx.t("initial_survey.can_use_custom_pronouns"))
      .resized()
      .oneTime(),
  });
  const { message: _pronouns } = await waitForSkipCommands(
    conversation,
    "message:text",
  );

  await ctx.reply(ctx.t("initial_survey.areyou18"), {
    reply_markup: new Keyboard()
      .text(ctx.t("initial_survey.areyou18_yes"))
      .text(ctx.t("initial_survey.areyou18_no"))
      .resized()
      .oneTime(),
  });
  const { message: _areyou18 } = await waitForSkipCommands(
    conversation,
    "message:text",
  );

  await ctx.reply(ctx.t("initial_survey.gender"), {
    reply_markup: new Keyboard()
      .text(ctx.t("initial_survey.gender_nonbinary"))
      .text(ctx.t("initial_survey.gender_woman"))
      .text(ctx.t("initial_survey.gender_man"))
      .placeholder(ctx.t("initial_survey.can_use_custom_gender"))
      .resized()
      .oneTime(),
  });
  const { message: _gender } = await waitForSkipCommands(
    conversation,
    "message:text",
  );

  await ctx.reply(ctx.t("initial_survey.sexuality"), {
    reply_markup: new Keyboard()
      .text(ctx.t("initial_survey.sexuality_bisexual"))
      .text(ctx.t("initial_survey.sexuality_homosexual"))
      .text(ctx.t("initial_survey.sexuality_heterosexual"))
      .placeholder(ctx.t("initial_survey.can_use_custom_sexuality"))
      .resized()
      .oneTime(),
  });
  const { message: _sexuality } = await waitForSkipCommands(
    conversation,
    "message:text",
  );

  await ctx.reply(ctx.t("initial_survey.replies_saved"));
}

composer.use(createConversation(initialSurvey));
