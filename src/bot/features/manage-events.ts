import { Menu } from "@grammyjs/menu";
import { Composer, Filter, GrammyError } from "grammy";
import moment from "moment-timezone";

import {
  Event,
  createEvent as createDbEvent,
  deleteEvent as deleteDbEvent,
  getEventSignups,
  getEventWithSignupStats,
  upcomingEventsWithSignupStats,
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

export const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

export const enterEditEventName = async (ctx: Context) => {
  await ctx.conversation.enter("editEventName");
};
async function editEventName(conversation: Conversation, ctx: Context) {
  const event = await getEventForEditFromMatch(conversation, ctx);
  if (event === undefined) return;

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.enter_name"));
  const { reply, command } = await waitForSkipCommands(
    conversation,
    "message:text",
    ["cancel"],
  );
  if (command === "cancel") {
    await reply.react("👌");
    return;
  }

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
  const { date, reply, command } = await waitForDate(
    conversation,
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "manage_events.date_invalid"),
    i18n.t(config.DEFAULT_LOCALE, "manage_events.date_in_past"),
    ["cancel"],
  );
  if (command === "cancel") {
    await reply.react("👌");
    return;
  }

  await conversation.external(async () => {
    await updateEvent(event.id, { date });
  });

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_success"), {
    reply_to_message_id: reply.message.message_id,
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

  const { reply, command } = await waitForSkipCommands(
    conversation,
    "message",
    ["cancel"],
  );
  if (command === "cancel") {
    await reply.react("👌");
    return;
  }

  await editEventPostFromCtx(conversation, reply, event);

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_success"), {
    reply_to_message_id: reply.message.message_id,
  });
}
feature.use(createConversation(editEventPost));

async function editEventPostFromCtx(
  conversation: Conversation | null,
  ctx: Filter<Context, "message"> | Filter<Context, "edited_message">,
  event: Event,
) {
  const announceText = ctx.msg.text ?? ctx.msg.caption ?? "";
  const announceEntities = ctx.msg.entities ?? ctx.msg.caption_entities ?? [];
  event.announceTextHtml = parseTelegramEntities(
    announceText,
    announceEntities,
  );
  if (!event.published || event.announcePhotoId !== null) {
    event.announcePhotoId =
      ctx.msg?.photo?.reduce((a, b) => (a.width > b.width ? a : b))?.file_id ??
      event.announcePhotoId;
  }

  await maybeExternal(conversation, async () => updateEvent(event.id, event));

  if (
    event.channelPostId !== null &&
    event.channelPostId !== ctx.msg?.message_id
  ) {
    try {
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

export const enterEditEventPrice = async (ctx: Context) => {
  await ctx.conversation.enter("editEventPrice");
};
async function editEventPrice(
  conversation: Conversation,
  ctx: Context,
  event?: Event,
) {
  event = event ?? (await getEventForEditFromMatch(conversation, ctx));
  if (event === undefined) return;

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.enter_price"));
  const { reply, command } = await waitForSkipCommands(
    conversation,
    "message:text",
    ["cancel", "empty"],
  );
  if (command === "cancel") {
    await reply.react("👌");
    return;
  }
  const price = command === "empty" ? null : reply.message.text;
  await conversation.external(async () => {
    await updateEvent(event.id, { price });
  });

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_success"), {
    reply_to_message_id: reply.message.message_id,
  });
}
feature.use(createConversation(editEventPrice));

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
    if (event.price === null) {
      await enterEditEventPrice(ctx);
    }
  }
}

export const enterEditEventOptions = async (ctx: Context) => {
  await ctx.conversation.enter("editEventOptions");
};
async function editEventOptions(
  conversation: Conversation,
  ctx: Context,
  event?: Event,
) {
  event = event ?? (await getEventForEditFromMatch(conversation, ctx));
  if (event === undefined) return;

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.enter_options"));
  const { reply, command } = await waitForSkipCommands(
    conversation,
    "message:text",
    ["cancel", "empty"],
  );
  if (command === "cancel") {
    await reply.react("👌");
    return;
  }

  let participationOptions: string[] | null = reply.message.text
    .split("\n")
    .filter((x) => x);
  if (command === "empty" || participationOptions.length === 0) {
    participationOptions = null;
  }

  await conversation.external(async () => {
    await updateEvent(event.id, { participationOptions });
  });

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_success"), {
    reply_to_message_id: reply.message.message_id,
  });
}
feature.use(createConversation(editEventOptions));

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
    await deleteMessageSafe(ctx, config.MEMBERS_GROUP, event.chatPostId);
  }

  if (event.channelPostId !== null) {
    await deleteMessageSafe(ctx, config.CHANNEL, event.channelPostId);
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
  const { reply: nameReply, command: nameCommand } = await waitForSkipCommands(
    conversation,
    "message:text",
    ["cancel"],
  );
  if (nameCommand === "cancel") {
    await nameReply.react("👌");
    return;
  }

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.enter_date"));
  const {
    date,
    reply: dateReply,
    command: dateCommand,
  } = await waitForDate(
    conversation,
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "manage_events.date_invalid"),
    i18n.t(config.DEFAULT_LOCALE, "manage_events.date_in_past"),
    ["cancel"],
  );
  if (dateCommand === "cancel") {
    await dateReply.react("👌");
    return;
  }

  const event = await conversation.external(async () => {
    return createDbEvent(nameReply.message.text, date);
  });

  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.event_created"));
  await ctx.reply(
    i18n.t(config.DEFAULT_LOCALE, "manage_events.signup_link", {
      username: ctx.me.username,
      eventId: event.id,
    }),
  );

  await editEventPrice(conversation, ctx, event);
  await editEventPost(conversation, ctx, event);
  await editEventOptions(conversation, ctx, event);
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
    range.text(
      withPayload(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_price")),
      enterEditEventPrice,
    );
    range.row();
    range.text(
      withPayload(i18n.t(config.DEFAULT_LOCALE, "manage_events.edit_options")),
      enterEditEventOptions,
    );

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
  const event = await getEventFromMatch(null, ctx);
  if (event === undefined) return;

  await editMessageTextSafe(
    ctx,
    i18n.t(config.DEFAULT_LOCALE, "manage_events.event", {
      name: sanitizeHtmlOrEmpty(event.name),
      date: toFluentDateTime(event.date),
      price: sanitizeHtmlOrEmpty(event.price),
      options: (event.participationOptions ?? [])
        .map(sanitizeHtmlOrEmpty)
        .join("; "),
      text: event.announceTextHtml ?? "&lt;empty&gt;",
      botUsername: ctx.me.username,
      eventId: String(event.id),
    }),
    {
      link_preview_options: { is_disabled: true },
    },
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

export const manageEventParticipantsMenu = new Menu<Context>(
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
  const event = await getEventFromMatch(null, ctx);
  if (event === undefined) return;

  const participants = (await getEventSignups(event.id))
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
    getEventWithSignupStats(eventId),
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
  await ctx.reply(i18n.t(config.DEFAULT_LOCALE, "manage_events.events"), {
    reply_markup: manageEventsMenu,
  });
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
