import { Menu } from "@grammyjs/menu";
import { Composer, Filter, GrammyError } from "grammy";
import moment from "moment-timezone";

import { EventPayment } from "#root/backend/entities/event.js";
import {
  Event,
  createEvent as createDbEvent,
  deleteEvent as deleteDbEvent,
  getEventSignups,
  getEventWithSignupStats,
  upcomingEventsWithSignupStats,
  updateEvent,
} from "#root/backend/event.js";
import { Context } from "#root/bot/context.js";
import {
  CommandPrivileges,
  CommandScope,
  registerCommandHelp,
} from "#root/bot/features/help.js";
import { isAdmin } from "#root/bot/filters/index.js";
import {
  FINISH,
  REPEAT,
  conversation,
  prompt,
} from "#root/bot/helpers/conversations-v2.js";
import {
  deleteMessageSafe,
  editMessageTextSafe,
} from "#root/bot/helpers/edit-text.js";
import { toFluentDateTime } from "#root/bot/helpers/i18n.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { parseTelegramEntities } from "#root/bot/helpers/parse-telegram-entities.js";
import {
  sanitizeHtml,
  sanitizeHtmlOrEmpty,
} from "#root/bot/helpers/sanitize-html.js";
import { withPayload } from "#root/bot/helpers/with-payload.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

import { patchCtx } from "../helpers/menu.js";

export const composer = new Composer<Context>();

const feature = composer.filter(isAdmin);

async function sendEventsMenu(ctx: Context) {
  await ctx.reply(ctx.t("manage_events.events"), {
    link_preview_options: { is_disabled: true },
    reply_markup: manageEventsMenu,
  });
}

async function sendEventMenu(ctx: Context, eventId: number) {
  const event = await getEventWithSignupStats(eventId);
  if (event === null) return;

  await patchCtx(ctx, { match: eventId }, async (ctx) => {
    await ctx.reply(formatEventDescription(ctx, event), {
      link_preview_options: { is_disabled: true },
      reply_markup: manageEventsMenu.at("manageEventMenu"),
    });
  });
}

const manageEventsMenu = new Menu<Context>("manageEventsMenu")
  .text(
    () => i18n.t(config.DEFAULT_LOCALE, "manage_events.update"),
    updateManageEventsMenu,
  )
  .text(
    () => i18n.t(config.DEFAULT_LOCALE, "manage_events.create"),
    async (ctx) => createEvent.enter(ctx),
  )
  .row()
  .dynamic(async (_ctx, range) => {
    const events = await upcomingEventsWithSignupStats();
    for (const event of events) {
      const prefix = i18n.t(
        config.DEFAULT_LOCALE,
        "manage_events.event_title_prefix",
        {
          published: event.published ? "yes" : "no",
        },
      );
      const suffix = i18n.t(
        config.DEFAULT_LOCALE,
        event.pendingSignups === 0
          ? "manage_events.event_title_suffix"
          : "manage_events.event_title_suffix_with_pending",
        {
          participants: event.approvedSignups,
          pending: event.pendingSignups,
        },
      );

      range
        .submenu(
          {
            text: i18n.t(config.DEFAULT_LOCALE, "manage_events.event_title", {
              name: sanitizeHtmlOrEmpty(event.name),
              date: toFluentDateTime(event.date),
              prefix,
              suffix,
            }),
            payload: String(event.id),
          },
          "manageEventMenu",
          updateManageEventMenu,
        )
        .row();
    }
  });
feature.use(manageEventsMenu);
async function updateManageEventsMenu(ctx: Context) {
  await editMessageTextSafe(
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "manage_events.events"),
  );
}

const manageEventMenu = new Menu<Context>("manageEventMenu")
  .text(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "manage_events.update")),
    updateManageEventMenu,
  )
  .row()
  .dynamic(async (ctx, range) => {
    const event = await getEventFromMatch(ctx);
    if (event === undefined) return;

    range.text(
      withPayload(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_name")),
      (ctx) => editEventName.enter(ctx),
    );
    range.text(
      withPayload(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_date")),
      (ctx) => editEventDate.enter(ctx),
    );
    range.row();
    if (event.announceTextHtml === null) {
      range.text(
        withPayload(i18n.t(config.DEFAULT_LOCALE, "manage_events.add_post")),
        (ctx) => editEventPost.enter(ctx),
      );
    } else {
      range.text(
        withPayload(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_post")),
        (ctx) => editEventPost.enter(ctx),
      );
    }
    range.text(
      withPayload(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_options")),
      (ctx) => editEventOptions.enter(ctx),
    );
    range.row();
    range.text(
      withPayload(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_price")),
      (ctx) => editEventPrice.enter(ctx),
    );
    range.text(
      withPayload(
        i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_payment_details"),
      ),
      (ctx) => editEventPaymentDetails.enter(ctx),
    );
    range.row();
    range.text(
      withPayload(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_reminder")),
      (ctx) => editEventReminder.enter(ctx),
    );
    range.row();
    range.text(
      withPayload(
        i18n.t(config.DEFAULT_LOCALE, "manage_events.confirmation", {
          required: event.requireApproval ? "yes" : "no",
        }),
      ),
      switchConfirmation,
    );
    range.row();
    range.text(
      withPayload(
        i18n.t(config.DEFAULT_LOCALE, "manage_events.manage_event_price", {
          payment: event.payment,
        }),
      ),
      switchEventPayment,
    );
    range.row();

    if (event.registrationOpen) {
      range.text(
        withPayload(
          i18n.t(config.DEFAULT_LOCALE, "manage_events.registration_open", {
            registrationOpen: "yes",
          }),
        ),
      );
    } else {
      range.submenu(
        withPayload(
          i18n.t(config.DEFAULT_LOCALE, "manage_events.registration_open", {
            registrationOpen: "no",
          }),
        ),
        "openEventRegistrationMenu",
        updateOpenEventRegistrationMenu,
      );
    }
    range.row();

    if (event.published) {
      range.text(
        withPayload(
          i18n.t(config.DEFAULT_LOCALE, "manage_events.published", {
            published: "yes",
          }),
        ),
      );
    } else {
      range.submenu(
        withPayload(
          i18n.t(config.DEFAULT_LOCALE, "manage_events.published", {
            published: "no",
          }),
        ),
        "publishEventMenu",
        updatePublishEventMenu,
      );
    }
    range.row();

    range.submenu(
      withPayload(
        i18n.t(
          config.DEFAULT_LOCALE,
          event.pendingSignups === 0
            ? "manage_events.manage_participants"
            : "manage_events.manage_participants_with_pending",
          {
            participants: event.approvedSignups,
            pending: event.pendingSignups,
          },
        ),
      ),
      "manageEventParticipantsMenu",
      updateManageEventParticipantsMenu,
    );
    range.row();

    range.submenu(
      withPayload(i18n.t(config.DEFAULT_LOCALE, "manage_events.delete")),
      "deleteEventMenu",
      updateDeleteEventMenu,
    );
    range.row();
  })
  .back(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "manage_events.back")),
    updateManageEventsMenu,
  );
manageEventsMenu.register(manageEventMenu);
async function updateManageEventMenu(ctx: Context) {
  const event = await getEventFromMatch(ctx);
  if (event === undefined) return;
  await editMessageTextSafe(ctx, formatEventDescription(ctx, event), {
    link_preview_options: { is_disabled: true },
  });
}
function formatEventDescription(ctx: Context, event: Event) {
  let eventDescription = i18n.t(config.DEFAULT_LOCALE, "manage_events.event", {
    id: String(event.id),
    botUsername: ctx.me.username,
    name: sanitizeHtmlOrEmpty(event.name),
    date: toFluentDateTime(event.date),
    options: (event.participationOptions ?? [undefined])
      .map(sanitizeHtmlOrEmpty)
      .join("; "),
    payment: event.payment,
    price: sanitizeHtmlOrEmpty(event.price),
    iban: sanitizeHtmlOrEmpty(event.iban ?? config.PAYMENT_IBAN),
    recipient: sanitizeHtmlOrEmpty(event.recipient ?? config.PAYMENT_RECIPIENT),
  });

  if (event.announceTextHtml !== null) {
    eventDescription += `\n\n${i18n.t(
      config.DEFAULT_LOCALE,
      "manage_events.eventText",
    )}\n\n<blockquote expandable>${event.announceTextHtml}</blockquote>`;
  }
  if (event.reminderTextHtml !== null) {
    eventDescription += `\n\n${i18n.t(
      config.DEFAULT_LOCALE,
      "manage_events.eventReminder",
    )}\n\n<blockquote expandable>${event.reminderTextHtml}</blockquote>`;
  }

  return eventDescription;
}

const openEventRegistrationMenu = new Menu<Context>("openEventRegistrationMenu")
  .back(
    withPayload(() =>
      i18n.t(config.DEFAULT_LOCALE, "manage_events.open_registration_no"),
    ),
    updateManageEventMenu,
  )
  .text(
    withPayload(() =>
      i18n.t(config.DEFAULT_LOCALE, "manage_events.open_registration_yes"),
    ),
    openRegistration,
  );
manageEventMenu.register(openEventRegistrationMenu);
async function updateOpenEventRegistrationMenu(ctx: Context) {
  await editMessageTextSafe(
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "manage_events.open_registration_confirm"),
  );
}

const publishEventMenu = new Menu<Context>("publishEventMenu")
  .back(
    withPayload(() =>
      i18n.t(config.DEFAULT_LOCALE, "manage_events.publish_no"),
    ),
    updateManageEventMenu,
  )
  .back(
    withPayload(() =>
      i18n.t(config.DEFAULT_LOCALE, "manage_events.publish_yes"),
    ),
    publishEvent,
  );
manageEventMenu.register(publishEventMenu);
async function updatePublishEventMenu(ctx: Context) {
  await editMessageTextSafe(
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "manage_events.publish_confirm"),
  );
}

const deleteEventMenu = new Menu<Context>("deleteEventMenu")
  .back(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "manage_events.delete_no")),
    updateManageEventMenu,
  )
  .text(
    withPayload(() =>
      i18n.t(config.DEFAULT_LOCALE, "manage_events.delete_yes"),
    ),
    deleteEvent,
  );
manageEventMenu.register(deleteEventMenu);
async function updateDeleteEventMenu(ctx: Context) {
  await editMessageTextSafe(
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "manage_events.delete_confirm"),
  );
}

const manageEventParticipantsMenu = new Menu<Context>(
  "manageEventParticipantsMenu",
)
  .back(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "manage_events.back")),
    updateManageEventMenu,
  )
  .text(
    withPayload((ctx) => ctx.t("manage_events.update")),
    updateManageEventParticipantsMenu,
  );
manageEventMenu.register(manageEventParticipantsMenu);
async function updateManageEventParticipantsMenu(ctx: Context) {
  const event = await getEventFromMatch(ctx);
  if (event === undefined) return;

  const participants = (await getEventSignups(event.id))
    .map((signup) => {
      let options = (signup.participationOptions ?? [])
        .map(
          (option) =>
            /^(?<emoji>\p{Emoji})/gu.exec(option)?.groups?.emoji ?? option,
        )
        .join("");
      if (signup.participationConfirmed) {
        options += "👌";
      }
      if (options.length > 0) {
        options = `, ${options}`;
      }

      return ctx.t("manage_events.event_participant_with_status", {
        status: signup.status,
        event_participant: signup.user.username
          ? ctx.t("manage_events.event_participant", {
              id: String(signup.user.id),
              name: sanitizeHtmlOrEmpty(signup.user.name),
              pronouns: sanitizeHtmlOrEmpty(signup.user.pronouns),
              username: sanitizeHtml(signup.user.username),
              options,
            })
          : ctx.t("manage_events.event_participant_no_username", {
              id: String(signup.user.id),
              name: sanitizeHtmlOrEmpty(signup.user.name),
              pronouns: sanitizeHtmlOrEmpty(signup.user.pronouns),
              options,
            }),
      });
    })
    .join("\n");

  await editMessageTextSafe(
    ctx,
    ctx.t(
      participants.length > 0
        ? "manage_events.event_participants"
        : "manage_events.event_participants_empty",
      {
        name: sanitizeHtmlOrEmpty(event.name),
        date: toFluentDateTime(event.date),
        participants,
      },
    ),
  );
}

async function getEventFromMatch(ctx: Context) {
  const eventId = Number(ctx.match);
  if (!Number.isFinite(eventId)) {
    ctx.logger.error("Can't get event id form match", { match: ctx.match });
    return;
  }
  const event = await getEventWithSignupStats(eventId);
  if (event === null) {
    ctx.logger.error("Can't get event id form match", { match: ctx.match });
    return;
  }
  return event;
}

async function getEventForEditFromMatch(ctx: Context) {
  const event = await getEventFromMatch(ctx);
  if (event === undefined) return;

  if (moment.utc(event.date).isBefore(moment.now())) {
    await ctx.reply(
      i18n.translate(config.DEFAULT_LOCALE, "manage_events.event_in_past"),
    );
    return;
  }

  return event;
}

feature
  .chatType("private")
  .command("manage_events", logHandle("manage_events"), sendEventsMenu);

registerCommandHelp({
  command: "manage_events",
  scope: CommandScope.PrivateChat,
  privileges: CommandPrivileges.Admins,
});

const editEventName = conversation("editEventName")
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return FINISH;
    await prompt(ctx, ctx.t("manage_events.enter_name"));
    return { eventId: event.id };
  })
  .waitForTextOrCmd(
    "message:text",
    ["cancel"],
    async ({ ctx, command }, { eventId }) => {
      if (command !== "cancel") {
        await updateEvent(eventId, { name: ctx.message.text });
      }
      await sendEventMenu(ctx, eventId);
    },
  )
  .build();
feature.use(editEventName);

const editEventDate = conversation("editEventDate")
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return FINISH;
    await prompt(ctx, ctx.t("manage_events.enter_date"));
    return { eventId: event.id };
  })
  .waitForTextOrCmd(
    "message:text",
    ["cancel"],
    async ({ ctx, command }, { eventId }) => {
      if (command !== "cancel") {
        const date = moment.tz(
          ctx.message.text,
          "YYYY-MM-DD HH:mm",
          true,
          config.TIMEZONE,
        );

        if (!date.isValid()) {
          await ctx.reply(ctx.t("manage_events.date_invalid"), {
            reply_to_message_id: ctx.message.message_id,
          });
          return REPEAT;
        }

        if (date.isBefore(moment.now())) {
          await ctx.reply(ctx.t("manage_events.date_in_past"), {
            reply_to_message_id: ctx.message.message_id,
          });
          return REPEAT;
        }

        await updateEvent(eventId, { date: date.toDate() });
      }
      await sendEventMenu(ctx, eventId);
    },
  )
  .build();
feature.use(editEventDate);

const editEventPost = conversation("editEventPost")
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return FINISH;
    await prompt(ctx, ctx.t("manage_events.enter_post"));
    return { eventId: event.id };
  })
  .waitForTextOrCmd(
    "message:text",
    ["cancel"],
    async ({ ctx, command }, { eventId }) => {
      if (command !== "cancel") {
        await editEventPostFromCtx(ctx, eventId);
      }
      await sendEventMenu(ctx, eventId);
    },
  )
  .build();
feature.use(editEventPost);

const editEventPrice = conversation("editEventPrice")
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return FINISH;
    await prompt(ctx, ctx.t("manage_events.enter_price"));
    return { eventId: event.id };
  })
  .waitForTextOrCmd(
    "message:text",
    ["cancel", "empty"],
    async ({ ctx, command }, { eventId }) => {
      if (command !== "cancel") {
        if (command === "empty") {
          await updateEvent(eventId, { price: null });
        } else {
          await updateEvent(eventId, { price: ctx.message.text });
        }
      }
      await sendEventMenu(ctx, eventId);
    },
  )
  .build();
feature.use(editEventPrice);

const editEventPaymentDetails = conversation("editEventPaymentDetails")
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return FINISH;
    await prompt(ctx, ctx.t("manage_events.enter_iban"));
    return { eventId: event.id };
  })
  .waitForTextOrCmd(
    "message:text",
    ["cancel", "empty"],
    async ({ ctx, command }, { eventId }) => {
      if (command === "cancel") {
        await sendEventMenu(ctx, eventId);
        return FINISH;
      } else if (command === "empty") {
        return { eventId, iban: null };
      } else {
        return { eventId, iban: ctx.message.text };
      }
    },
  )
  .proceed(async (ctx, { eventId, iban }) => {
    await ctx.reply(ctx.t("manage_events.enter_recipient"));
    return { eventId, iban };
  })
  .waitForTextOrCmd(
    "message:text",
    ["cancel", "empty"],
    async ({ ctx, command }, { eventId, iban }) => {
      if (command === "cancel") {
        await sendEventMenu(ctx, eventId);
        return FINISH;
      } else if (command === "empty") {
        return { eventId, iban, recipient: null };
      } else {
        return { eventId, iban, recipient: ctx.message.text };
      }
    },
  )
  .proceed(async (ctx, { eventId, iban, recipient }) => {
    await updateEvent(eventId, { iban, recipient });
    await sendEventMenu(ctx, eventId);
  })
  .build();
feature.use(editEventPaymentDetails);

const editEventOptions = conversation("editEventOptions")
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return FINISH;
    await prompt(ctx, ctx.t("manage_events.enter_options"));
    return { eventId: event.id };
  })
  .waitForTextOrCmd(
    "message:text",
    ["cancel", "empty"],
    async ({ ctx, command }, { eventId }) => {
      if (command !== "cancel") {
        if (command === "empty") {
          await updateEvent(eventId, { participationOptions: null });
        } else {
          await updateEvent(eventId, {
            participationOptions: ctx.message.text.split("\n").filter((x) => x),
          });
        }
      }
      await sendEventMenu(ctx, eventId);
    },
  )
  .build();
feature.use(editEventOptions);

const editEventReminder = conversation("editEventReminder")
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return FINISH;
    await prompt(ctx, ctx.t("manage_events.enter_reminder"));
    return { eventId: event.id };
  })
  .waitForTextOrCmd(
    "message:text",
    ["cancel", "empty"],
    async ({ ctx, command }, { eventId }) => {
      if (command === "empty") {
        await updateEvent(eventId, { reminderTextHtml: null });
      } else {
        await updateEvent(eventId, {
          reminderTextHtml: parseTelegramEntities(
            ctx.msg.text ?? ctx.msg.caption ?? "",
            ctx.msg.entities ?? ctx.msg.caption_entities ?? [],
          ),
        });
      }
      await sendEventMenu(ctx, eventId);
    },
  )
  .build();
feature.use(editEventReminder);

async function editEventPostFromCtx(
  ctx: Filter<Context, "message"> | Filter<Context, "edited_message">,
  eventId: number,
) {
  const event = await getEventWithSignupStats(eventId);
  if (event === null) return;

  const announceText = ctx.msg.text ?? ctx.msg.caption ?? "";
  const announceEntities = ctx.msg.entities ?? ctx.msg.caption_entities ?? [];
  const announceTextHtml = parseTelegramEntities(
    announceText,
    announceEntities,
  );
  let announcePhotoId: string | null = null;
  if (!event.published || event.announcePhotoId !== null) {
    announcePhotoId =
      ctx.msg?.photo?.reduce((a, b) => (a.width > b.width ? a : b))?.file_id ??
      event.announcePhotoId;
  }

  await updateEvent(event.id, { announceTextHtml, announcePhotoId });

  if (
    event.channelPostId !== null &&
    event.channelPostId !== ctx.msg?.message_id
  ) {
    try {
      if (announcePhotoId) {
        await ctx.api.editMessageMedia(config.CHANNEL, event.channelPostId, {
          type: "photo",
          media: announcePhotoId,
          caption: announceTextHtml,
        });
      } else {
        await ctx.api.editMessageText(
          config.CHANNEL,
          event.channelPostId,
          announceTextHtml,
          {
            link_preview_options: { is_disabled: true },
          },
        );
      }
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === 400) {
        if (error.description.includes("message is not modified")) {
          ctx.logger.debug("Ignored MESSAGE_NOT_MODIFIED error");
        } else {
          ctx.logger.warn(error);
        }
      } else {
        throw error;
      }
    }
  }
}

async function switchConfirmation(ctx: Context) {
  const event = await getEventForEditFromMatch(ctx);
  if (event !== undefined) {
    await updateEvent(event.id, { requireApproval: !event.requireApproval });
    await updateManageEventMenu(ctx);
  }
}

async function switchEventPayment(ctx: Context) {
  const event = await getEventForEditFromMatch(ctx);
  if (event !== undefined) {
    switch (event.payment) {
      case EventPayment.Required:
        await updateEvent(event.id, { payment: EventPayment.Donation });
        break;
      case EventPayment.Donation:
        await updateEvent(event.id, { payment: EventPayment.NotRequired });
        break;
      case EventPayment.NotRequired:
        await updateEvent(event.id, { payment: EventPayment.Required });
        break;
    }
    await updateManageEventMenu(ctx);
  }
}

async function openRegistration(ctx: Context) {
  const event = await getEventForEditFromMatch(ctx);
  if (event !== undefined) {
    await updateEvent(event.id, { registrationOpen: true });
    await updateManageEventMenu(ctx);
  }
}

async function publishEvent(ctx: Context) {
  const event = await getEventForEditFromMatch(ctx);
  if (event === undefined || event.published) return;

  await updateEvent(event.id, { published: true, registrationOpen: true });
  ctx.menu.back();
  await updateManageEventMenu(ctx);

  if (!event.announceTextHtml) return;

  let channelPost;
  if (event.announcePhotoId) {
    channelPost = await ctx.api.sendPhoto(
      config.CHANNEL,
      event.announcePhotoId,
      {
        caption: event.announceTextHtml,
      },
    );
  } else {
    channelPost = await ctx.api.sendMessage(
      config.CHANNEL,
      event.announceTextHtml,
      {
        link_preview_options: { is_disabled: true },
      },
    );
  }

  const chatPost = await ctx.api.forwardMessage(
    config.MEMBERS_GROUP,
    config.CHANNEL,
    channelPost.message_id,
  );

  await updateEvent(event.id, {
    channelPostId: channelPost.message_id,
    chatPostId: chatPost.message_id,
  });
}

async function deleteEvent(ctx: Context) {
  const event = await getEventForEditFromMatch(ctx);
  if (event === undefined) return;

  if (event.chatPostId !== null) {
    await deleteMessageSafe(ctx, config.MEMBERS_GROUP, event.chatPostId);
  }

  if (event.channelPostId !== null) {
    await deleteMessageSafe(ctx, config.CHANNEL, event.channelPostId);
  }

  await deleteDbEvent(event.id);
  ctx.menu.nav("manageEventsMenu");
  await updateManageEventsMenu(ctx);
}

const createEvent = conversation("createEvent")
  .proceed(async (ctx) => {
    await prompt(ctx, ctx.t("manage_events.enter_name"));
  })
  .waitForTextOrCmd("message:text", ["cancel"], async ({ ctx, command }) => {
    if (command === "cancel") {
      await sendEventsMenu(ctx);
      return FINISH;
    }
    return { name: ctx.message.text };
  })
  .proceed(async (ctx, { name }) => {
    await ctx.reply(ctx.t("manage_events.enter_date"));
    return { name };
  })
  .waitForTextOrCmd(
    "message:text",
    ["cancel"],
    async ({ ctx, command }, { name }) => {
      if (command === "cancel") {
        await sendEventsMenu(ctx);
        return FINISH;
      }

      const date = moment.tz(
        ctx.message.text,
        "YYYY-MM-DD HH:mm",
        true,
        config.TIMEZONE,
      );

      if (!date.isValid()) {
        await ctx.reply(ctx.t("manage_events.date_invalid"), {
          reply_to_message_id: ctx.message.message_id,
        });
        return REPEAT;
      }

      if (date.isBefore(moment.now())) {
        await ctx.reply(ctx.t("manage_events.date_in_past"), {
          reply_to_message_id: ctx.message.message_id,
        });
        return REPEAT;
      }

      return { name, date: date.toDate() };
    },
  )
  .proceed(async (ctx, { name, date }) => {
    const event = await createDbEvent(name, date);
    await sendEventMenu(ctx, event.id);
  })
  .build();
feature.use(createEvent);
