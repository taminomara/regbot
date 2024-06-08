import { Menu } from "@grammyjs/menu";
import { Composer } from "grammy";

import {
  SignupStatus,
  getEventSignups,
  getEventWithUserSignup,
  upcomingEventsWithUserSignup,
} from "#root/backend/event.js";
import { getUserOrFail } from "#root/backend/user.js";
import { Context } from "#root/bot/context.js";
import {
  enterEditGender,
  enterEditName,
  enterEditPronouns,
  enterEditSexuality,
} from "#root/bot/features/edit-user.js";
import {
  signupForEvent,
  withdrawSignup,
} from "#root/bot/features/event-signup.js";
import { registerCommandHelpProvider } from "#root/bot/features/help.js";
import { isApproved } from "#root/bot/filters/is-approved.js";
import { editMessageTextSafe } from "#root/bot/helpers/edit-text.js";
import { toFluentDateTime } from "#root/bot/helpers/i18n.js";
import {
  sanitizeHtml,
  sanitizeHtmlOrEmpty,
} from "#root/bot/helpers/sanitize-html.js";
import { withPayload } from "#root/bot/helpers/with-payload.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

export const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isApproved);

export const eventsMenu = new Menu<Context>("eventsMenu")
  .text((ctx) => ctx.t("menu.update"), updateEventsMenu)
  .submenu((ctx) => ctx.t("menu.profile"), "profileMenu", updateProfileMenu)
  .row()
  .dynamic(async (ctx, range) => {
    const events = await upcomingEventsWithUserSignup(ctx.user.id);
    for (const event of events) {
      range
        .submenu(
          {
            text: ctx.t("menu.event_title", {
              name: event.name,
              date: toFluentDateTime(event.date),
              signedUp:
                event.signup === undefined
                  ? "no"
                  : {
                      [SignupStatus.Approved]: "approved",
                      [SignupStatus.Rejected]: "rejected",
                      [SignupStatus.PendingApproval]: "pending",
                      [SignupStatus.PendingPayment]: "pending",
                    }[event.signup.status],
            }),
            payload: String(event.id),
          },
          "eventMenu",
          updateEventMenu,
        )
        .row();
    }
  });
feature.use(eventsMenu);
async function updateEventsMenu(ctx: Context) {
  await editMessageTextSafe(ctx, ctx.t("menu.events"));
}

const profileMenu = new Menu<Context>("profileMenu")
  .text((ctx) => ctx.t("menu.update"), updateProfileMenu)
  .submenu(
    (ctx) => ctx.t("menu.edit"),
    "editProfileMenu",
    updateEditProfileMenu,
  )
  .row()
  .back((ctx) => ctx.t("menu.back"), updateEventsMenu);
eventsMenu.register(profileMenu);
async function updateProfileMenu(ctx: Context) {
  const user = await getUserOrFail(ctx.user.id);
  await editMessageTextSafe(
    ctx,
    ctx.t("menu.about", {
      name: sanitizeHtmlOrEmpty(user.name),
      pronouns: sanitizeHtmlOrEmpty(user.pronouns),
      gender: sanitizeHtmlOrEmpty(user.gender),
      sexuality: sanitizeHtmlOrEmpty(user.sexuality),
    }),
  );
}

const editProfileMenu = new Menu<Context>("editProfileMenu")
  .text((ctx) => ctx.t("menu.edit_name"), enterEditName)
  .text((ctx) => ctx.t("menu.edit_pronouns"), enterEditPronouns)
  .row()
  .text((ctx) => ctx.t("menu.edit_gender"), enterEditGender)
  .text((ctx) => ctx.t("menu.edit_sexuality"), enterEditSexuality)
  .row()
  .back((ctx) => ctx.t("menu.back"), updateProfileMenu);
profileMenu.register(editProfileMenu);
async function updateEditProfileMenu(ctx: Context) {
  await editMessageTextSafe(ctx, ctx.t("menu.edit_prompt"));
}

const eventMenu = new Menu<Context>("eventMenu")
  .dynamic(async (ctx, range) => {
    const event = await getEventFromMatch(ctx);
    if (event === undefined) return;

    range.text(
      withPayload(
        ctx.t("menu.signup_button", {
          name: event.name,
          date: toFluentDateTime(event.date),
          signedUp:
            event.signup === undefined
              ? "no"
              : {
                  [SignupStatus.Approved]: "approved",
                  [SignupStatus.Rejected]: "rejected",
                  [SignupStatus.PendingApproval]: "pending",
                  [SignupStatus.PendingPayment]: "pending",
                }[event.signup.status],
        }),
      ),
      async (ctx) => {
        await signupForEvent(null, ctx, event.id, ctx.user);
        await updateEventMenu(ctx);
      },
    );
    if (
      event.signup !== undefined &&
      [
        SignupStatus.Approved,
        SignupStatus.PendingApproval,
        SignupStatus.PendingPayment,
      ].includes(event.signup?.status)
    ) {
      range.row();
      range.submenu(
        withPayload(ctx.t("menu.cancel_signup_button")),
        "cancelSignupMenu",
        updateCancelSignupMenu,
      );
    }
    range.row();
    range.submenu(
      withPayload(ctx.t("menu.who_else_coming_button")),
      "eventParticipantsMenu",
      updateEventParticipantsMenu,
    );
  })
  .row()
  .back(
    withPayload((ctx) => ctx.t("menu.back")),
    updateEventsMenu,
  );
eventsMenu.register(eventMenu);
async function updateEventMenu(ctx: Context) {
  const event = await getEventFromMatch(ctx);
  if (event === undefined) return;
  await editMessageTextSafe(
    ctx,
    event.announceTextHtml ??
      ctx.t("menu.event", {
        name: event.name,
        date: toFluentDateTime(event.date),
      }),
  );
}

const eventParticipantsMenu = new Menu<Context>("eventParticipantsMenu").back(
  withPayload((ctx) => ctx.t("menu.back")),
  updateEventMenu,
);
eventMenu.register(eventParticipantsMenu);
async function updateEventParticipantsMenu(ctx: Context) {
  const event = await getEventFromMatch(ctx);
  if (event === undefined) return;

  const participants = (await getEventSignups(event.id))
    .filter((signup) => signup.status === SignupStatus.Approved)
    .map((signup) =>
      signup.user.username
        ? ctx.t("menu.event_participant", {
            id: String(signup.user.id),
            name: sanitizeHtmlOrEmpty(signup.user.name),
            pronouns: sanitizeHtmlOrEmpty(signup.user.pronouns),
            username: sanitizeHtml(signup.user.username),
          })
        : ctx.t("menu.event_participant_no_username", {
            id: String(signup.user.id),
            name: sanitizeHtmlOrEmpty(signup.user.name),
            pronouns: sanitizeHtmlOrEmpty(signup.user.pronouns),
          }),
    )
    .join("\n");

  await editMessageTextSafe(
    ctx,
    ctx.t("menu.event_participants", {
      participants,
    }),
  );
}

export const cancelSignupMenu = new Menu<Context>("cancelSignupMenu")
  .back(
    withPayload(() =>
      i18n.t(config.DEFAULT_LOCALE, "menu.cancel_signup_button_no"),
    ),
    updateEventMenu,
  )
  .back(
    withPayload(() =>
      i18n.t(config.DEFAULT_LOCALE, "menu.cancel_signup_button_yes"),
    ),
    async (ctx) => {
      const event = await getEventFromMatch(ctx);
      if (event === undefined) return;

      await withdrawSignup(null, ctx, event.id, ctx.user);
    },
    updateEventMenu,
  );
eventMenu.register(cancelSignupMenu);
async function updateCancelSignupMenu(ctx: Context) {
  await editMessageTextSafe(ctx, ctx.t("menu.cancel_signup_confirmation"));
}

async function getEventFromMatch(ctx: Context) {
  const eventId = Number(ctx.match);
  if (!Number.isFinite(eventId)) {
    ctx.logger.error("Can't get event id form match", { match: ctx.match });
    return;
  }
  const event = await getEventWithUserSignup(eventId, ctx.user.id);
  if (event === null) {
    ctx.logger.error("Can't get event id form match", { match: ctx.match });
    return;
  }
  return event;
}

feature.command("menu", async (ctx) => {
  await ctx.reply(ctx.t("menu.events"), { reply_markup: eventsMenu });
});

registerCommandHelpProvider((localeCode) => {
  return [
    {
      command: "menu",
      description: i18n.t(localeCode, "menu_command.description"),
    },
  ];
});
