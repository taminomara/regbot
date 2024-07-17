import { Menu } from "@grammyjs/menu";
import { createCallbackData } from "callback-data";
import { Composer, Filter, GrammyError, InlineKeyboard } from "grammy";
import moment from "moment-timezone";

import { EventPayment, SignupStatus } from "#root/backend/entities/event.js";
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
import { copyMessageTo } from "#root/bot/features/edit-cache.js";
import {
  CommandPrivileges,
  CommandScope,
  registerCommandHelp,
} from "#root/bot/features/help.js";
import { isAdmin } from "#root/bot/filters/index.js";
import {
  conversation,
  finishConversation,
  repeatConversationStep,
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
          published: event.published
            ? "yes"
            : event.registrationOpen
              ? "no"
              : "hidden",
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
      range.submenu(
        withPayload(
          i18n.t(config.DEFAULT_LOCALE, "manage_events.registration_open", {
            registrationOpen: "yes",
          }),
        ),
        "closeEventRegistrationMenu",
        updateCloseEventRegistrationMenu,
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
  .back(
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

const closeEventRegistrationMenu = new Menu<Context>("closeEventRegistrationMenu")
  .back(
    withPayload(() =>
      i18n.t(config.DEFAULT_LOCALE, "manage_events.close_registration_no"),
    ),
    updateManageEventMenu,
  )
  .back(
    withPayload(() =>
      i18n.t(config.DEFAULT_LOCALE, "manage_events.close_registration_yes"),
    ),
    closeRegistration,
  );
manageEventMenu.register(closeEventRegistrationMenu);
async function updateCloseEventRegistrationMenu(ctx: Context) {
  await editMessageTextSafe(
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "manage_events.close_registration_confirm"),
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
  .text(
    withPayload((ctx) => ctx.t("manage_events.update")),
    updateManageEventParticipantsMenu,
  )
  .row()
  .text(
    withPayload(() =>
      i18n.t(config.DEFAULT_LOCALE, "manage_events.message_participants"),
    ),
    async (ctx) => messageEventParticipants.enter(ctx),
  )
  .row()
  .back(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "manage_events.back")),
    updateManageEventMenu,
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

const editEventName = conversation<Context>("editEventName")
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return finishConversation();
    await ctx.reply(ctx.t("manage_events.enter_name"));
    return { eventId: event.id };
  })
  .either()
  .waitCommand("cancel", async (ctx, { eventId }) => {
    return { eventId };
  })
  .waitFilterQuery("message:text", async (ctx, { eventId }) => {
    await updateEvent(eventId, { name: ctx.message.text });
    return { eventId };
  })
  .done()
  .proceed(async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
  })
  .build();
feature.use(editEventName);

const editEventDate = conversation<Context>("editEventDate")
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return finishConversation();
    await ctx.reply(ctx.t("manage_events.enter_date"));
    return { eventId: event.id };
  })
  .either()
  .waitCommand("cancel", async (ctx, { eventId }) => {
    return { eventId };
  })
  .waitFilterQuery("message:text", async (ctx, { eventId }) => {
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
      return repeatConversationStep({ eventId });
    }

    if (date.isBefore(moment.now())) {
      await ctx.reply(ctx.t("manage_events.date_in_past"), {
        reply_to_message_id: ctx.message.message_id,
      });
      return repeatConversationStep({ eventId });
    }

    await updateEvent(eventId, { date: date.toDate() });
    return { eventId };
  })
  .done()
  .proceed(async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
  })
  .build();
feature.use(editEventDate);

const editEventPost = conversation<Context>("editEventPost")
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return finishConversation();
    await ctx.reply(ctx.t("manage_events.enter_post"));
    return { eventId: event.id };
  })
  .either()
  .waitCommand("cancel", async (ctx, { eventId }) => {
    return { eventId };
  })
  .waitFilterQuery("message:text", async (ctx, { eventId }) => {
    await editEventPostFromCtx(ctx, eventId);
    return { eventId };
  })
  .done()
  .proceed(async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
  })
  .build();
feature.use(editEventPost);

const editEventPrice = conversation<Context>("editEventPrice")
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return finishConversation();
    await ctx.reply(ctx.t("manage_events.enter_price"));
    return { eventId: event.id };
  })
  .either()
  .waitCommand("cancel", async (ctx, { eventId }) => {
    return { eventId };
  })
  .waitCommand("empty", async (ctx, { eventId }) => {
    await updateEvent(eventId, { price: null });
    return { eventId };
  })
  .waitFilterQuery("message:text", async (ctx, { eventId }) => {
    await updateEvent(eventId, { price: ctx.message.text });
    return { eventId };
  })
  .done()
  .proceed(async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
  })
  .build();
feature.use(editEventPrice);

const editEventPaymentDetails = conversation<Context>("editEventPaymentDetails")
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return finishConversation();
    await ctx.reply(ctx.t("manage_events.enter_iban"));
    return { eventId: event.id };
  })
  .either()
  .waitCommand("cancel", async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
    return finishConversation();
  })
  .waitCommand("empty", async (ctx, { eventId }) => {
    return { eventId, iban: null };
  })
  .waitFilterQuery("message:text", async (ctx, { eventId }) => {
    return { eventId, iban: ctx.message.text };
  })
  .done()
  .proceed(async (ctx, { eventId, iban }) => {
    await ctx.reply(ctx.t("manage_events.enter_recipient"));
    return { eventId, iban };
  })
  .either()
  .waitCommand("cancel", async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
    return finishConversation();
  })
  .waitCommand("empty", async (ctx, { eventId, iban }) => {
    return { eventId, iban, recipient: null };
  })
  .waitFilterQuery("message:text", async (ctx, { eventId, iban }) => {
    return { eventId, iban, recipient: ctx.message.text };
  })
  .done()
  .proceed(async (ctx, { eventId, iban, recipient }) => {
    await updateEvent(eventId, { iban, recipient });
    await sendEventMenu(ctx, eventId);
  })
  .build();
feature.use(editEventPaymentDetails);

const editEventOptions = conversation<Context>("editEventOptions")
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return finishConversation();
    await ctx.reply(ctx.t("manage_events.enter_options"));
    return { eventId: event.id };
  })
  .either()
  .waitCommand("cancel", async (ctx, { eventId }) => {
    return { eventId };
  })
  .waitCommand("empty", async (ctx, { eventId }) => {
    await updateEvent(eventId, { participationOptions: null });
    return { eventId };
  })
  .waitFilterQuery("message:text", async (ctx, { eventId }) => {
    await updateEvent(eventId, {
      participationOptions: ctx.message.text.split("\n").filter((x) => x),
    });
    return { eventId };
  })
  .done()
  .proceed(async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
  })
  .build();
feature.use(editEventOptions);

const editEventReminder = conversation<Context>("editEventReminder")
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return finishConversation();
    await ctx.reply(ctx.t("manage_events.enter_reminder"));
    return { eventId: event.id };
  })
  .either()
  .waitCommand("cancel", async (ctx, { eventId }) => {
    return { eventId };
  })
  .waitCommand("empty", async (ctx, { eventId }) => {
    await updateEvent(eventId, { reminderTextHtml: null });
    return { eventId };
  })
  .waitFilterQuery("message:text", async (ctx, { eventId }) => {
    await updateEvent(eventId, {
      reminderTextHtml: parseTelegramEntities(
        ctx.msg.text ?? ctx.msg.caption ?? "",
        ctx.msg.entities ?? ctx.msg.caption_entities ?? [],
      ),
    });
    return { eventId };
  })
  .done()
  .proceed(async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
  })
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

async function closeRegistration(ctx: Context) {
  const event = await getEventForEditFromMatch(ctx);
  if (event !== undefined) {
    await updateEvent(event.id, { registrationOpen: false });
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

const createEvent = conversation<Context>("createEvent")
  .proceed(async (ctx) => {
    await ctx.reply(ctx.t("manage_events.enter_name"));
  })
  .either()
  .waitCommand("cancel", async (ctx) => {
    await sendEventsMenu(ctx);
    return finishConversation();
  })
  .waitFilterQuery("message:text", async (ctx) => {
    return { name: ctx.message.text };
  })
  .done()
  .proceed(async (ctx, { name }) => {
    await ctx.reply(ctx.t("manage_events.enter_date"));
    return { name };
  })
  .either()
  .waitCommand("cancel", async (ctx) => {
    await sendEventsMenu(ctx);
    return finishConversation();
  })
  .waitFilterQuery("message:text", async (ctx, { name }) => {
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
      return repeatConversationStep({ name });
    }

    if (date.isBefore(moment.now())) {
      await ctx.reply(ctx.t("manage_events.date_in_past"), {
        reply_to_message_id: ctx.message.message_id,
      });
      return repeatConversationStep({ name });
    }

    return { name, date: date.toDate() };
  })
  .done()
  .proceed(async (ctx, { name, date }) => {
    const event = await createDbEvent(name, date);
    await sendEventMenu(ctx, event.id);
  })
  .build();
feature.use(createEvent);

const messageEventParticipantsData = createCallbackData(
  "messageEventParticipants",
  {
    includeApproved: Boolean,
    includePending: Boolean,
    includeRejected: Boolean,
  },
);
function makeMessageEventParticipantsKeyboard(
  ctx: Context,
  data: {
    includeApproved: boolean;
    includePending: boolean;
    includeRejected: boolean;
  },
) {
  return new InlineKeyboard()
    .text(
      (data.includeApproved ? "☑️ " : "➖ ") +
        ctx.t("manage_events.include_approved_participants"),
      messageEventParticipantsData.pack({
        ...data,
        includeApproved: !data.includeApproved,
      }),
    )
    .row()
    .text(
      (data.includePending ? "☑️ " : "➖ ") +
        ctx.t("manage_events.include_pending_participants"),
      messageEventParticipantsData.pack({
        ...data,
        includePending: !data.includePending,
      }),
    )
    .row()
    .text(
      (data.includeRejected ? "☑️ " : "➖ ") +
        ctx.t("manage_events.include_rejected_participants"),
      messageEventParticipantsData.pack({
        ...data,
        includeRejected: !data.includeRejected,
      }),
    );
}
const messageEventParticipants = conversation<Context>(
  "messageEventParticipants",
)
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return finishConversation();
    const params = {
      includeApproved: true,
      includePending: false,
      includeRejected: false,
    };

    await ctx.reply(
      ctx.t("manage_events.enter_message_for_event_participants"),
      { reply_markup: makeMessageEventParticipantsKeyboard(ctx, params) },
    );

    return { eventId: event.id, ...params };
  })
  .either()
  .waitCommand("cancel", async (ctx, { eventId }) => {
    return { eventId };
  })
  .waitCallbackQuery(
    messageEventParticipantsData.filter(),
    async (ctx, { eventId }) => {
      const params = messageEventParticipantsData.unpack(
        ctx.callbackQuery.data,
      );
      await ctx.editMessageReplyMarkup({
        reply_markup: makeMessageEventParticipantsKeyboard(ctx, params),
      });
      return repeatConversationStep({ eventId, ...params });
    },
  )
  .waitFilterQuery(
    "message:text",
    async (
      ctx,
      { eventId, includeApproved, includePending, includeRejected },
    ) => {
      ctx.logger.info({ includeApproved, includePending, includeRejected });
      const signups = await getEventSignups(eventId);
      const promises = signups
        .filter((signup) => {
          switch (signup.status) {
            case SignupStatus.Approved:
              return includeApproved;
            case SignupStatus.Rejected:
              return includeRejected;
            case SignupStatus.PendingApproval:
            case SignupStatus.PendingPayment:
              return includePending;
          }
          return false;
        })
        .map(async (signup) => copyMessageTo(ctx, signup.user.id));
      await Promise.all(promises);
      return { eventId };
    },
  )
  .done()
  .proceed(async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
  })
  .build();
feature.use(messageEventParticipants);
