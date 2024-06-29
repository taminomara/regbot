import { Menu } from "@grammyjs/menu";
import { createCallbackData } from "callback-data";
import { Composer, InlineKeyboard } from "grammy";
import { isAdmin } from "grammy-guard";

import { User, UserStatus, getUser } from "#root/backend/user.js";
import type { Context } from "#root/bot/context.js";
import {
  banUser,
  formatAboutMe,
  getUserForTopic,
  unbanUser,
} from "#root/bot/features/admin-group.js";
import {
  enterEditGender,
  enterEditName,
  enterEditPronouns,
  enterEditSexuality,
} from "#root/bot/features/edit-user.js";
import {
  confirmPayment,
  confirmSignup,
  rejectSignup,
} from "#root/bot/features/event-signup.js";
import { approve, reject } from "#root/bot/features/interview.js";
import { editMessageTextSafe } from "#root/bot/helpers/edit-text.js";
import { sanitizeHtmlOrEmpty } from "#root/bot/helpers/sanitize-html.js";
import { withPayload } from "#root/bot/helpers/with-payload.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

import { patchCtx } from "../helpers/menu.js";

export const composer = new Composer<Context>();

const feature = composer.filter(isAdmin);

export async function sendAdminGroupUserMenu(ctx: Context, user: User) {
  await patchCtx(
    ctx,
    { match: user.id, locale: config.DEFAULT_LOCALE },
    async (ctx) => {
      await ctx.api.sendMessage(config.ADMIN_GROUP, await formatAboutMe(user), {
        message_thread_id: user.adminGroupTopic ?? undefined,
        reply_markup: adminGroupUserMenu,
      });
    },
  );
}

const adminGroupUserMenu = new Menu<Context>("adminGroupUserMenu", {
  onMenuOutdated: updateAdminGroupUserMenu,
})
  .text(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.update")),
    updateAdminGroupUserMenu,
  )
  .submenu(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.edit")),
    "adminGroupEditUserMenu",
    updateAdminGroupEditUserMenu,
  )
  .row()
  .dynamic(async (ctx, range) => {
    // this happens when the menu is being sent from the interview conversation.
    // `ctx` will reference the chat where the interview is happening,
    // thus it will not be an admin group.
    if (ctx.chat?.id !== config.ADMIN_GROUP) return;

    const user = await getUserFromMatch(ctx);
    if (user === undefined) return;

    if (user.status === UserStatus.PendingApproval) {
      range.text(
        withPayload(i18n.t(config.DEFAULT_LOCALE, "admin_group.reject")),
        async (ctx) => {
          await reject(ctx);
          await updateAdminGroupUserMenu(ctx);
        },
      );
      range.text(
        withPayload(i18n.t(config.DEFAULT_LOCALE, "admin_group.approve")),
        async (ctx) => {
          await approve(ctx);
          await updateAdminGroupUserMenu(ctx);
        },
      );
    } else if (user.status === UserStatus.Approved) {
      range.submenu(
        withPayload(i18n.t(config.DEFAULT_LOCALE, "admin_group.ban")),
        "adminGroupBanUserMenu",
        updateAdminGroupBanUserMenu,
      );
    } else if (user.status === UserStatus.Banned) {
      range.submenu(
        withPayload(i18n.t(config.DEFAULT_LOCALE, "admin_group.unban")),
        "adminGroupUnbanUserMenu",
        updateAdminGroupUnbanUserMenu,
      );
    }
  });
feature.use(adminGroupUserMenu);
async function updateAdminGroupUserMenu(ctx: Context) {
  const user = await getUserFromMatch(ctx);
  if (user !== undefined) {
    await editMessageTextSafe(ctx, await formatAboutMe(user));
  }
}

const adminGroupEditUserMenu = new Menu<Context>("adminGroupEditUserMenu")
  .text(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.edit_name")),
    async (ctx) => enterEditName(ctx),
  )
  .text(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.edit_pronouns")),
    async (ctx) => enterEditPronouns(ctx),
  )
  .row()
  .text(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.edit_gender")),
    async (ctx) => enterEditGender(ctx),
  )
  .text(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.edit_sexuality")),
    async (ctx) => enterEditSexuality(ctx),
  )
  .row()
  .back(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.back")),
    updateAdminGroupUserMenu,
  );
adminGroupUserMenu.register(adminGroupEditUserMenu);
async function updateAdminGroupEditUserMenu(ctx: Context) {
  await editMessageTextSafe(
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "menu.edit_prompt"),
  );
}

const adminGroupBanUserMenu = new Menu<Context>("adminGroupBanUserMenu")
  .back(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.back")),
    updateAdminGroupUserMenu,
  )
  .back(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "admin_group.ban")),
    async (ctx) => {
      const user = await getUserFromMatch(ctx);
      if (user === undefined) return;

      await banUser(ctx, user, ""); // TODO: reason
      await updateAdminGroupUserMenu(ctx);
    },
  );
adminGroupUserMenu.register(adminGroupBanUserMenu);
async function updateAdminGroupBanUserMenu(ctx: Context) {
  const user = await getUserFromMatch(ctx);
  if (user === undefined) return;

  await editMessageTextSafe(
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "admin_group.ban_prompt", {
      id: String(user.id),
      name: sanitizeHtmlOrEmpty(user.name),
    }),
  );
}

const adminGroupUnbanUserMenu = new Menu<Context>("adminGroupUnbanUserMenu")
  .back(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.back")),
    updateAdminGroupUserMenu,
  )
  .back(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "admin_group.unban")),
    async (ctx) => {
      const user = await getUserFromMatch(ctx);
      if (user === undefined) return;

      await unbanUser(ctx, user);
      await updateAdminGroupUserMenu(ctx);
    },
  );
adminGroupUserMenu.register(adminGroupUnbanUserMenu);
async function updateAdminGroupUnbanUserMenu(ctx: Context) {
  const user = await getUserFromMatch(ctx);
  if (user === undefined) return;

  await editMessageTextSafe(
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "admin_group.unban_prompt", {
      id: String(user.id),
      name: sanitizeHtmlOrEmpty(user.name),
    }),
  );
}

export const adminPostInterviewMenu = new Menu<Context>(
  "adminPostInterviewMenu",
)
  .submenu(
    withPayload(i18n.t(config.DEFAULT_LOCALE, "admin_group.reject")),
    "adminPostInterviewDecisionMadeMenu",
    reject,
  )
  .submenu(
    withPayload(i18n.t(config.DEFAULT_LOCALE, "admin_group.approve")),
    "adminPostInterviewDecisionMadeMenu",
    approve,
  );
feature.use(adminPostInterviewMenu);

const adminPostInterviewDecisionMadeMenu = new Menu<Context>(
  "adminPostInterviewDecisionMadeMenu",
);
adminPostInterviewMenu.register(adminPostInterviewDecisionMadeMenu);

const confirmSignupData = createCallbackData("confirmSignup", {
  eventId: Number,
  userId: Number,
});
const confirmPaymentData = createCallbackData("confirmPayment", {
  eventId: Number,
  userId: Number,
});
const rejectSignupData = createCallbackData("rejectSignup", {
  eventId: Number,
  userId: Number,
});

export function createConfirmSignupKeyboard(eventId: number, userId: number) {
  return new InlineKeyboard()
    .text(
      i18n.t(config.DEFAULT_LOCALE, "admin_group.reject"),
      rejectSignupData.pack({ eventId, userId }),
    )
    .text(
      i18n.t(config.DEFAULT_LOCALE, "admin_group.approve"),
      confirmSignupData.pack({ eventId, userId }),
    );
}

export function createConfirmPaymentKeyboard(eventId: number, userId: number) {
  return new InlineKeyboard()
    .text(
      i18n.t(config.DEFAULT_LOCALE, "admin_group.reject"),
      rejectSignupData.pack({ eventId, userId }),
    )
    .text(
      i18n.t(config.DEFAULT_LOCALE, "admin_group.approve"),
      confirmPaymentData.pack({ eventId, userId }),
    );
}

feature.callbackQuery(confirmSignupData.filter(), async (ctx) => {
  const { eventId, userId } = confirmSignupData.unpack(ctx.callbackQuery.data);

  const user = await getUser(userId);
  if (user === null) return;

  await confirmSignup(ctx, eventId, user);
  await ctx.editMessageReplyMarkup({
    reply_markup: new InlineKeyboard(),
  });
});

feature.callbackQuery(confirmPaymentData.filter(), async (ctx) => {
  const { eventId, userId } = confirmPaymentData.unpack(ctx.callbackQuery.data);

  const user = await getUser(userId);
  if (user === null) return;

  await confirmPayment(ctx, eventId, user);
  await ctx.editMessageReplyMarkup({
    reply_markup: new InlineKeyboard(),
  });
});

feature.callbackQuery(rejectSignupData.filter(), async (ctx) => {
  const { eventId, userId } = rejectSignupData.unpack(ctx.callbackQuery.data);

  const user = await getUser(userId);
  if (user === null) return;

  await rejectSignup(ctx, eventId, user);
  await ctx.editMessageReplyMarkup({
    reply_markup: new InlineKeyboard(),
  });
});

async function getUserFromMatch(ctx: Context): Promise<User | undefined> {
  const userId = Number(ctx.match);
  if (Number.isFinite(userId)) {
    const user = await getUser(userId);
    return user === null ? undefined : user;
  }

  // Make sure old menus still work.
  return getUserForTopic(ctx);
}
