import { Menu } from "@grammyjs/menu";
import { createCallbackData } from "callback-data";
import { Composer, InlineKeyboard } from "grammy";
import { guard } from "grammy-guard";

import {
  User,
  UserStatus,
  getUser,
  setUserHeaderIsOpen,
  updateUser,
} from "#root/backend/user.js";
import type { Context } from "#root/bot/context.js";
import {
  banUser,
  formatAboutMe,
  getUserForTopic,
  unbanUser,
} from "#root/bot/features/admin-group.js";
import {
  enterEditAboutMe,
  enterEditGender,
  enterEditName,
  enterEditPositioning,
  enterEditPronouns,
  enterEditSexuality,
} from "#root/bot/features/edit-user.js";
import {
  confirmPayment,
  confirmSignup,
  rejectSignup,
} from "#root/bot/features/event-signup.js";
import { approve, reject } from "#root/bot/features/interview.js";
import {
  editMessageTextByIdSafe,
  editMessageTextSafe,
} from "#root/bot/helpers/edit-text.js";
import { sanitizeHtmlOrEmpty } from "#root/bot/helpers/sanitize-html.js";
import { withPayload } from "#root/bot/helpers/with-payload.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

import { isAdmin } from "../filters/index.js";
import { userLink } from "../helpers/links.js";
import { logHandle } from "../helpers/logging.js";
import { makeOutdatedHandler, patchCtx } from "../helpers/menu.js";

export const composer = new Composer<Context>();

export async function sendAdminGroupUserMenu(
  ctx: Context,
  user: User,
): Promise<number> {
  const messageId = await patchCtx(
    ctx,
    { match: user.id, locale: config.DEFAULT_LOCALE },
    async (ctx) => {
      return (
        await ctx.api.sendMessage(
          config.ADMIN_GROUP,
          await formatAboutMe(user),
          {
            message_thread_id: user.adminGroupTopic ?? undefined,
            reply_markup: adminGroupUserMenu,
          },
        )
      ).message_id;
    },
  );

  if (user.adminGroupTopic !== null && user.adminGroupHeaderId === null) {
    await updateUser(user.id, {
      adminGroupHeaderId: messageId,
      adminGroupHeaderIsOpen: true,
    });
    await ctx.api.unpinAllForumTopicMessages(
      config.ADMIN_GROUP,
      user.adminGroupTopic,
    );
    await ctx.api.pinChatMessage(config.ADMIN_GROUP, messageId, {
      disable_notification: true,
    });
  }

  return messageId;
}

export async function refreshAdminGroupUserMenu(ctx: Context, user: User) {
  if (user.adminGroupHeaderId === null) {
    await sendAdminGroupUserMenu(ctx, user);
  } else if (user.adminGroupHeaderIsOpen) {
    const { adminGroupHeaderId } = user;
    await patchCtx(
      ctx,
      { match: user.id, locale: config.DEFAULT_LOCALE },
      async (ctx) => {
        await editMessageTextByIdSafe(
          ctx,
          config.ADMIN_GROUP,
          adminGroupHeaderId,
          await formatAboutMe(user),
          {
            reply_markup: adminGroupUserMenu,
          },
        );
      },
    );
  }
}

export async function sendAdminGroupUserTextWithoutMenu(
  ctx: Context,
  user: User,
) {
  await patchCtx(
    ctx,
    { match: user.id, locale: config.DEFAULT_LOCALE },
    async (ctx) => {
      await ctx.api.sendMessage(config.ADMIN_GROUP, await formatAboutMe(user), {
        message_thread_id: user.adminGroupTopic ?? undefined,
      });
    },
  );
}

const adminGroupUserMenu = new Menu<Context>("adminGroupUserMenu", {
  onMenuOutdated: makeOutdatedHandler(updateAdminGroupUserMenu),
})
  .text(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.update")),
    logHandle("menu:adminGroupUserMenu:update"),
    guard(isAdmin),
    updateAdminGroupUserMenu,
  )
  .submenu(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.edit")),
    "adminGroupEditUserMenu",
    logHandle("menu:adminGroupUserMenu:edit"),
    guard(isAdmin),
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
        logHandle("menu:adminGroupUserMenu:reject"),
        guard(isAdmin),
        async (ctx) => {
          await reject(ctx);
          await updateAdminGroupUserMenu(ctx);
        },
      );
      range.text(
        withPayload(i18n.t(config.DEFAULT_LOCALE, "admin_group.approve")),
        logHandle("menu:adminGroupUserMenu:approve"),
        guard(isAdmin),
        async (ctx) => {
          await approve(ctx);
          await updateAdminGroupUserMenu(ctx);
        },
      );
    } else if (user.status === UserStatus.Approved) {
      range.submenu(
        withPayload(i18n.t(config.DEFAULT_LOCALE, "admin_group.ban")),
        "adminGroupBanUserMenu",
        logHandle("menu:adminGroupUserMenu:ban"),
        guard(isAdmin),
        updateAdminGroupBanUserMenu,
      );
    } else if (user.status === UserStatus.Banned) {
      range.submenu(
        withPayload(i18n.t(config.DEFAULT_LOCALE, "admin_group.unban")),
        "adminGroupUnbanUserMenu",
        logHandle("menu:adminGroupUserMenu:unban"),
        guard(isAdmin),
        updateAdminGroupUnbanUserMenu,
      );
    }
  });
composer.use(adminGroupUserMenu);

async function updateAdminGroupUserMenu(ctx: Context) {
  const user = await getUserFromMatch(ctx);
  if (user !== undefined) {
    await editMessageTextSafe(ctx, await formatAboutMe(user));
    await setUserHeaderIsOpen(user.id, ctx.msgId, true);
  }
}

const adminGroupEditUserMenu = new Menu<Context>("adminGroupEditUserMenu", {
  onMenuOutdated: makeOutdatedHandler(updateAdminGroupEditUserMenu),
  autoAnswer: false,
})
  .dynamic(async (ctx, range) => {
    const user = await getUserFromMatch(ctx);
    if (user === undefined) return;

    range
      .text(
        withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.edit_name")),
        logHandle("menu:adminGroupEditUserMenu:edit-name"),
        guard(isAdmin),
        async (ctx) => {
          if (await enterEditName(ctx, user.id)) {
            await ctx.answerCallbackQuery();
          }
        },
      )
      .text(
        withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.edit_pronouns")),
        logHandle("menu:adminGroupEditUserMenu:edit-pronouns"),
        guard(isAdmin),
        async (ctx) => {
          if (await enterEditPronouns(ctx, user.id)) {
            await ctx.answerCallbackQuery();
          }
        },
      )
      .row()
      .text(
        withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.edit_gender")),
        logHandle("menu:adminGroupEditUserMenu:edit-gender"),
        guard(isAdmin),
        async (ctx) => {
          if (await enterEditGender(ctx, user.id)) {
            await ctx.answerCallbackQuery();
          }
        },
      )
      .text(
        withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.edit_sexuality")),
        logHandle("menu:adminGroupEditUserMenu:edit-sexuality"),
        guard(isAdmin),
        async (ctx) => {
          if (await enterEditSexuality(ctx, user.id)) {
            await ctx.answerCallbackQuery();
          }
        },
      )
      .row()
      .text(
        withPayload(() =>
          i18n.t(config.DEFAULT_LOCALE, "menu.edit_positioning"),
        ),
        logHandle("menu:adminGroupEditUserMenu:edit-positioning"),
        guard(isAdmin),
        async (ctx) => {
          if (await enterEditPositioning(ctx, user.id)) {
            await ctx.answerCallbackQuery();
          }
        },
      )
      .text(
        withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.edit_about_me")),
        logHandle("menu:adminGroupEditUserMenu:edit-aboutMe"),
        guard(isAdmin),
        async (ctx) => {
          if (await enterEditAboutMe(ctx, user.id)) {
            await ctx.answerCallbackQuery();
          }
        },
      )
      .row();
  })
  .back(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.back")),
    guard(isAdmin),
    async (ctx) => {
      await updateAdminGroupUserMenu(ctx);
      await ctx.answerCallbackQuery();
    },
  );
adminGroupUserMenu.register(adminGroupEditUserMenu);

async function updateAdminGroupEditUserMenu(ctx: Context) {
  const user = await getUserFromMatch(ctx);
  if (user !== undefined) {
    await editMessageTextSafe(
      ctx,
      i18n.t(config.DEFAULT_LOCALE, "menu.edit_prompt"),
    );
    await setUserHeaderIsOpen(user.id, ctx.msgId, false);
  }
}

const adminGroupBanUserMenu = new Menu<Context>("adminGroupBanUserMenu", {
  onMenuOutdated: makeOutdatedHandler(updateAdminGroupBanUserMenu),
})
  .back(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.back")),
    logHandle("menu:adminGroupBanUserMenu:back"),
    guard(isAdmin),
    updateAdminGroupUserMenu,
  )
  .back(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "admin_group.ban")),
    logHandle("menu:adminGroupBanUserMenu:ban"),
    guard(isAdmin),
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
      userLink: userLink(user.id),
      name: sanitizeHtmlOrEmpty(user.name),
    }),
  );
  await setUserHeaderIsOpen(user.id, ctx.msgId, false);
}

const adminGroupUnbanUserMenu = new Menu<Context>("adminGroupUnbanUserMenu", {
  onMenuOutdated: makeOutdatedHandler(updateAdminGroupUnbanUserMenu),
})
  .back(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "menu.back")),
    logHandle("menu:adminGroupUnbanUserMenu:back"),
    guard(isAdmin),
    updateAdminGroupUserMenu,
  )
  .back(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "admin_group.unban")),
    logHandle("menu:adminGroupUnbanUserMenu:unban"),
    guard(isAdmin),
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
      userLink: userLink(user.id),
      name: sanitizeHtmlOrEmpty(user.name),
    }),
  );
  await setUserHeaderIsOpen(user.id, ctx.msgId, false);
}

export const adminPostInterviewMenu = new Menu<Context>(
  "adminPostInterviewMenu",
)
  .submenu(
    withPayload(i18n.t(config.DEFAULT_LOCALE, "admin_group.reject")),
    "adminPostInterviewDecisionMadeMenu",
    logHandle("menu:adminPostInterviewMenu:reject"),
    guard(isAdmin),
    reject,
  )
  .submenu(
    withPayload(i18n.t(config.DEFAULT_LOCALE, "admin_group.approve")),
    "adminPostInterviewDecisionMadeMenu",
    logHandle("menu:adminPostInterviewMenu:approve"),
    guard(isAdmin),
    approve,
  );
composer.use(adminPostInterviewMenu);

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

composer
  .filter(isAdmin)
  .callbackQuery(
    confirmSignupData.filter(),
    logHandle("callback:confirmSignup"),
    async (ctx) => {
      const { eventId, userId } = confirmSignupData.unpack(
        ctx.callbackQuery.data,
      );

      const user = await getUser(userId);
      if (user === null) return;

      await confirmSignup(ctx, eventId, user);
      await ctx.editMessageReplyMarkup({
        reply_markup: new InlineKeyboard(),
      });
    },
  );

composer
  .filter(isAdmin)
  .callbackQuery(
    confirmPaymentData.filter(),
    logHandle("callback:confirmPayment"),
    async (ctx) => {
      const { eventId, userId } = confirmPaymentData.unpack(
        ctx.callbackQuery.data,
      );

      const user = await getUser(userId);
      if (user === null) return;

      await confirmPayment(ctx, eventId, user);
      await ctx.editMessageReplyMarkup({
        reply_markup: new InlineKeyboard(),
      });
    },
  );

composer
  .filter(isAdmin)
  .callbackQuery(
    rejectSignupData.filter(),
    logHandle("callback:rejectSignup"),
    async (ctx) => {
      const { eventId, userId } = rejectSignupData.unpack(
        ctx.callbackQuery.data,
      );

      const user = await getUser(userId);
      if (user === null) return;

      await rejectSignup(ctx, eventId, user);
      await ctx.editMessageReplyMarkup({
        reply_markup: new InlineKeyboard(),
      });
    },
  );

async function getUserFromMatch(ctx: Context): Promise<User | undefined> {
  const userId = Number(ctx.match);
  if (Number.isFinite(userId)) {
    const user = await getUser(userId);
    return user === null ? undefined : user;
  }

  // Make sure old menus still work.
  return getUserForTopic(ctx);
}
