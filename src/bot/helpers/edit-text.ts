import { Other } from "@grammyjs/hydrate";
import { GrammyError } from "grammy";

import { Context } from "#root/bot/context.js";

export async function editMessageTextSafe(
  ctx: Context,
  text: string,
  other?: Other<
    "editMessageText",
    "chat_id" | "message_id" | "inline_message_id" | "text"
  >,
) {
  try {
    return await ctx.editMessageText(text, other);
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
