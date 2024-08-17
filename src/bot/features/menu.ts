import { Other } from "@grammyjs/hydrate";
import { Menu } from "@grammyjs/menu";
import { Composer } from "grammy";

import {
  Event,
  SignupStatus,
  getApprovedEventSignups,
  getEventSignup,
  getEventWithUserSignup,
  upcomingEventsWithUserSignup,
} from "#root/backend/event.js";
import { User, getUserOrFail } from "#root/backend/user.js";
import { Context } from "#root/bot/context.js";
import {
  enterEditAboutMe,
  enterEditGender,
  enterEditName,
  enterEditPositioning,
  enterEditPronouns,
  enterEditSexuality,
} from "#root/bot/features/edit-user.js";
import {
  signupForEvent,
  withdrawSignup,
} from "#root/bot/features/event-signup.js";
import {
  CommandPrivileges,
  CommandScope,
  registerCommandHelp,
} from "#root/bot/features/help.js";
import { isApproved } from "#root/bot/filters/is-approved.js";
import { editMessageTextSafe } from "#root/bot/helpers/edit-text.js";
import { toFluentDateTime } from "#root/bot/helpers/i18n.js";
import {
  sanitizeHtml,
  sanitizeHtmlOrEmpty,
} from "#root/bot/helpers/sanitize-html.js";
import { withPayload } from "#root/bot/helpers/with-payload.js";

import { formatEventText, formatEventTitleForMenu } from "../helpers/event.js";
import { userLink } from "../helpers/links.js";
import { logHandle } from "../helpers/logging.js";
import { makeOutdatedHandler, patchCtx } from "../helpers/menu.js";

export const composer = new Composer<Context>();

export async function sendEditProfileMenu(ctx: Context, chatId: number) {
  const user = await getUserOrFail(ctx.user.id);
  await ctx.api.sendMessage(chatId, formatAbout(ctx, user), {
    reply_markup: eventsMenu.at("editProfileMenu"),
  });
}

export async function sendEventsMenu(
  ctx: Context,
  chatId: number,
  text?: string,
  locale?: string,
  other?: Other<"sendMessage", "chat_id" | "text" | "reply_markup">,
) {
  await patchCtx(ctx, { locale }, async (ctx) => {
    await ctx.api.sendMessage(chatId, text ?? ctx.t("menu.events"), {
      ...other,
      reply_markup: eventsMenu,
    });
  });
}

export async function sendEventMenu(
  ctx: Context,
  chatId: number,
  event: Event,
  text?: string,
  locale?: string,
  other?: Other<
    "sendMessage",
    "chat_id" | "text" | "reply_markup" | "link_preview_options"
  >,
) {
  await patchCtx(ctx, { match: event.id, locale }, async (ctx) => {
    await ctx.api.sendMessage(chatId, text ?? formatEventText(ctx, event), {
      ...other,
      link_preview_options: { is_disabled: true },
      reply_markup: eventsMenu.at("eventMenu"),
    });
  });
}

const eventsMenu = new Menu<Context>("eventsMenu", {
  onMenuOutdated: makeOutdatedHandler(updateEventsMenu),
})
  .text(
    (ctx) => ctx.t("menu.update"),
    logHandle("menu:eventsMenu:update"),
    updateEventsMenu,
  )
  .submenu(
    (ctx) => ctx.t("menu.profile"),
    "profileMenu",
    logHandle("menu:eventsMenu:profile"),
    updateProfileMenu,
  )
  .row()
  .dynamic(async (ctx, range) => {
    if (!(await isApproved(ctx))) return;

    const events = await upcomingEventsWithUserSignup(ctx.user.id);
    for (const event of events) {
      range
        .submenu(
          {
            text: formatEventTitleForMenu(ctx, event),
            payload: String(event.id),
          },
          "eventMenu",
          logHandle("menu:eventsMenu:event"),
          updateEventMenu,
        )
        .row();
    }
  });
composer.use(eventsMenu);
async function updateEventsMenu(ctx: Context) {
  await editMessageTextSafe(ctx, ctx.t("menu.events"));
}

const profileMenu = new Menu<Context>("profileMenu", {
  onMenuOutdated: makeOutdatedHandler(updateProfileMenu),
})
  .text(
    (ctx) => ctx.t("menu.update"),
    logHandle("menu:profileMenu:update"),
    updateProfileMenu,
  )
  .submenu(
    (ctx) => ctx.t("menu.edit"),
    "editProfileMenu",
    logHandle("menu:profileMenu:edit"),
    updateEditProfileMenu,
  )
  .row()
  .back(
    (ctx) => ctx.t("menu.back"),
    logHandle("menu:profileMenu:back"),
    updateEventsMenu,
  );
eventsMenu.register(profileMenu);
async function updateProfileMenu(ctx: Context) {
  const user = await getUserOrFail(ctx.user.id);

  await editMessageTextSafe(ctx, formatAbout(ctx, user));
}

function formatAbout(ctx: Context, user: User) {
  let about = ctx.t("menu.about", {
    name: sanitizeHtmlOrEmpty(user.name),
    pronouns: sanitizeHtmlOrEmpty(user.pronouns),
    gender: sanitizeHtmlOrEmpty(user.gender),
    sexuality: sanitizeHtmlOrEmpty(user.sexuality),
    positioning: sanitizeHtmlOrEmpty(user.positioning),
  });

  if (user.aboutMeHtml !== null) {
    about += `\n\n<b>${ctx.t("menu.about_me")}</b>\n\n<blockquote>${
      user.aboutMeHtml
    }</blockquote>`;
  }

  return about;
}

const editProfileMenu = new Menu<Context>("editProfileMenu", {
  onMenuOutdated: makeOutdatedHandler(updateEditProfileMenu),
  autoAnswer: false,
})
  .text(
    (ctx) => ctx.t("menu.edit_name"),
    logHandle("menu:editProfileMenu:edit-name"),
    async (ctx) => {
      if (await enterEditName(ctx, ctx.user.id, true)) {
        await ctx.answerCallbackQuery();
      }
    },
  )
  .text(
    (ctx) => ctx.t("menu.edit_pronouns"),
    logHandle("menu:editProfileMenu:edit-pronouns"),
    async (ctx) => {
      if (await enterEditPronouns(ctx, ctx.user.id, true)) {
        await ctx.answerCallbackQuery();
      }
    },
  )
  .row()
  .text(
    (ctx) => ctx.t("menu.edit_gender"),
    logHandle("menu:editProfileMenu:edit-gender"),
    async (ctx) => {
      if (await enterEditGender(ctx, ctx.user.id, true)) {
        await ctx.answerCallbackQuery();
      }
    },
  )
  .text(
    (ctx) => ctx.t("menu.edit_sexuality"),
    logHandle("menu:editProfileMenu:edit-sexuality"),
    async (ctx) => {
      if (await enterEditSexuality(ctx, ctx.user.id, true)) {
        await ctx.answerCallbackQuery();
      }
    },
  )
  .row()
  .text(
    (ctx) => ctx.t("menu.edit_positioning"),
    logHandle("menu:editProfileMenu:edit-positioning"),
    async (ctx) => {
      if (await enterEditPositioning(ctx, ctx.user.id, true)) {
        await ctx.answerCallbackQuery();
      }
    },
  )
  .text(
    withPayload((ctx) => ctx.t("menu.edit_about_me")),
    logHandle("menu:adminGroupEditUserMenu:edit-aboutMe"),
    async (ctx) => {
      if (await enterEditAboutMe(ctx, ctx.user.id, true)) {
        await ctx.answerCallbackQuery();
      }
    },
  )
  .row()
  .back(
    (ctx) => ctx.t("menu.back"),
    logHandle("menu:editProfileMenu:back"),
    async (ctx) => {
      await updateProfileMenu(ctx);
      await ctx.answerCallbackQuery();
    },
  );
profileMenu.register(editProfileMenu);
async function updateEditProfileMenu(ctx: Context) {
  await updateProfileMenu(ctx);
}

const eventMenu = new Menu<Context>("eventMenu", {
  onMenuOutdated: makeOutdatedHandler(updateEventMenu),
})
  .dynamic(async (ctx, range) => {
    if (!(await isApproved(ctx))) return;

    const event = await getEventFromMatch(ctx);
    if (event === undefined) return;

    if (!event.registrationOpen && event.signup === undefined) {
      // Registration closed.
    } else if (
      event.signup === undefined &&
      event.participationOptions !== null
    ) {
      range.submenu(
        withPayload(
          ctx.t("menu.signup_button", {
            name: event.name,
            date: toFluentDateTime(event.date),
            signedUp: "no",
          }),
        ),
        "optionsMenu",
        logHandle("menu:eventMenu:signup-options"),
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
        logHandle("menu:eventMenu:signup"),
        async (ctx) => {
          await signupForEvent(ctx, event.id, ctx.user, null);
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
        logHandle("menu:eventMenu:cancel-signup"),
        updateCancelSignupMenu,
      );
    }
    range.row();
    range.submenu(
      withPayload(ctx.t("menu.who_else_coming_button")),
      "eventParticipantsMenu",
      logHandle("menu:eventMenu:who-else-coming"),
      updateEventParticipantsMenu,
    );
  })
  .row()
  .back(
    {
      text: (ctx) => ctx.t("menu.back"),
      payload: (ctx) => String(unpackMatch(ctx.match).eventId),
    },
    logHandle("menu:eventMenu:back"),
    updateEventsMenu,
  );
eventsMenu.register(eventMenu);
async function updateEventMenu(ctx: Context) {
  if (!(await isApproved(ctx))) return;

  const event = await getEventFromMatch(ctx);
  if (event === undefined) return;
  await editMessageTextSafe(ctx, formatEventText(ctx, event), {
    link_preview_options: { is_disabled: true },
  });
}

const eventParticipantsMenu = new Menu<Context>("eventParticipantsMenu", {
  onMenuOutdated: makeOutdatedHandler(updateEventParticipantsMenu),
})
  .text(
    withPayload((ctx) => ctx.t("menu.update")),
    logHandle("menu:eventParticipantsMenu:update"),
    updateEventParticipantsMenu,
  )
  .row()
  .dynamic(async (ctx, range) => {
    if (!(await isApproved(ctx))) return;

    const event = await getEventFromMatch(ctx);
    if (event === undefined) return;

    const { options } = unpackMatch(ctx.match);

    const signups = await getApprovedEventSignups(event.id);
    for (const signup of signups) {
      let participantOptions = (signup.participationOptions ?? [])
        .map((option) => /^(?<emoji>\p{Emoji})/gu.exec(option)?.groups?.emoji)
        .filter((option) => option)
        .join("/");
      if (participantOptions.length > 0) {
        participantOptions = `, ${participantOptions}`;
      }
      if (signup.user.positioning !== null) {
        participantOptions = `, ${sanitizeHtmlOrEmpty(signup.user.positioning)}${participantOptions}`;
      }

      const text = signup.user.username
        ? ctx.t("menu.event_participant_button", {
            name: sanitizeHtmlOrEmpty(signup.user.name),
            username: sanitizeHtml(signup.user.username),
            pronouns: sanitizeHtmlOrEmpty(signup.user.pronouns),
            options: participantOptions,
          })
        : ctx.t("menu.event_participant_button_no_username", {
            name: sanitizeHtmlOrEmpty(signup.user.name),
            pronouns: sanitizeHtmlOrEmpty(signup.user.pronouns),
            options: participantOptions,
          });

      range.submenu(
        {
          text,
          payload: packMatch(event.id, options, signup.user.id),
        },
        "eventParticipantMenu",
        logHandle("menu:eventParticipantsMenu:event-participant"),
        updateEventParticipantMenu,
      );
      range.row();
    }
  })
  .row()
  .back(
    withPayload((ctx) => ctx.t("menu.back")),
    logHandle("menu:eventParticipantsMenu:back"),
    updateEventMenu,
  );
eventMenu.register(eventParticipantsMenu);
async function updateEventParticipantsMenu(ctx: Context) {
  if (!(await isApproved(ctx))) return;

  const event = await getEventFromMatch(ctx);
  if (event === undefined) return;

  const signups = await getApprovedEventSignups(event.id);
  await editMessageTextSafe(
    ctx,
    ctx.t(
      signups.length > 0
        ? "menu.event_participants"
        : "menu.event_participants_empty",
      {
        name: sanitizeHtmlOrEmpty(event.name),
        date: toFluentDateTime(event.date),
      },
    ),
  );
}

const eventParticipantMenu = new Menu<Context>("eventParticipantMenu", {
  onMenuOutdated: makeOutdatedHandler(updateEventParticipantMenu),
})
  .text(
    withPayload((ctx) => ctx.t("menu.update")),
    logHandle("menu:eventParticipantMenu:update"),
    updateEventParticipantMenu,
  )
  .row()
  .text(
    withPayload((ctx) => ctx.t("menu.previous_profile")),
    logHandle("menu:eventParticipantMenu:previous"),
    (ctx) => eventParticipantMenuNext(ctx, -1),
  )
  .text(
    withPayload((ctx) => ctx.t("menu.next_profile")),
    logHandle("menu:eventParticipantMenu:next"),
    (ctx) => eventParticipantMenuNext(ctx, 1),
  )
  .row()
  .back(
    withPayload((ctx) => ctx.t("menu.back")),
    logHandle("menu:eventParticipantMenu:back"),
    updateEventParticipantsMenu,
  );
eventParticipantsMenu.register(eventParticipantMenu);
async function updateEventParticipantMenu(ctx: Context) {
  if (!(await isApproved(ctx))) return;

  const event = await getEventFromMatch(ctx);
  if (event === undefined) return;

  const { profileUserId } = unpackMatch(ctx.match);
  if (profileUserId === undefined) return;

  const signup = await getEventSignup(event.id, profileUserId);
  if (signup === null) return;

  let text =
    signup.user.username === null
      ? ctx.t("menu.event_participant_no_username", {
          userLink: userLink(signup.user.id),
          name: sanitizeHtmlOrEmpty(signup.user.name),
          pronouns: sanitizeHtmlOrEmpty(signup.user.pronouns),
          options: "",
        })
      : ctx.t("menu.event_participant", {
          userLink: userLink(signup.user.id),
          name: sanitizeHtmlOrEmpty(signup.user.name),
          pronouns: sanitizeHtmlOrEmpty(signup.user.pronouns),
          username: sanitizeHtml(signup.user.username),
          options: "",
        });

  if (signup.user.gender !== null) {
    text += `\n${ctx.t("menu.event_participant_gender", { gender: sanitizeHtml(signup.user.gender) })}`;
  }
  if (signup.user.sexuality !== null) {
    text += `\n${ctx.t("menu.event_participant_sexuality", { sexuality: sanitizeHtml(signup.user.sexuality) })}`;
  }
  if (signup.user.positioning !== null) {
    text += `\n${ctx.t("menu.event_participant_positioning", { positioning: sanitizeHtml(signup.user.positioning) })}`;
  }
  if (
    signup.participationOptions !== null &&
    signup.participationOptions.length > 0
  ) {
    const options = signup.participationOptions.join(", ");
    text += `\n${ctx.t("menu.event_participant_options", { options: sanitizeHtml(options) })}`;
  }
  if (signup.user.aboutMeHtml !== null) {
    text += `\n\n<b>${ctx.t("menu.about_me")}</b>\n\n<blockquote>${
      signup.user.aboutMeHtml
    }</blockquote>`;
  }

  await editMessageTextSafe(ctx, text);
}
async function eventParticipantMenuNext(ctx: Context, n: number) {
  if (!(await isApproved(ctx))) return;

  const event = await getEventFromMatch(ctx);
  if (event === undefined) return;

  const { options, profileUserId } = unpackMatch(ctx.match);
  if (profileUserId === undefined) return;

  const signups = await getApprovedEventSignups(event.id);
  const index = signups.findIndex((signup) => signup.user.id === profileUserId);

  if (index === -1) {
    ctx.menu.back();
    await updateEventParticipantsMenu(ctx);
  } else {
    let nextIndex = (index + n + signups.length) % signups.length;
    while (nextIndex < 0) {
      nextIndex += signups.length;
    }
    ctx.match = packMatch(event.id, options, signups[nextIndex].user.id);
    ctx.menu.update();
    await updateEventParticipantMenu(ctx);
  }
}

export const cancelSignupMenu = new Menu<Context>("cancelSignupMenu", {
  onMenuOutdated: makeOutdatedHandler(updateCancelSignupMenu),
})
  .back(
    withPayload((ctx) => ctx.t("menu.cancel_signup_button_no")),
    logHandle("menu:cancelSignupMenu:back"),
    updateEventMenu,
  )
  .back(
    withPayload((ctx) => ctx.t("menu.cancel_signup_button_yes")),
    logHandle("menu:cancelSignupMenu:cancel"),
    async (ctx) => {
      const event = await getEventFromMatch(ctx);
      if (event === undefined) return;

      await withdrawSignup(ctx, event.id, ctx.user);
      await updateEventMenu(ctx);
    },
  );
eventMenu.register(cancelSignupMenu);
async function updateCancelSignupMenu(ctx: Context) {
  await editMessageTextSafe(ctx, ctx.t("menu.cancel_signup_confirmation"));
}

const optionsMenu = new Menu<Context>("optionsMenu", {
  onMenuOutdated: makeOutdatedHandler(updateOptionsMenu),
  fingerprint: async (ctx) =>
    (await getEventFromMatch(ctx))?.participationOptions?.join("\n") ?? "",
}).dynamic(async (ctx, range) => {
  if (!(await isApproved(ctx))) return;

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
      logHandle("menu:optionsMenu:toggle-option"),
      updateOptionsMenu,
    );
    range.row();
    options[i] = selected;
  }

  range.back(
    withPayload((ctx) => ctx.t("menu.back")),
    logHandle("menu:optionsMenu:back"),
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
    logHandle("menu:optionsMenu:signup"),
    async (ctx) => {
      const chosenOptions = [];
      for (let i = 0; i < participationOptions.length; i += 1) {
        if (options[i]) {
          chosenOptions.push(participationOptions[i]);
        }
      }

      await signupForEvent(ctx, event.id, ctx.user, chosenOptions);
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

function packMatch(
  eventId: number,
  options: boolean[],
  profileUserId?: number,
) {
  let optionBits = 0;
  for (let i = 0; i < options.length; i += 1) {
    if (options[i]) {
      // eslint-disable-next-line no-bitwise
      optionBits |= 1 << i;
    }
  }
  const encodedProfileUserId =
    profileUserId === undefined ? "" : String(profileUserId);
  return `${eventId};${String.fromCharCode(optionBits)};${encodedProfileUserId}`;
}

function unpackMatch(match?: string): {
  eventId?: number;
  options: boolean[];
  profileUserId?: number;
} {
  const [encodedEventId, encodedOptions, encodedProfileUserId] = match?.split(
    ";",
  ) ?? ["", "", ""];

  let eventId: number | undefined = Number(encodedEventId ?? "");
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

  let profileUserId: number | undefined = Number(encodedProfileUserId ?? "");
  if (!Number.isFinite(profileUserId)) {
    profileUserId = undefined;
  }

  return { eventId, options, profileUserId };
}

async function getEventFromMatch(ctx: Context) {
  const { eventId } = unpackMatch(ctx.match);
  if (eventId === undefined) {
    ctx.logger.error({
      msg: "Can't get event id form match",
      match: ctx.match,
    });
    return;
  }
  const event = await getEventWithUserSignup(eventId, ctx.user.id);
  if (event === null) {
    ctx.logger.error({
      msg: "Can't get event id form match",
      match: ctx.match,
    });
    return;
  }
  if (!event.published) {
    ctx.logger.error({
      msg: "Trying to request an unpublished event",
      match: ctx.match,
    });
    return;
  }

  return event;
}

composer
  .chatType("private")
  .filter(isApproved)
  .command("menu", logHandle("command:menu"), async (ctx) => {
    await sendEventsMenu(ctx, ctx.chatId);
  });

registerCommandHelp({
  command: "menu",
  scope: CommandScope.PrivateChat,
  privileges: CommandPrivileges.AllUsers,
});
