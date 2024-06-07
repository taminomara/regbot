import { Menu } from "@grammyjs/menu";
import { createCallbackData } from "callback-data";
import { Composer, InlineKeyboard } from "grammy";
import { isAdmin } from "grammy-guard";

import { UserStatus } from "#root/backend/user.js";
import type { Context } from "#root/bot/context.js";
import {
  formatAboutMe,
  getUserForTopic,
} from "#root/bot/features/admin-group.js";
import {
  enterEditGender,
  enterEditName,
  enterEditPronouns,
  enterEditSexuality,
} from "#root/bot/features/edit-user.js";
import {
  confirmSignup,
  rejectSignup,
} from "#root/bot/features/event-signup.js";
import { approve, reject } from "#root/bot/features/interview.js";
import { editMessageTextSafe } from "#root/bot/helpers/edit-text.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

export const composer = new Composer<Context>();

const feature = composer.filter(isAdmin);

export const adminGroupUserMenu = new Menu<Context>("adminGroupUserMenu")
  .text(() => i18n.t(config.DEFAULT_LOCALE, "menu.update"), updateMe)
  .submenu(
    () => i18n.t(config.DEFAULT_LOCALE, "menu.edit"),
    "adminGroupEditUserMenu",
    updateEdit,
  )
  .row()
  .dynamic(async (ctx, range) => {
    // this happens when the menu is being sent from the interview conversation.
    // `ctx` will reference the chat where the interview is happening,
    // thus it will not be an admin group.
    if (ctx.chat?.id !== config.ADMIN_GROUP) return;

    const user = await getUserForTopic(ctx);
    if (user?.status === UserStatus.PendingApproval) {
      range.text(
        i18n.t(config.DEFAULT_LOCALE, "admin_group.reject"),
        async (ctx) => {
          await reject(ctx);
          await updateMe(ctx);
        },
      );
      range.text(
        i18n.t(config.DEFAULT_LOCALE, "admin_group.approve"),
        async (ctx) => {
          await approve(ctx);
          await updateMe(ctx);
        },
      );
    }
  });
feature.use(adminGroupUserMenu);
async function updateMe(ctx: Context) {
  const user = await getUserForTopic(ctx);
  if (user !== undefined) await editMessageTextSafe(ctx, formatAboutMe(user));
}

const adminGroupEditUserMenu = new Menu<Context>("adminGroupEditUserMenu")
  .text(() => i18n.t(config.DEFAULT_LOCALE, "menu.edit_name"), enterEditName)
  .text(
    () => i18n.t(config.DEFAULT_LOCALE, "menu.edit_pronouns"),
    enterEditPronouns,
  )
  .row()
  .text(
    () => i18n.t(config.DEFAULT_LOCALE, "menu.edit_gender"),
    enterEditGender,
  )
  .text(
    () => i18n.t(config.DEFAULT_LOCALE, "menu.edit_sexuality"),
    enterEditSexuality,
  )
  .row()
  .back(() => i18n.t(config.DEFAULT_LOCALE, "menu.back"), updateMe);
adminGroupUserMenu.register(adminGroupEditUserMenu);
async function updateEdit(ctx: Context) {
  await editMessageTextSafe(
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "menu.edit_prompt"),
  );
}

export const adminPostInterviewMenu = new Menu<Context>(
  "adminPostInterviewMenu",
)
  .submenu(
    i18n.t(config.DEFAULT_LOCALE, "admin_group.reject"),
    "adminPostInterviewDecisionMadeMenu",
    reject,
  )
  .submenu(
    i18n.t(config.DEFAULT_LOCALE, "admin_group.approve"),
    "adminPostInterviewDecisionMadeMenu",
    approve,
  );
feature.use(adminPostInterviewMenu);

const adminPostInterviewDecisionMadeMenu = new Menu<Context>(
  "adminPostInterviewDecisionMadeMenu",
);
adminPostInterviewMenu.register(adminPostInterviewDecisionMadeMenu);

const approveSignupData = createCallbackData("approveSignup", {
  eventId: Number,
});
const rejectSignupData = createCallbackData("rejectSignup", {
  eventId: Number,
});

export function createApproveSignupKeyboard(eventId: number) {
  return new InlineKeyboard()
    .text(
      i18n.t(config.DEFAULT_LOCALE, "admin_group.reject"),
      rejectSignupData.pack({ eventId }),
    )
    .text(
      i18n.t(config.DEFAULT_LOCALE, "admin_group.approve"),
      approveSignupData.pack({ eventId }),
    );
}

feature.callbackQuery(approveSignupData.filter(), async (ctx) => {
  const { eventId } = approveSignupData.unpack(ctx.callbackQuery.data);

  const user = await getUserForTopic(ctx);
  if (user === undefined) return;

  await confirmSignup(null, ctx, eventId, user.id);
  await ctx.editMessageReplyMarkup({
    reply_markup: new InlineKeyboard(),
  });
});

feature.callbackQuery(rejectSignupData.filter(), async (ctx) => {
  const { eventId } = rejectSignupData.unpack(ctx.callbackQuery.data);

  const user = await getUserForTopic(ctx);
  if (user === undefined) return;

  await rejectSignup(null, ctx, eventId, user.id);
  await ctx.editMessageReplyMarkup({
    reply_markup: new InlineKeyboard(),
  });
});
