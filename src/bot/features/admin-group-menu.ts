import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { config } from "#root/config.js";
import { Menu } from "@grammyjs/menu";
import { i18n } from "#root/bot/i18n.js";
import {
  enterEditGender,
  enterEditName,
  enterEditPronouns,
  enterEditSexuality,
} from "#root/bot/features/edit-user.js";
import {
  formatAboutMe,
  getUserForTopic,
} from "#root/bot/features/admin-group.js";

export const composer = new Composer<Context>();

export const adminGroupUserMenu = new Menu<Context>("adminGroupUserMenu")
  .text(() => i18n.t(config.DEFAULT_LOCALE, "menu.update"), updateMe)
  .submenu(
    () => i18n.t(config.DEFAULT_LOCALE, "menu.edit"),
    "adminGroupEditUserMenu",
    updateEdit,
  );
composer.use(adminGroupUserMenu);
async function updateMe(ctx: Context) {
  const user = await getUserForTopic(ctx);
  if (user !== undefined) await ctx.editMessageText(formatAboutMe(user));
}

const adminGroupEditUserMenu = new Menu<Context>("adminGroupEditUserMenu")
  .text(
    () => i18n.t(config.DEFAULT_LOCALE, "menu.edit_name"),
    async (ctx) => {
      const user = await getUserForTopic(ctx);
      if (user !== undefined) await enterEditName(ctx, user.id);
    },
  )
  .text(
    () => i18n.t(config.DEFAULT_LOCALE, "menu.edit_pronouns"),
    async (ctx) => {
      const user = await getUserForTopic(ctx);
      if (user !== undefined) await enterEditPronouns(ctx, user.id);
    },
  )
  .row()
  .text(
    () => i18n.t(config.DEFAULT_LOCALE, "menu.edit_gender"),
    async (ctx) => {
      const user = await getUserForTopic(ctx);
      if (user !== undefined) await enterEditGender(ctx, user.id);
    },
  )
  .text(
    () => i18n.t(config.DEFAULT_LOCALE, "menu.edit_sexuality"),
    async (ctx) => {
      const user = await getUserForTopic(ctx);
      if (user !== undefined) await enterEditSexuality(ctx, user.id);
    },
  )
  .row()
  .back(() => i18n.t(config.DEFAULT_LOCALE, "menu.back"), updateMe);
adminGroupUserMenu.register(adminGroupEditUserMenu);
async function updateEdit(ctx: Context) {
  await ctx.editMessageText(i18n.t(config.DEFAULT_LOCALE, "menu.edit_prompt"));
}
