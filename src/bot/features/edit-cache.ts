import { Other } from "@grammyjs/hydrate";
import { MessageEntity } from "@grammyjs/types";
import { Filter } from "grammy";

import {
  findCopiedMessagesByOriginId,
  findCopiedMessagesByOriginIdAndDestinationChatId,
  saveCopiedMessageId,
} from "#root/backend/edit-cache.js";
import type { Context } from "#root/bot/context.js";
import { toFluentDateTime } from "#root/bot/helpers/i18n.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

export async function copyMessageTo(
  ctx: Filter<Context, "message">,
  destinationChatId: number,
  other?: Other<
    "copyMessage",
    "chat_id" | "from_chat_id" | "message_id" | "reply_to_message_id"
  >,
) {
  let replyToMessageId;
  if (ctx.message.reply_to_message !== undefined) {
    const originalReplies =
      await findCopiedMessagesByOriginIdAndDestinationChatId(
        ctx.message.reply_to_message.message_id,
        ctx.message.reply_to_message.chat.id,
        destinationChatId,
      );
    if (originalReplies.length > 0) {
      replyToMessageId = originalReplies[0].destinationId;
    }
  }

  const forwardedCtx = await ctx.copyMessage(destinationChatId, {
    ...other,
    reply_to_message_id: replyToMessageId,
  });

  await saveCopiedMessageId(
    ctx.message.message_id,
    ctx.message.chat.id,
    forwardedCtx.message_id,
    destinationChatId,
  );
}

export async function handleMessageEdit(
  ctx: Filter<Context, "edited_message">,
) {
  if (ctx.editedMessage?.message_id === undefined) return;

  const copiedMessages = await findCopiedMessagesByOriginId(
    ctx.editedMessage.message_id,
    ctx.chat.id,
  );

  for (const copiedMessage of copiedMessages) {
    if (ctx.editedMessage.text !== undefined) {
      const { text, entities } = addEditedLabel(
        ctx.editedMessage.text,
        ctx.editedMessage.entities,
      );
      await ctx.api.editMessageText(
        copiedMessage.destinationChatId,
        copiedMessage.destinationId,
        text,
        {
          entities,
          link_preview_options: ctx.editedMessage.link_preview_options,
          parse_mode: undefined, // override default parse mode
        },
      );
    }

    // Note: this doesn't handle edits to things like voice messages,
    // but most clients do not support editing them anyway.
    const medias: {
      type: "photo" | "video" | "animation" | "audio" | "document";
      fileId?: string;
    }[] = [
      {
        type: "photo",
        fileId: ctx.editedMessage.photo?.reduce((a, b) =>
          a.width > b.width ? a : b,
        )?.file_id,
      },
      { type: "video", fileId: ctx.editedMessage.video?.file_id },
      { type: "animation", fileId: ctx.editedMessage.animation?.file_id },
      { type: "audio", fileId: ctx.editedMessage.audio?.file_id },
      { type: "document", fileId: ctx.editedMessage.document?.file_id },
    ];
    for (const { type, fileId } of medias) {
      if (fileId !== undefined) {
        const { text, entities } = addEditedLabel(
          ctx.editedMessage.text,
          ctx.editedMessage.entities,
        );

        await ctx.api.editMessageMedia(
          copiedMessage.destinationChatId,
          copiedMessage.destinationId,
          {
            type,
            media: fileId,
            caption: text,
            caption_entities: entities,
            parse_mode: undefined, // override default parse mode
          },
        );
      }
    }
  }
}

export async function handleMessageReaction(
  ctx: Filter<Context, "message_reaction">,
) {
  if (ctx.messageReaction?.message_id === undefined) return;

  const copiedMessages = await findCopiedMessagesByOriginId(
    ctx.messageReaction.message_id,
    ctx.chat.id,
  );

  for (const copiedMessage of copiedMessages) {
    await ctx.api.setMessageReaction(
      copiedMessage.destinationChatId,
      copiedMessage.destinationId,
      ctx.messageReaction.new_reaction
    );
  }
}

function addEditedLabel(
  text?: string,
  entities?: MessageEntity[],
): { text: string; entities: MessageEntity[] } {
  const label = i18n.t(config.DEFAULT_LOCALE, "edit_cache.edited", {
    date: toFluentDateTime(new Date()),
  });
  const newText = text ? [text, label].join("\n\n") : label;

  return {
    text: newText,
    entities: [
      ...(entities ?? []),
      {
        type: "italic",
        offset: newText.length - label.length,
        length: label.length,
      },
    ],
  };
}
