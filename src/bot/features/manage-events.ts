import { Menu } from "@grammyjs/menu";
import { Composer } from "grammy";
import moment from "moment-timezone";

import {
  Event,
  createEvent as createDbEvent,
  deleteEvent as deleteDbEvent,
  getEvent,
  upcomingEvents,
  updateEvent,
} from "#root/backend/event.js";
import { Context, Conversation } from "#root/bot/context.js";
import { registerCommandHelpProvider } from "#root/bot/features/help.js";
import { isAdmin } from "#root/bot/filters/index.js";
import {
  createConversation,
  maybeExternal,
  waitForDate,
  waitForSkipCommands,
} from "#root/bot/helpers/conversations.js";
import { editMessageTextSafe } from "#root/bot/helpers/edit-text.js";
import { toFluentDateTime } from "#root/bot/helpers/i18n.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { parseTelegramEntities } from "#root/bot/helpers/parse-telegram-entities.js";
import { sanitizeHtmlOrEmpty } from "#root/bot/helpers/sanitize-html.js";
import { withPayload } from "#root/bot/helpers/with-payload.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

export const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

export const enterEditEventName = async (ctx: Context) => {
  await ctx.conversation.enter("editEventName");
};
async function editEventName(conversation: Conversation, ctx: Context) {
  const event = await getEventForEditFromMatch(conversation, ctx);
  if (event === undefined) return;

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.enter_name"));
  const reply = await waitForSkipCommands(conversation, "message:text");

  await conversation.external(async () => {
    await updateEvent(event.id, { name: reply.message.text });
  });

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_success"), {
    reply_to_message_id: reply.message.message_id,
  });
}
feature.use(createConversation(editEventName));

export const enterEditEventDate = async (ctx: Context) => {
  await ctx.conversation.enter("editEventDate");
};
async function editEventDate(conversation: Conversation, ctx: Context) {
  const event = await getEventForEditFromMatch(conversation, ctx);
  if (event === undefined) return;

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.enter_date"));
  const { date, replyMessageId } = await waitForDate(
    conversation,
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "manage_events.date_invalid"),
    i18n.t(config.DEFAULT_LOCALE, "manage_events.date_in_past"),
  );

  await conversation.external(async () => {
    await updateEvent(event.id, { date });
  });

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_success"), {
    reply_to_message_id: replyMessageId,
  });
}
feature.use(createConversation(editEventDate));

export const enterEditEventPost = async (ctx: Context) => {
  await ctx.conversation.enter("editEventPost");
};
async function editEventPost(
  conversation: Conversation,
  ctx: Context,
  event?: Event,
) {
  event = event ?? (await getEventForEditFromMatch(conversation, ctx));
  if (event === undefined) return;

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.enter_post"));

  const postMessage = await waitForSkipCommands(conversation, "message");
  const announceText =
    postMessage.message.text ?? postMessage.message.caption ?? "";
  const announceEntities =
    postMessage.message.entities ?? postMessage.message.caption_entities ?? [];
  event.announceTextHtml = parseTelegramEntities(
    announceText,
    announceEntities,
  );
  if (event.announcePhotoId !== null) {
    event.announcePhotoId =
      postMessage.message?.photo?.reduce((a, b) => (a.width > b.width ? a : b))
        ?.file_id ?? event.announcePhotoId;
  }

  await conversation.external(async () => {
    await updateEvent(event.id, event);
  });

  if (event.channelPostId !== null) {
    if (event.announcePhotoId) {
      await ctx.api.editMessageMedia(config.CHANNEL, event.channelPostId, {
        type: "photo",
        media: event.announcePhotoId,
        caption: event.announceTextHtml,
      });
    } else {
      await ctx.api.editMessageText(
        config.CHANNEL,
        event.channelPostId,
        event.announceTextHtml,
      );
    }
  }

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_success"), {
    reply_to_message_id: postMessage.message.message_id,
  });
}
feature.use(createConversation(editEventPost));

async function switchConfirmation(ctx: Context) {
  const event = await getEventForEditFromMatch(null, ctx);
  if (event !== undefined) {
    await updateEvent(event.id, { requireApproval: !event.requireApproval });
    ctx.menu.update();
  }
}

async function switchPayment(ctx: Context) {
  const event = await getEventForEditFromMatch(null, ctx);
  if (event !== undefined) {
    await updateEvent(event.id, { requirePayment: !event.requirePayment });
    ctx.menu.update();
  }
}

async function publishEvent(ctx: Context) {
  const event = await getEventForEditFromMatch(null, ctx);
  if (event === undefined || event.published) return;

  await updateEvent(event.id, { published: true });
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
  const event = await getEventForEditFromMatch(null, ctx);
  if (event === undefined) return;

  if (event.chatPostId !== null) {
    await ctx.api.deleteMessage(config.MEMBERS_GROUP, event.chatPostId);
  }

  if (event.channelPostId !== null) {
    await ctx.api.deleteMessage(config.CHANNEL, event.channelPostId);
  }

  await deleteDbEvent(event.id);
  ctx.menu.nav("manageEventsMenu");
  await updateManageEventsMenu(ctx);
}

export const enterCreateEvent = async (ctx: Context) => {
  await ctx.conversation.enter("createEvent", { overwrite: true });
};
async function createEvent(conversation: Conversation, ctx: Context) {
  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.enter_name"));
  const nameMessage = await waitForSkipCommands(conversation, "message:text");

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.enter_date"));
  const { date } = await waitForDate(
    conversation,
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "manage_events.date_invalid"),
    i18n.t(config.DEFAULT_LOCALE, "manage_events.date_in_past"),
  );

  const event = await conversation.external(async () => {
    return createDbEvent(nameMessage.message.text, date);
  });

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.event_created"));
  await ctx.reply(
    i18n.t(config.DEFAULT_LOCALE, "manage_events.signup_link", {
      username: ctx.me.username,
      eventId: event.id,
    }),
  );

  await editEventPost(conversation, ctx, event);
}
feature.use(createConversation(createEvent));

export const manageEventsMenu = new Menu<Context>("manageEventsMenu")
  .text(
    () => i18n.t(config.DEFAULT_LOCALE, "manage_events.update"),
    updateManageEventsMenu,
  )
  .text(
    () => i18n.t(config.DEFAULT_LOCALE, "manage_events.create"),
    async (ctx) => enterCreateEvent(ctx),
  )
  .row()
  .dynamic(async (_ctx, range) => {
    const events = await upcomingEvents();
    for (const event of events) {
      range
        .submenu(
          {
            text: i18n.t(config.DEFAULT_LOCALE, "manage_events.event_title", {
              name: event.name,
              date: toFluentDateTime(event.date),
              published: event.published ? "yes" : "no",
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

export const manageEventMenu = new Menu<Context>("manageEventMenu")
  .text(
    withPayload(() => i18n.t(config.DEFAULT_LOCALE, "manage_events.update")),
    updateManageEventMenu,
  )
  .row()
  .dynamic(async (ctx, range) => {
    const event = await getEventFromMatch(null, ctx);
    if (event === undefined) return;

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
        i18n.t(config.DEFAULT_LOCALE, "manage_events.payment", {
          required: event.requirePayment ? "yes" : "no",
        }),
      ),
      switchPayment,
    );
    range.row();
    range.text(
      withPayload(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_name")),
      enterEditEventName,
    );
    range.row();
    range.text(
      withPayload(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_date")),
      enterEditEventDate,
    );
    range.row();
    if (event.announceTextHtml === null) {
      range.text(
        withPayload(i18n.t(config.DEFAULT_LOCALE, "manage_events.add_post")),
        enterEditEventPost,
      );
    } else {
      range.text(
        withPayload(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_post")),
        enterEditEventPost,
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
  const event = await getEventFromMatch(null, ctx);
  if (event === undefined) return;

  await editMessageTextSafe(
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "manage_events.event", {
      name: sanitizeHtmlOrEmpty(event.name),
      date: toFluentDateTime(event.date),
      text: event.announceTextHtml ?? "&lt;empty&gt;",
    }),
  );
}

export const publishEventMenu = new Menu<Context>("publishEventMenu")
  .back(
    withPayload(() =>
      i18n.t(config.DEFAULT_LOCALE, "manage_events.publish_no"),
    ),
    updateManageEventMenu,
  )
  .text(
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

export const deleteEventMenu = new Menu<Context>("deleteEventMenu")
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

async function getEventFromMatch(
  conversation: Conversation | null,
  ctx: Context,
) {
  const eventId = Number(ctx.match);
  if (!Number.isFinite(eventId)) {
    ctx.logger.error("Can't get event id form match", { match: ctx.match });
    return;
  }
  const event = await maybeExternal(conversation, async () =>
    getEvent(eventId),
  );
  if (event === null) {
    ctx.logger.error("Can't get event id form match", { match: ctx.match });
    return;
  }
  return event;
}

async function getEventForEditFromMatch(
  conversation: Conversation | null,
  ctx: Context,
) {
  const event = await getEventFromMatch(conversation, ctx);
  if (event === undefined) return;

  if (moment.utc(event.date).isBefore(moment.now())) {
    await ctx.reply(
      i18n.translate(config.DEFAULT_LOCALE, "manage_events.event_in_past"),
    );
    return;
  }

  return event;
}

feature.command("manage_events", logHandle("manage_events"), async (ctx) => {
  const commandParse = /^\/manage_events\s+(?<eventId>\d+)/.exec(
    ctx.message.text,
  );
  const eventId = commandParse?.groups?.eventId;

  if (eventId) {
    ctx.match = eventId;

    const event = await getEventFromMatch(null, ctx);
    if (event === undefined) return;

    await ctx.reply(
      i18n.t(config.DEFAULT_LOCALE, "manage_events.event", {
        name: sanitizeHtmlOrEmpty(event.name),
        date: toFluentDateTime(event.date),
        text: event.announceTextHtml ?? "&lt;empty&gt;",
      }),
      {
        reply_markup: manageEventMenu,
      },
    );
  } else {
    await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.events"), {
      reply_markup: manageEventsMenu,
    });
  }
});

registerCommandHelpProvider((localeCode, isAdmin) => {
  return isAdmin
    ? [
        {
          command: "manage_events",
          description: i18n.t(localeCode, "manage_events_command.description"),
        },
      ]
    : [];
});
