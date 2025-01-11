import { Menu } from "@grammyjs/menu";
import { createCallbackData } from "callback-data";
import { Composer, Filter, GrammyError, InlineKeyboard } from "grammy";
import moment from "moment-timezone";

import { EventPayment, SignupStatus } from "#root/backend/entities/event.js";
import {
  Event,
  createEvent as createDbEvent,
  deleteEvent as deleteDbEvent,
  getEvent,
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
  getConversationId,
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
  textLength,
} from "#root/bot/helpers/sanitize-html.js";
import { withPayload } from "#root/bot/helpers/with-payload.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

import { DEFAULT_EVENT_TEXT, formatEventText } from "../helpers/event.js";
import { messageLink, signupLink, userLink } from "../helpers/links.js";
import { patchCtx } from "../helpers/menu.js";
import { makeSignupReminderKeyboard } from "./event-reminders.js";

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
    (ctx) => ctx.t("manage_events.update"),
    logHandle("menu:manageEventsMenu:update"),
    updateManageEventsMenu,
  )
  .text(
    (ctx) => ctx.t("manage_events.create"),
    logHandle("menu:manageEventsMenu:create"),
    async (ctx) => createEvent.enter(ctx),
  )
  .row()
  .dynamic(async (ctx, range) => {
    const events = await upcomingEventsWithSignupStats();
    for (const event of events) {
      const prefix = ctx.t("manage_events.event_title_prefix", {
        published: event.cancelled
          ? "cancelled"
          : event.published
            ? "yes"
            : "no",
      });
      const suffix = ctx.t(
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
            text: ctx.t("manage_events.event_title", {
              name: sanitizeHtmlOrEmpty(event.name),
              date: toFluentDateTime(event.date),
              prefix,
              suffix,
            }),
            payload: String(event.id),
          },
          "manageEventMenu",
          logHandle("menu:manageEventsMenu:manage-event"),
          updateManageEventMenu,
        )
        .row();
    }
  });
feature.use(manageEventsMenu);
async function updateManageEventsMenu(ctx: Context) {
  await editMessageTextSafe(ctx, ctx.t("manage_events.events"));
}

const manageEventMenu = new Menu<Context>("manageEventMenu")
  .text(
    withPayload((ctx) => ctx.t("manage_events.update")),
    logHandle("menu:manageEventMenu:update"),
    updateManageEventMenu,
  )
  .row()
  .dynamic(async (ctx, range) => {
    const event = await getEventFromMatch(ctx); // allow editing closed and past events
    if (event === undefined) return;

    if (!event.cancelled && !moment.utc(event.date).isBefore(moment.now())) {
      range.text(
        withPayload(ctx.t("manage_events.edit_name")),
        logHandle("menu:manageEventMenu:edit-name"),
        (ctx) => editEventName.enter(ctx),
      );
      range.text(
        withPayload(ctx.t("manage_events.edit_date")),
        logHandle("menu:manageEventMenu:edit-date"),
        (ctx) => editEventDate.enter(ctx),
      );
      range.row();
      range.text(
        withPayload(ctx.t("manage_events.edit_post")),
        logHandle("menu:manageEventMenu:edit-post"),
        (ctx) => editEventPost.enter(ctx),
      );
      range.text(
        withPayload(ctx.t("manage_events.edit_options")),
        logHandle("menu:manageEventMenu:edit-options"),
        (ctx) => editEventOptions.enter(ctx),
      );
      range.row();
      range.text(
        withPayload(ctx.t("manage_events.edit_price")),
        logHandle("menu:manageEventMenu:edit-price"),
        (ctx) => editEventPrice.enter(ctx),
      );
      range.text(
        withPayload(ctx.t("manage_events.edit_payment_details")),
        logHandle("menu:manageEventMenu:edit-payment-details"),
        (ctx) => editEventPaymentDetails.enter(ctx),
      );
      range.row();
      range.text(
        withPayload(ctx.t("manage_events.edit_reminder")),
        logHandle("menu:manageEventMenu:edit-reminder"),
        (ctx) => editEventReminder.enter(ctx),
      );
      range.row();
      range.text(
        withPayload(
          ctx.t("manage_events.confirmation", {
            required: event.requireApproval ? "yes" : "no",
          }),
        ),
        logHandle("menu:manageEventMenu:switch-confirmation"),
        switchConfirmation,
      );
      range.row();
      range.text(
        withPayload(
          ctx.t("manage_events.manage_event_price", {
            payment: event.payment,
          }),
        ),
        logHandle("menu:manageEventMenu:switch-event-payment"),
        switchEventPayment,
      );
    } else {
      range.text(
        withPayload(ctx.t("manage_events.edit_name")),
        logHandle("menu:manageEventMenu:edit-name"),
        (ctx) => editEventName.enter(ctx),
      );
      range.text(
        withPayload(ctx.t("manage_events.edit_post")),
        logHandle("menu:manageEventMenu:edit-post"),
        (ctx) => editEventPost.enter(ctx),
      );
    }
    range.row();

    if (event.visibleInMenu) {
      range.submenu(
        withPayload(
          ctx.t("manage_events.visible_in_menu", {
            visibleInMenu: "yes",
          }),
        ),
        "makeInvisibleMenu",
        logHandle("menu:manageEventMenu:close-registration"),
        updateMakeInvisibleMenu,
      );
    } else {
      range.submenu(
        withPayload(
          ctx.t("manage_events.visible_in_menu", {
            visibleInMenu: "no",
          }),
        ),
        "makeVisibleMenu",
        logHandle("menu:manageEventMenu:open-registration"),
        updateMakeVisibleMenu,
      );
    }
    range.row();

    if (event.registrationOpen) {
      range.submenu(
        withPayload(
          ctx.t("manage_events.registration_open", {
            registrationOpen: "yes",
          }),
        ),
        "closeEventRegistrationMenu",
        logHandle("menu:manageEventMenu:close-registration"),
        updateCloseEventRegistrationMenu,
      );
    } else if (event.cancelled) {
      range.text(
        withPayload(
          ctx.t("manage_events.registration_open", {
            registrationOpen: "no_permanent",
          }),
        ),
        logHandle("menu:manageEventMenu:open-registration-on-cancelled-event"),
      );
    } else {
      range.submenu(
        withPayload(
          ctx.t("manage_events.registration_open", {
            registrationOpen: "no",
          }),
        ),
        "openEventRegistrationMenu",
        logHandle("menu:manageEventMenu:open-registration"),
        updateOpenEventRegistrationMenu,
      );
    }
    range.row();

    if (event.channelPostId !== null) {
      range.text(
        withPayload(
          ctx.t("manage_events.published", {
            published: "yes",
          }),
        ),
        logHandle("menu:manageEventMenu:unpublish"),
      );
    } else if (event.cancelled) {
      range.text(
        withPayload(
          ctx.t("manage_events.published", {
            published: "no_permanent",
          }),
        ),
        logHandle("menu:manageEventMenu:publish-on-cancelled-event"),
      );
    } else {
      range.submenu(
        withPayload(
          ctx.t("manage_events.published", {
            published: "no",
          }),
        ),
        "publishEventMenu",
        logHandle("menu:manageEventMenu:publish"),
        updatePublishEventMenu,
      );
    }
    range.row();

    range.submenu(
      withPayload(
        ctx.t(
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
      logHandle("menu:manageEventMenu:manage-participants"),
      updateManageEventParticipantsMenu,
    );
    range.row();

    if (event.published && !event.cancelled) {
      range.submenu(
        withPayload(ctx.t("manage_events.cancel")),
        "cancelEventMenu",
        logHandle("menu:manageEventMenu:cancel-event"),
        updateCancelEventMenu,
      );
    } else if (event.published && event.cancelled) {
      range.text(
        withPayload(ctx.t("manage_events.cancelled")),
        logHandle("menu:manageEventMenu:cancelled"),
      );
    } else {
      range.submenu(
        withPayload(ctx.t("manage_events.delete")),
        "deleteEventMenu",
        logHandle("menu:manageEventMenu:delete-event"),
        updateDeleteEventMenu,
      );
    }
    range.row();
  })
  .back(
    withPayload((ctx) => ctx.t("manage_events.back")),
    logHandle("menu:manageEventMenu:back"),
    updateManageEventsMenu,
  );
manageEventsMenu.register(manageEventMenu);
async function updateManageEventMenu(ctx: Context) {
  const event = await getEventFromMatch(ctx); // allow editing closed and past events
  if (event === undefined) return;
  await editMessageTextSafe(ctx, formatEventDescription(ctx, event), {
    link_preview_options: { is_disabled: true },
  });
}
function formatEventDescription(ctx: Context, event: Event) {
  const optionsList = (event.participationOptions ?? [undefined]).map(
    sanitizeHtmlOrEmpty,
  );
  let optionsLength = 0;
  for (let i = 0; i < optionsList.length; i += 1) {
    optionsLength += textLength(optionsList[i]);
    if (optionsLength > 150) {
      optionsList.splice(0, i + 1);
      optionsList.push("...");
    }
  }

  let eventDescription = ctx.t("manage_events.event", {
    id: String(event.id),
    botUsername: ctx.me.username,
    name: sanitizeHtmlOrEmpty(event.name),
    date: toFluentDateTime(event.date),
    options: optionsList.join("; "),
    payment: event.payment,
    price: sanitizeHtmlOrEmpty(event.price),
    iban: sanitizeHtmlOrEmpty(event.iban ?? config.PAYMENT_IBAN),
    recipient: sanitizeHtmlOrEmpty(event.recipient ?? config.PAYMENT_RECIPIENT),
    status: event.cancelled
      ? "cancelled"
      : event.dateChanged
        ? "date_changed"
        : event.published
          ? "published"
          : "draft",
  });

  if (event.announceTextHtml === null) {
    return eventDescription;
  }

  const announceTextHtml = formatEventText(ctx, event);
  const eventDescriptionWithPost = `${eventDescription}\n\n<b>${ctx.t(
    "manage_events.event_text",
  )}</b>\n\n<blockquote expandable>${announceTextHtml}</blockquote>`;
  if (textLength(eventDescriptionWithPost) < 3500) {
    eventDescription = eventDescriptionWithPost;
  } else {
    eventDescription += `\n\n<b>${ctx.t(
      "manage_events.event_text",
    )}</b>\n\n<blockquote>${ctx.t("manage_events.too_long_to_display")}</blockquote>`;
  }

  if (event.reminderTextHtml === null) {
    return eventDescription;
  }

  const eventDescriptionWithReminder = `${eventDescription}\n\n<b>${ctx.t(
    "manage_events.event_reminder",
  )}</b>\n\n<blockquote expandable>${event.reminderTextHtml}</blockquote>`;
  if (textLength(eventDescriptionWithReminder) < 3500) {
    eventDescription = eventDescriptionWithReminder;
  } else {
    eventDescription += `\n\n<b>${ctx.t(
      "manage_events.event_reminder",
    )}</b>\n\n<blockquote>${ctx.t("manage_events.too_long_to_display")}</blockquote>`;
  }

  return eventDescription;
}

const makeVisibleMenu = new Menu<Context>("makeVisibleMenu")
  .back(
    withPayload((ctx) => ctx.t("manage_events.make_visible_no")),
    logHandle("menu:makeVisibleMenu:back"),
    updateManageEventMenu,
  )
  .back(
    withPayload((ctx) => ctx.t("manage_events.make_visible_yes")),
    logHandle("menu:makeVisibleMenu:open-registration"),
    makeVisible,
  );
manageEventMenu.register(makeVisibleMenu);
async function updateMakeVisibleMenu(ctx: Context) {
  await editMessageTextSafe(ctx, ctx.t("manage_events.make_visible_confirm"));
}

const makeInvisibleMenu = new Menu<Context>("makeInvisibleMenu")
  .back(
    withPayload((ctx) => ctx.t("manage_events.make_invisible_no")),
    logHandle("menu:makeInvisibleMenu:back"),
    updateManageEventMenu,
  )
  .back(
    withPayload((ctx) => ctx.t("manage_events.make_invisible_yes")),
    logHandle("menu:makeInvisibleMenu:close-registration"),
    makeInvisible,
  );
manageEventMenu.register(makeInvisibleMenu);
async function updateMakeInvisibleMenu(ctx: Context) {
  await editMessageTextSafe(ctx, ctx.t("manage_events.make_invisible_confirm"));
}

const openEventRegistrationMenu = new Menu<Context>("openEventRegistrationMenu")
  .back(
    withPayload((ctx) => ctx.t("manage_events.open_registration_no")),
    logHandle("menu:openEventRegistrationMenu:back"),
    updateManageEventMenu,
  )
  .back(
    withPayload((ctx) => ctx.t("manage_events.open_registration_yes")),
    logHandle("menu:openEventRegistrationMenu:open-registration"),
    openRegistration,
  );
manageEventMenu.register(openEventRegistrationMenu);
async function updateOpenEventRegistrationMenu(ctx: Context) {
  await editMessageTextSafe(
    ctx,
    ctx.t("manage_events.open_registration_confirm"),
  );
}

const closeEventRegistrationMenu = new Menu<Context>(
  "closeEventRegistrationMenu",
)
  .back(
    withPayload((ctx) => ctx.t("manage_events.close_registration_no")),
    logHandle("menu:closeEventRegistrationMenu:back"),
    updateManageEventMenu,
  )
  .back(
    withPayload((ctx) => ctx.t("manage_events.close_registration_yes")),
    logHandle("menu:closeEventRegistrationMenu:close-registration"),
    closeRegistration,
  );
manageEventMenu.register(closeEventRegistrationMenu);
async function updateCloseEventRegistrationMenu(ctx: Context) {
  await editMessageTextSafe(
    ctx,
    ctx.t("manage_events.close_registration_confirm"),
  );
}

const publishEventMenu = new Menu<Context>("publishEventMenu")
  .back(
    withPayload((ctx) => ctx.t("manage_events.publish_no")),
    logHandle("menu:publishEventMenu:back"),
    updateManageEventMenu,
  )
  .back(
    withPayload((ctx) => ctx.t("manage_events.publish_yes")),
    logHandle("menu:publishEventMenu:publish"),
    publishEvent,
  );
manageEventMenu.register(publishEventMenu);
async function updatePublishEventMenu(ctx: Context) {
  await editMessageTextSafe(ctx, ctx.t("manage_events.publish_confirm"));
}

const deleteEventMenu = new Menu<Context>("deleteEventMenu")
  .back(
    withPayload((ctx) => ctx.t("manage_events.delete_no")),
    logHandle("menu:deleteEventMenu:back"),
    updateManageEventMenu,
  )
  .text(
    withPayload((ctx) => ctx.t("manage_events.delete_yes")),
    logHandle("menu:deleteEventMenu:delete"),
    deleteEvent,
  );
manageEventMenu.register(deleteEventMenu);
async function updateDeleteEventMenu(ctx: Context) {
  await editMessageTextSafe(ctx, ctx.t("manage_events.delete_confirm"));
}

const cancelEventMenu = new Menu<Context>("cancelEventMenu")
  .back(
    withPayload((ctx) => ctx.t("manage_events.cancel_no")),
    logHandle("menu:cancelEventMenu:back"),
    updateManageEventMenu,
  )
  .back(
    withPayload((ctx) => ctx.t("manage_events.cancel_yes")),
    logHandle("menu:cancelEventMenu:cancel"),
    async (ctx) => {
      await updateManageEventMenu(ctx);
      await cancelEvent.enter(ctx);
    },
  );
manageEventMenu.register(cancelEventMenu);
async function updateCancelEventMenu(ctx: Context) {
  await editMessageTextSafe(ctx, ctx.t("manage_events.cancel_confirm"));
}

const manageEventParticipantsMenu = new Menu<Context>(
  "manageEventParticipantsMenu",
)
  .text(
    withPayload((ctx) => ctx.t("manage_events.update")),
    logHandle("menu:manageEventParticipantsMenu:update"),
    updateManageEventParticipantsMenu,
  )
  .row()
  .text(
    withPayload((ctx) => ctx.t("manage_events.message_participants")),
    logHandle("menu:manageEventParticipantsMenu:message-participants"),
    async (ctx) => messageEventParticipants.enter(ctx),
  )
  .row()
  .back(
    withPayload((ctx) => ctx.t("manage_events.back")),
    logHandle("menu:manageEventParticipantsMenu:back"),
    updateManageEventMenu,
  );
manageEventMenu.register(manageEventParticipantsMenu);
async function updateManageEventParticipantsMenu(ctx: Context) {
  const event = await getEventFromMatch(ctx); // allow editing closed and past events
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
              userLink: userLink(signup.user.id),
              name: sanitizeHtmlOrEmpty(signup.user.name),
              pronouns: sanitizeHtmlOrEmpty(signup.user.pronouns),
              username: sanitizeHtml(signup.user.username),
              options,
            })
          : ctx.t("manage_events.event_participant_no_username", {
              userLink: userLink(signup.user.id),
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
    ctx.logger.error("Can't get event form match", { match: ctx.match });
    return;
  }
  return event;
}

async function getEventForEditFromMatch(ctx: Context) {
  const event = await getEventFromMatch(ctx); // allow editing closed and past events
  if (event === undefined) return;

  if (moment.utc(event.date).isBefore(moment.now())) {
    await ctx.reply(ctx.t("manage_events.event_in_past"));
    return;
  }

  if (event.cancelled) {
    await ctx.reply(ctx.t("manage_events.event_cancelled"));
    return;
  }

  return event;
}

feature
  .chatType("private")
  .command("manage_events", logHandle("command:manage_events"), sendEventsMenu);

registerCommandHelp({
  command: "manage_events",
  scope: CommandScope.PrivateChat,
  privileges: CommandPrivileges.Admins,
});

const editEventName = conversation<Context>(
  "editEventName",
  logHandle("conversation:editEventName"),
)
  .proceed(async (ctx) => {
    const event = await getEventFromMatch(ctx); // allow editing closed and past events
    if (event === undefined) return finishConversation();
    await ctx.reply(ctx.t("manage_events.enter_name"));
    return { eventId: event.id };
  })
  .either()
  .waitCommand("cancel", async (ctx, { eventId }) => {
    return { eventId };
  })
  .waitFilterQueryIgnoreCmd("message:text", async (ctx, { eventId }) => {
    const event = await updateEvent(eventId, { name: ctx.message.text });
    await updateEventPost(ctx, event);
    return { eventId };
  })
  .done()
  .proceed(async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
  })
  .build();
feature.use(editEventName);

const eventChangeUpdateData = createCallbackData("eventChangeUpdate", {
  postToChannel: Boolean,
  messageParticipants: Boolean,
  conversationId: Number,
});
function makeEventChangeUpdateKeyboard(
  ctx: Context,
  conversationId: number,
  data: {
    postToChannel: boolean;
    messageParticipants: boolean;
  },
) {
  return new InlineKeyboard()
    .text(
      (data.postToChannel ? "☑️ " : "➖ ") +
        ctx.t("manage_events.post_to_channel"),
      eventChangeUpdateData.pack({
        ...data,
        conversationId,
        postToChannel: !data.postToChannel,
      }),
    )
    .row()
    .text(
      (data.messageParticipants ? "☑️ " : "➖ ") +
        ctx.t("manage_events.message_event_participants"),
      eventChangeUpdateData.pack({
        ...data,
        conversationId,
        messageParticipants: !data.messageParticipants,
      }),
    );
}

const editEventDate = conversation<Context>(
  "editEventDate",
  logHandle("conversation:editEventDate"),
)
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return finishConversation();
    await ctx.reply(ctx.t("manage_events.enter_date"));
    return {
      eventId: event.id,
    };
  })
  .either()
  .waitCommand("cancel", async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
    return finishConversation();
  })
  .waitFilterQueryIgnoreCmd("message:text", async (ctx, { eventId }) => {
    const event = await getEvent(eventId);
    if (event === null) return finishConversation();

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

    if (date.isSame(event.date)) {
      await ctx.reply(ctx.t("manage_events.date_not_changed"), {
        reply_to_message_id: ctx.message.message_id,
      });
      return repeatConversationStep({ eventId });
    }

    if (!event.published) {
      // Early finish
      const event = await updateEvent(eventId, { date: date.toDate() });
      await updateEventPost(ctx, event);
      await sendEventMenu(ctx, eventId);
      return finishConversation();
    }

    return {
      eventId,
      date: date.toDate(),
      hasChannelPost: event.channelPostId !== null,
    };
  })
  .done()
  .proceed(async (ctx, { eventId, date, hasChannelPost }) => {
    const params = {
      postToChannel: hasChannelPost,
      messageParticipants: true,
      conversationId: getConversationId(ctx),
    };

    await ctx.reply(
      ctx.t("manage_events.enter_date_change_reason", {
        date: toFluentDateTime(date),
      }),
      {
        reply_markup: makeEventChangeUpdateKeyboard(
          ctx,
          getConversationId(ctx),
          params,
        ),
      },
    );
    return { eventId, date, ...params };
  })
  .either()
  .waitCommand("cancel", async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
    return finishConversation();
  })
  .waitCommand("empty", async (ctx, params) => {
    return { reasonTextHtml: undefined, ...params };
  })
  .waitCallbackQuery(
    eventChangeUpdateData.filter(),
    async (ctx, { eventId, date, ...params }) => {
      const newParams = eventChangeUpdateData.unpack(ctx.callbackQuery.data);
      if (newParams.conversationId === getConversationId(ctx)) {
        await ctx.editMessageReplyMarkup({
          reply_markup: makeEventChangeUpdateKeyboard(
            ctx,
            getConversationId(ctx),
            newParams,
          ),
        });
        await ctx.answerCallbackQuery();
        return repeatConversationStep({ eventId, date, ...newParams });
      } else {
        return repeatConversationStep({ eventId, date, ...params });
      }
    },
  )
  .waitFilterQueryIgnoreCmd("message:text", async (ctx, params) => {
    const reasonText = ctx.msg.text ?? ctx.msg.caption ?? "";
    const reasonEntities = ctx.msg.entities ?? ctx.msg.caption_entities ?? [];
    const reasonTextHtml = parseTelegramEntities(reasonText, reasonEntities);

    return { reasonTextHtml, ...params };
  })
  .done()
  .proceed(async (ctx, { eventId, date, reasonTextHtml, ...params }) => {
    let event = await updateEvent(eventId, { date });

    await ctx.replyWithChatAction("typing");

    event = await updateEvent(eventId, { dateChanged: true });

    if (params.postToChannel) {
      const post = await ctx.api.sendMessage(
        config.CHANNEL,
        reasonTextHtml === undefined
          ? i18n.t(
              config.DEFAULT_LOCALE,
              "manage_events.date_change_post_no_reason",
              {
                eventSignupLink: signupLink(ctx.me.username, event.id),
                eventPostLink: messageLink(config.CHANNEL, event.channelPostId),
                name: sanitizeHtmlOrEmpty(event.name),
                date: toFluentDateTime(event.date),
              },
            )
          : i18n.t(config.DEFAULT_LOCALE, "manage_events.date_change_post", {
              eventSignupLink: signupLink(ctx.me.username, event.id),
              eventPostLink: messageLink(config.CHANNEL, event.channelPostId),
              name: sanitizeHtmlOrEmpty(event.name),
              date: toFluentDateTime(event.date),
              reasonTextHtml,
            }),
        {
          reply_parameters:
            event.channelPostId === null
              ? undefined
              : {
                  message_id: event.channelPostId,
                },
        },
      );
      await post.forward(config.MEMBERS_GROUP);
    }

    if (params.messageParticipants) {
      const makePost = (locale: string) =>
        reasonTextHtml === undefined
          ? i18n.t(
              locale,
              "manage_events.date_change_post_no_signup_link_no_reason",
              {
                eventPostLink: messageLink(config.CHANNEL, event.channelPostId),
                name: sanitizeHtmlOrEmpty(event.name),
                date: toFluentDateTime(event.date),
              },
            )
          : i18n.t(locale, "manage_events.date_change_post_no_signup_link", {
              eventPostLink: messageLink(config.CHANNEL, event.channelPostId),
              name: sanitizeHtmlOrEmpty(event.name),
              date: toFluentDateTime(event.date),
              reasonTextHtml,
            });

      const signups = await getEventSignups(eventId);
      const promises = signups
        .filter((signup) =>
          [
            SignupStatus.Approved,
            SignupStatus.PendingApproval,
            SignupStatus.PendingPayment,
          ].includes(signup.status),
        )
        .map(async (signup) =>
          ctx.api.sendMessage(
            signup.user.id,
            makePost(signup.user.locale ?? config.DEFAULT_LOCALE),
            {
              reply_markup: makeSignupReminderKeyboard(
                eventId,
                signup.user.locale ?? config.DEFAULT_LOCALE,
              ),
            },
          ),
        );
      await Promise.all(promises);
    }

    await updateEventPost(ctx, event);
    await sendEventMenu(ctx, eventId);
  })
  .build();
feature.use(editEventDate);

const editEventPost = conversation<Context>(
  "editEventPost",
  logHandle("conversation:editEventPost"),
)
  .proceed(async (ctx) => {
    const event = await getEventFromMatch(ctx); // allow editing closed and past events
    if (event === undefined) return finishConversation();
    await ctx.reply(ctx.t("manage_events.enter_post"));
    if (event.announcePhotoId) {
      await ctx.replyWithPhoto(event.announcePhotoId, {
        caption: event.announceTextHtml,
      });
    } else {
      await ctx.reply(event.announceTextHtml, {
        link_preview_options: { is_disabled: true },
      });
    }
    return { eventId: event.id };
  })
  .either()
  .waitCommand("cancel", async (ctx, { eventId }) => {
    return { eventId };
  })
  .waitFilterQueryIgnoreCmd("message", async (ctx, { eventId }) => {
    const eventUpdated = await editEventPostFromCtx(ctx, eventId);
    if (!eventUpdated) {
      return repeatConversationStep({ eventId });
    }
    return { eventId };
  })
  .done()
  .proceed(async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
  })
  .build();
feature.use(editEventPost);

const editEventPrice = conversation<Context>(
  "editEventPrice",
  logHandle("conversation:editEventPrice"),
)
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
    const event = await updateEvent(eventId, { price: null });
    await updateEventPost(ctx, event);
    return { eventId };
  })
  .waitFilterQueryIgnoreCmd("message:text", async (ctx, { eventId }) => {
    const event = await updateEvent(eventId, { price: ctx.message.text });
    await updateEventPost(ctx, event);
    return { eventId };
  })
  .done()
  .proceed(async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
  })
  .build();
feature.use(editEventPrice);

const editEventPaymentDetails = conversation<Context>(
  "editEventPaymentDetails",
  logHandle("conversation:editEventPaymentDetails"),
)
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
  .waitFilterQueryIgnoreCmd("message:text", async (ctx, { eventId }) => {
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
  .waitFilterQueryIgnoreCmd("message:text", async (ctx, { eventId, iban }) => {
    return { eventId, iban, recipient: ctx.message.text };
  })
  .done()
  .proceed(async (ctx, { eventId, iban, recipient }) => {
    const event = await updateEvent(eventId, { iban, recipient });
    await updateEventPost(ctx, event);
    await sendEventMenu(ctx, eventId);
  })
  .build();
feature.use(editEventPaymentDetails);

const editEventOptions = conversation<Context>(
  "editEventOptions",
  logHandle("conversation:editEventOptions"),
)
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
  .waitFilterQueryIgnoreCmd("message:text", async (ctx, { eventId }) => {
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

const editEventReminder = conversation<Context>(
  "editEventReminder",
  logHandle("conversation:editEventReminder"),
)
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined) return finishConversation();
    if (event.reminderTextHtml) {
      await ctx.reply(ctx.t("manage_events.enter_reminder_with_current"));
      await ctx.reply(event.reminderTextHtml, {
        link_preview_options: { is_disabled: true },
      });
    } else {
      await ctx.reply(ctx.t("manage_events.enter_reminder"));
    }
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
  .waitFilterQueryIgnoreCmd("message:text", async (ctx, { eventId }) => {
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
  let announceTextHtml = parseTelegramEntities(announceText, announceEntities);
  if (announceTextHtml.length === 0) {
    announceTextHtml = event.announceTextHtml;
  }

  let announcePhotoId: string | null = null;
  if (event.channelPostId === null || event.announcePhotoId !== null) {
    announcePhotoId =
      ctx.msg?.photo?.reduce((a, b) => (a.width > b.width ? a : b))?.file_id ??
      event.announcePhotoId;
  }

  const postLength = textLength(announceTextHtml);
  if (postLength > 4096 || (announcePhotoId !== null && postLength > 1024)) {
    // Event text is too long.
    await ctx.reply("Event text is too long!");
    return false;
  }

  const updatedEvent = await updateEvent(event.id, {
    announceTextHtml,
    announcePhotoId,
  });
  if (updatedEvent.channelPostId !== ctx.msg?.message_id) {
    await updateEventPost(ctx, updatedEvent);
  }

  return true;
}

async function updateEventPost(ctx: Context, event: Event) {
  if (event.channelPostId === null) return;
  try {
    const announceTextHtml = formatEventText(ctx, event);

    if (event.announcePhotoId) {
      await ctx.api.editMessageMedia(config.CHANNEL, event.channelPostId, {
        type: "photo",
        media: event.announcePhotoId,
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
        await updateEvent(event.id, { payment: EventPayment.NotRequired });
        break;
      case EventPayment.Donation:
        await updateEvent(event.id, { payment: EventPayment.Required });
        break;
      case EventPayment.NotRequired:
        await updateEvent(event.id, { payment: EventPayment.Donation });
        break;
    }
    await updateEventPost(ctx, event);
    await updateManageEventMenu(ctx);
  }
}

async function makeVisible(ctx: Context) {
  const event = await getEventFromMatch(ctx); // allow editing closed and past events
  if (event !== undefined) {
    await updateEvent(event.id, {
      published: true,
      visibleInMenu: true,
    });
    await updateEventPost(ctx, event);
    await updateManageEventMenu(ctx);
  }
}

async function makeInvisible(ctx: Context) {
  const event = await getEventFromMatch(ctx); // allow editing closed and past events
  if (event !== undefined) {
    await updateEvent(event.id, { visibleInMenu: false });
    await updateEventPost(ctx, event);
    await updateManageEventMenu(ctx);
  }
}

async function openRegistration(ctx: Context) {
  const event = await getEventForEditFromMatch(ctx);
  if (event !== undefined) {
    await updateEvent(event.id, {
      published: true,
      visibleInMenu: true,
      registrationOpen: true,
    });
    await updateEventPost(ctx, event);
    await updateManageEventMenu(ctx);
  }
}

async function closeRegistration(ctx: Context) {
  const event = await getEventFromMatch(ctx); // allow editing closed and past events
  if (event !== undefined) {
    await updateEvent(event.id, { registrationOpen: false });
    await updateEventPost(ctx, event);
    await updateManageEventMenu(ctx);
  }
}

async function publishEvent(ctx: Context) {
  const event = await getEventForEditFromMatch(ctx);
  if (event === undefined || event.channelPostId !== null) return;

  await updateEvent(event.id, {
    published: true,
    visibleInMenu: true,
    registrationOpen: true,
  });

  const announceTextHtml = formatEventText(ctx, event);

  let channelPost;
  if (event.announcePhotoId) {
    channelPost = await ctx.api.sendPhoto(
      config.CHANNEL,
      event.announcePhotoId,
      {
        caption: announceTextHtml,
      },
    );
  } else {
    channelPost = await ctx.api.sendMessage(config.CHANNEL, announceTextHtml, {
      link_preview_options: { is_disabled: true },
    });
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

  await updateManageEventMenu(ctx);
}

async function deleteEvent(ctx: Context) {
  const event = await getEventForEditFromMatch(ctx);
  if (event === undefined || event.published) return;

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

const cancelEvent = conversation<Context>(
  "cancelEvent",
  logHandle("conversation:cancelEvent"),
)
  .proceed(async (ctx) => {
    const event = await getEventForEditFromMatch(ctx);
    if (event === undefined || !event.published) return finishConversation();

    const params = {
      postToChannel: event.channelPostId !== null,
      messageParticipants: true,
    };

    await ctx.reply(ctx.t("manage_events.enter_cancellation_reason"), {
      reply_markup: makeEventChangeUpdateKeyboard(
        ctx,
        getConversationId(ctx),
        params,
      ),
    });
    return { eventId: event.id, ...params };
  })
  .either()
  .waitCommand("cancel", async (ctx, { eventId }) => {
    await sendEventMenu(ctx, eventId);
    return finishConversation();
  })
  .waitCommand("empty", async (ctx, data) => {
    return { ...data, reasonTextHtml: undefined };
  })
  .waitCallbackQuery(
    eventChangeUpdateData.filter(),
    async (ctx, { eventId, ...params }) => {
      const newParams = eventChangeUpdateData.unpack(ctx.callbackQuery.data);
      if (newParams.conversationId === getConversationId(ctx)) {
        await ctx.editMessageReplyMarkup({
          reply_markup: makeEventChangeUpdateKeyboard(
            ctx,
            getConversationId(ctx),
            newParams,
          ),
        });
        await ctx.answerCallbackQuery();
        return repeatConversationStep({ eventId, ...newParams });
      } else {
        return repeatConversationStep({ eventId, ...params });
      }
    },
  )
  .waitFilterQueryIgnoreCmd("message:text", async (ctx, params) => {
    const reasonText = ctx.msg.text ?? ctx.msg.caption ?? "";
    const reasonEntities = ctx.msg.entities ?? ctx.msg.caption_entities ?? [];
    const reasonTextHtml = parseTelegramEntities(reasonText, reasonEntities);

    return { ...params, reasonTextHtml };
  })
  .done()
  .proceed(async (ctx, { eventId, reasonTextHtml, ...params }) => {
    await ctx.replyWithChatAction("typing");

    const event = await updateEvent(eventId, {
      cancelled: true,
      registrationOpen: false,
    });

    const makePost = (locale: string) =>
      reasonTextHtml === undefined
        ? i18n.t(locale, "manage_events.event_cancellation_post_no_reason", {
            eventPostLink: messageLink(config.CHANNEL, event.channelPostId),
            title: sanitizeHtmlOrEmpty(event.name),
          })
        : i18n.t(locale, "manage_events.event_cancellation_post", {
            eventPostLink: messageLink(config.CHANNEL, event.channelPostId),
            title: sanitizeHtmlOrEmpty(event.name),
            reasonTextHtml,
          });

    if (params.postToChannel) {
      const post = await ctx.api.sendMessage(
        config.CHANNEL,
        makePost(config.DEFAULT_LOCALE),
        {
          reply_parameters:
            event.channelPostId === null
              ? undefined
              : {
                  message_id: event.channelPostId,
                },
        },
      );
      await post.forward(config.MEMBERS_GROUP);
    }

    if (params.messageParticipants) {
      const signups = await getEventSignups(eventId);
      const promises = signups
        .filter((signup) =>
          [
            SignupStatus.Approved,
            SignupStatus.PendingApproval,
            SignupStatus.PendingPayment,
          ].includes(signup.status),
        )
        .map(async (signup) =>
          ctx.api.sendMessage(
            signup.user.id,
            makePost(signup.user.locale ?? config.DEFAULT_LOCALE),
          ),
        );
      await Promise.all(promises);
    }

    await updateEventPost(ctx, event);
    await sendEventMenu(ctx, eventId);
  })
  .build();
feature.use(cancelEvent);

const createEvent = conversation<Context>(
  "createEvent",
  logHandle("conversation:createEvent"),
)
  .proceed(async (ctx) => {
    await ctx.reply(ctx.t("manage_events.enter_name"));
  })
  .either()
  .waitCommand("cancel", async (ctx) => {
    await sendEventsMenu(ctx);
    return finishConversation();
  })
  .waitFilterQueryIgnoreCmd("message:text", async (ctx) => {
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
  .waitFilterQueryIgnoreCmd("message:text", async (ctx, { name }) => {
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
    const event = await createDbEvent(name, date, DEFAULT_EVENT_TEXT);
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
    conversationId: Number,
  },
);
function makeMessageEventParticipantsKeyboard(
  ctx: Context,
  data: {
    includeApproved: boolean;
    includePending: boolean;
    includeRejected: boolean;
    conversationId: number;
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
  logHandle("conversation:messageEventParticipants"),
)
  .proceed(async (ctx) => {
    const event = await getEventFromMatch(ctx); // allow editing closed and past events
    if (event === undefined) return finishConversation();
    const params = {
      includeApproved: true,
      includePending: false,
      includeRejected: false,
      conversationId: ctx.update.update_id,
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
    async (ctx, { eventId, ...params }) => {
      const newParams = messageEventParticipantsData.unpack(
        ctx.callbackQuery.data,
      );
      if (newParams.conversationId === params.conversationId) {
        await ctx.editMessageReplyMarkup({
          reply_markup: makeMessageEventParticipantsKeyboard(ctx, newParams),
        });
        await ctx.answerCallbackQuery();
        return repeatConversationStep({ eventId, ...newParams });
      } else {
        return repeatConversationStep({ eventId, ...params });
      }
    },
  )
  .waitFilterQueryIgnoreCmd(
    "message",
    async (
      ctx,
      { eventId, includeApproved, includePending, includeRejected },
    ) => {
      await ctx.replyWithChatAction("typing");
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
