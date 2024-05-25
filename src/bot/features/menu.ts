import { Menu } from "@grammyjs/menu";
import { Composer } from "grammy";

import { UserStatus, getUserOrFail } from "#root/backend/user.js";
import type { Context } from "#root/bot/context.js";
import {
  enterEditGender,
  enterEditName,
  enterEditPronouns,
  enterEditSexuality,
} from "#root/bot/features/edit-user.js";
import { registerCommandHelpProvider } from "#root/bot/features/help.js";
import { sanitizeHtmlOrEmpty } from "#root/bot/helpers/sanitize-html.js";
import { i18n } from "#root/bot/i18n.js";

export const composer = new Composer<Context>();

const feature = composer.chatType("private");

export const mainMenu = new Menu<Context>("main")
  .submenu((ctx) => ctx.t("menu.me"), "me", updateMe)
  .row()
  .text("Events")
  .row()
  .text("My events");
feature.use(mainMenu);
async function updateMenu(ctx: Context) {
  await ctx.editMessageText("Check out this menu:");
}

const me = new Menu<Context>("me")
  .text((ctx) => ctx.t("menu.update"), updateMe)
  .submenu((ctx) => ctx.t("menu.edit"), "edit", updateEdit)
  .row()
  .back((ctx) => ctx.t("menu.back"), updateMenu);
mainMenu.register(me);
async function updateMe(ctx: Context) {
  const user = await getUserOrFail(ctx.user.id);
  await ctx.editMessageText(
    ctx.t("menu.about", {
      name: sanitizeHtmlOrEmpty(user.name),
      pronouns: sanitizeHtmlOrEmpty(user.pronouns),
      gender: sanitizeHtmlOrEmpty(user.gender),
      sexuality: sanitizeHtmlOrEmpty(user.sexuality),
    }),
  );
}

const edit = new Menu<Context>("edit")
  .text(
    (ctx) => ctx.t("menu.edit_name"),
    async (ctx) => enterEditName(ctx),
  )
  .text(
    (ctx) => ctx.t("menu.edit_pronouns"),
    async (ctx) => enterEditPronouns(ctx),
  )
  .row()
  .text(
    (ctx) => ctx.t("menu.edit_gender"),
    async (ctx) => enterEditGender(ctx),
  )
  .text(
    (ctx) => ctx.t("menu.edit_sexuality"),
    async (ctx) => enterEditSexuality(ctx),
  )
  .row()
  .back((ctx) => ctx.t("menu.back"), updateMe);
me.register(edit);
async function updateEdit(ctx: Context) {
  await ctx.editMessageText(ctx.t("menu.edit_prompt"));
}

feature.command("menu", async (ctx) => {
  if (
    !ctx.user.finishedInitialSurvey ||
    ctx.user.status in [UserStatus.New, UserStatus.InterviewInProgress]
  ) {
    return;
  }
  await ctx.reply("Check out this menu:", { reply_markup: mainMenu });
});

registerCommandHelpProvider((localeCode) => {
  return [
    {
      command: "menu",
      description: i18n.t(localeCode, "menu_command.description"),
    },
  ];
});
