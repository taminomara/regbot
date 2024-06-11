import { Menu } from "@grammyjs/menu";
import { Composer } from "grammy";

import {
  SignupStatus,
  getApprovedEventSignups,
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

const feature = composer.filter(isApproved);

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

    if (event.signup === undefined && event.participationOptions !== null) {
      range.submenu(
        withPayload(
          ctx.t("menu.signup_button", {
            name: event.name,
            date: toFluentDateTime(event.date),
            signedUp: "no",
          }),
        ),
        "optionsMenu",
        updateOptionsMenu,
      );
    } else {
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
          await signupForEvent(null, ctx, event.id, ctx.user, null);
          await updateEventMenu(ctx);
        },
      );
    }
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
        name: sanitizeHtmlOrEmpty(event.name),
        date: toFluentDateTime(event.date),
        price: sanitizeHtmlOrEmpty(event.price),
      }),
    {
      link_preview_options: { is_disabled: true },
    },
  );
}

const eventParticipantsMenu = new Menu<Context>("eventParticipantsMenu")
  .back(
    withPayload((ctx) => ctx.t("menu.back")),
    updateEventMenu,
  )
  .text(
    withPayload((ctx) => ctx.t("menu.update")),
    updateEventParticipantsMenu,
  );
eventMenu.register(eventParticipantsMenu);
async function updateEventParticipantsMenu(ctx: Context) {
  const event = await getEventFromMatch(ctx);
  if (event === undefined) return;

  const participants = (await getApprovedEventSignups(event.id))
    .map((signup) => {
      let options = (signup.participationOptions ?? [])
        .map(
          (option) =>
            /^(?<emoji>\p{Emoji})/gu.exec(option)?.groups?.emoji ?? option,
        )
        .join("/");
      if (options.length > 0) {
        options = `(${options})`;
      }

      return signup.user.username
        ? ctx.t("menu.event_participant", {
            id: String(signup.user.id),
            name: sanitizeHtmlOrEmpty(signup.user.name),
            pronouns: sanitizeHtmlOrEmpty(signup.user.pronouns),
            username: sanitizeHtml(signup.user.username),
            options,
          })
        : ctx.t("menu.event_participant_no_username", {
            id: String(signup.user.id),
            name: sanitizeHtmlOrEmpty(signup.user.name),
            pronouns: sanitizeHtmlOrEmpty(signup.user.pronouns),
            options,
          });
    })
    .join("\n");

  await editMessageTextSafe(
    ctx,
    ctx.t(
      participants.length > 0
        ? "menu.event_participants"
        : "menu.event_participants_empty",
      {
        participants,
        name: sanitizeHtmlOrEmpty(event.name),
        date: toFluentDateTime(event.date),
      },
    ),
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
      await updateEventMenu(ctx);
    },
  );
eventMenu.register(cancelSignupMenu);
async function updateCancelSignupMenu(ctx: Context) {
  await editMessageTextSafe(ctx, ctx.t("menu.cancel_signup_confirmation"));
}

const optionsMenu = new Menu<Context>("optionsMenu", {
  fingerprint: async (ctx) =>
    (await getEventFromMatch(ctx))?.participationOptions?.join("\n") ?? "",
}).dynamic(async (ctx, range) => {
  const event = await getEventFromMatch(ctx);
  if (event === undefined) return;

  const { eventId, options } = unpackMatch(ctx.match);
  const participationOptions = event.participationOptions ?? [];

  for (let i = 0; i < participationOptions.length; i += 1) {
    const selected = options[i] ?? false;
    options[i] = !selected;
    range.text(
      {
        text: (selected ? "☑️ " : "➖ ") + participationOptions[i],
        payload: packMatch(eventId ?? NaN, [...options]),
      },
      updateOptionsMenu,
    );
    range.row();
    options[i] = selected;
  }

  range.back(
    {
      text: (ctx) => ctx.t("menu.back"),
      payload: (ctx) => String(unpackMatch(ctx.match).eventId),
    },
    updateEventMenu,
  );

  range.back(
    withPayload(
      ctx.t("menu.signup_button", {
        name: event.name,
        date: toFluentDateTime(event.date),
        signedUp: "no",
      }),
    ),
    async (ctx) => {
      const chosenOptions = [];
      for (let i = 0; i < participationOptions.length; i += 1) {
        if (options[i]) {
          chosenOptions.push(participationOptions[i]);
        }
      }

      await signupForEvent(null, ctx, event.id, ctx.user, chosenOptions);
      await updateEventMenu(ctx);
    },
  );
});
eventMenu.register(optionsMenu);
async function updateOptionsMenu(ctx: Context) {
  // Do not edit message text.
  //
  // When this menu is rendered from the event list, the text will contain
  // event description, which is what we want. When this menu is rendered
  // from the post-interview signup process, the text will contain
  // registration prompt, which is also what we want.
  //
  // In either case, we don't want to override this text.
  // We still invoke `editMessageTextSafe` to refresh menu, though.
  await editMessageTextSafe(ctx, ctx.msg!.text!, {
    entities: ctx.msg!.entities,
  });
}

function packMatch(eventId: number, options: boolean[]) {
  let optionBits = 0;
  for (let i = 0; i < options.length; i += 1) {
    if (options[i]) {
      // eslint-disable-next-line no-bitwise
      optionBits |= 1 << i;
    }
  }
  return `${eventId};${String.fromCharCode(optionBits)}`;
}

function unpackMatch(match?: string): { eventId?: number; options: boolean[] } {
  const [encodedEventId, encodedOptions] = match?.split(";") ?? ["", ""];

  let eventId: number | undefined = Number(encodedEventId);
  if (!Number.isFinite(eventId)) {
    eventId = undefined;
  }

  let bitOptions = (encodedOptions ?? "").charCodeAt(0);
  const options = [];
  while (bitOptions > 0) {
    // eslint-disable-next-line no-bitwise
    options.push((bitOptions & 1) === 1);
    // eslint-disable-next-line no-bitwise
    bitOptions >>= 1;
  }
  return { eventId, options };
}

async function getEventFromMatch(ctx: Context) {
  const { eventId } = unpackMatch(ctx.match);
  if (eventId === undefined) {
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

feature.chatType("private").command("menu", async (ctx) => {
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
