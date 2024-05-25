import { Filter } from "grammy";
import type { Context } from "#root/bot/context.js";
import {
  findCopiedMessagesByOriginId,
  saveCopiedMessageId,
} from "#root/backend/edit-cache.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";
import { MessageEntity } from "@grammyjs/types";

export async function copyMessageTo(
  ctx: Filter<Context, "message">,
  destinationChatId: number,
  options?: {
    message_thread_id?: number;
  },
) {
  const forwardedCtx = await ctx.copyMessage(destinationChatId, options);
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
    ctx.editedMessage?.message_id,
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

function addEditedLabel(
  text?: string,
  entities?: MessageEntity[],
): { text: string; entities: MessageEntity[] } {
  const label = i18n.t(config.DEFAULT_LOCALE, "edit_cache.edited", {
    date: new Date(),
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
