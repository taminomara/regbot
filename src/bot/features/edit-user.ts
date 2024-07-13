import { Composer, Keyboard } from "grammy";

import {
  setUserGender,
  setUserName,
  setUserPronouns,
  setUserSexuality,
} from "#root/backend/user.js";
import type { Context } from "#root/bot/context.js";
import { updateAdminGroupTopicTitle } from "#root/bot/features/admin-group.js";

import { conversation } from "../helpers/conversations-v2.js";
import { sendEditProfileMenu } from "./menu.js";

export const composer = new Composer<Context>();

const editName = conversation<Context, { userId: number; sendMenu?: boolean }>(
  "editName",
)
  .proceed(async (ctx, opts) => {
    await ctx.reply(ctx.t("interview.edit_name"), {
      message_thread_id: ctx.msg?.message_thread_id,
    });
    return opts;
  })
  .either()
  .waitCommand("cancel", async (ctx, opts) => {
    await sendCancelled(ctx);
    return opts;
  })
  .waitFilterQuery("message:text", async (ctx, opts) => {
    const user = await setUserName(opts.userId, ctx.message.text);
    await updateAdminGroupTopicTitle(ctx, user);
    await sendConfirmation(ctx);
    return opts;
  })
  .done()
  .proceed(async (ctx, opts) => {
    if (opts?.sendMenu) await sendEditProfileMenu(ctx, ctx.chatId!);
  })
  .build();
composer.use(editName);
export async function enterEditName(
  ctx: Context,
  userId: number,
  sendMenu: boolean = false,
) {
  if (await checkNoConversations(ctx)) {
    await editName.enter(ctx, { userId, sendMenu });
  }
}

const editPronouns = conversation<
  Context,
  { userId: number; sendMenu?: boolean }
>("editPronouns")
  .proceed(async (ctx, opts) => {
    await ctx.reply(ctx.t("interview.edit_pronouns"), {
      reply_markup: new Keyboard()
        .text(ctx.t("interview.pronouns_they_them"))
        .text(ctx.t("interview.pronouns_she_her"))
        .row()
        .text(ctx.t("interview.pronouns_he_him"))
        .text(ctx.t("interview.pronouns_it_its"))
        .placeholder(ctx.t("interview.can_use_custom_pronouns"))
        .resized(),
      message_thread_id: ctx.msg?.message_thread_id,
    });
    return opts;
  })
  .either()
  .waitCommand("cancel", async (ctx, opts) => {
    await sendCancelled(ctx);
    return opts;
  })
  .waitFilterQuery("message:text", async (ctx, opts) => {
    const user = await setUserPronouns(opts.userId, ctx.message.text);
    await updateAdminGroupTopicTitle(ctx, user);
    await sendConfirmation(ctx);
    return opts;
  })
  .done()
  .proceed(async (ctx, opts) => {
    if (opts?.sendMenu) await sendEditProfileMenu(ctx, ctx.chatId!);
  })
  .build();
composer.use(editPronouns);
export async function enterEditPronouns(
  ctx: Context,
  userId: number,
  sendMenu: boolean = false,
) {
  if (await checkNoConversations(ctx)) {
    await editPronouns.enter(ctx, { userId, sendMenu });
  }
}

const editGender = conversation<
  Context,
  { userId: number; sendMenu?: boolean }
>("editGender")
  .proceed(async (ctx, opts) => {
    await ctx.reply(ctx.t("interview.edit_gender"), {
      reply_markup: new Keyboard()
        .text(ctx.t("interview.gender_nonbinary"))
        .text(ctx.t("interview.gender_woman"))
        .text(ctx.t("interview.gender_man"))
        .placeholder(ctx.t("interview.can_use_custom_gender"))
        .resized(),
      message_thread_id: ctx.msg?.message_thread_id,
    });
    return opts;
  })
  .either()
  .waitCommand("cancel", async (ctx, opts) => {
    await sendCancelled(ctx);
    return opts;
  })
  .waitFilterQuery("message:text", async (ctx, opts) => {
    const user = await setUserGender(opts.userId, ctx.message.text);
    await updateAdminGroupTopicTitle(ctx, user);
    await sendConfirmation(ctx);
    return opts;
  })
  .done()
  .proceed(async (ctx, opts) => {
    if (opts?.sendMenu) await sendEditProfileMenu(ctx, ctx.chatId!);
  })
  .build();
composer.use(editGender);
export async function enterEditGender(
  ctx: Context,
  userId: number,
  sendMenu: boolean = false,
) {
  if (await checkNoConversations(ctx)) {
    await editGender.enter(ctx, { userId, sendMenu });
  }
}

const editSexuality = conversation<
  Context,
  { userId: number; sendMenu?: boolean }
>("editSexuality")
  .proceed(async (ctx, opts) => {
    await ctx.reply(ctx.t("interview.edit_sexuality"), {
      reply_markup: new Keyboard()
        .text(ctx.t("interview.sexuality_pansexual"))
        .text(ctx.t("interview.sexuality_bisexual"))
        .row()
        .text(ctx.t("interview.sexuality_homosexual"))
        .text(ctx.t("interview.sexuality_heterosexual"))
        .placeholder(ctx.t("interview.can_use_custom_sexuality"))
        .resized(),
      message_thread_id: ctx.msg?.message_thread_id,
    });
    return opts;
  })
  .either()
  .waitCommand("cancel", async (ctx, opts) => {
    await sendCancelled(ctx);
    return opts;
  })
  .waitFilterQuery("message:text", async (ctx, opts) => {
    const user = await setUserSexuality(opts.userId, ctx.message.text);
    await updateAdminGroupTopicTitle(ctx, user);
    await sendConfirmation(ctx);
    return opts;
  })
  .done()
  .proceed(async (ctx, opts) => {
    if (opts?.sendMenu) await sendEditProfileMenu(ctx, ctx.chatId!);
  })
  .build();
composer.use(editSexuality);
export async function enterEditSexuality(
  ctx: Context,
  userId: number,
  sendMenu: boolean = false,
) {
  if (await checkNoConversations(ctx)) {
    await editSexuality.enter(ctx, { userId, sendMenu });
  }
}

async function checkNoConversations(ctx: Context) {
  switch (ctx.session.linearConversation?.name) {
    case "interview":
      await ctx.answerCallbackQuery({
        text: ctx.t("interview.finish_interview_first"),
        show_alert: true,
      });
      return false;
    case "editName":
      await ctx.answerCallbackQuery({
        text: ctx.t("interview.edit_name_first"),
        show_alert: true,
      });
      return false;
    case "editPronouns":
      await ctx.answerCallbackQuery({
        text: ctx.t("interview.edit_pronouns_first"),
        show_alert: true,
      });
      return false;
    case "editGender":
      await ctx.answerCallbackQuery({
        text: ctx.t("interview.edit_gender_first"),
        show_alert: true,
      });
      return false;
    case "editSexuality":
      await ctx.answerCallbackQuery({
        text: ctx.t("interview.edit_sexuality_first"),
        show_alert: true,
      });
      return false;
  }
  return true;
}

async function sendConfirmation(ctx: Context) {
  await ctx.reply(ctx.t("interview.edit_success"), {
    reply_markup: { remove_keyboard: true },
    message_thread_id: ctx.msg?.message_thread_id,
  });
}

async function sendCancelled(ctx: Context) {
  await ctx.reply(ctx.t("interview.edit_cancel"), {
    reply_markup: { remove_keyboard: true },
    message_thread_id: ctx.msg?.message_thread_id,
  });
}
