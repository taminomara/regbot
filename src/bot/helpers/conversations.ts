import { Context, Conversation } from "#root/bot/context.js";
import { Filter, FilterQuery } from "grammy";

export function waitForSkipCommands<Q extends FilterQuery>(
  conversation: Conversation,
  filter: Q | Q[],
) {
  return conversation.waitUntil(
    (ctx): ctx is Filter<Context, Q> =>
      ctx.entities("bot_command").length === 0 && ctx.has(filter),
  );
}

export async function waitForDate(
  conversation: Conversation,
  ctx: Context,
  errorMessage: string,
) {
  while (true) {
    const reply = await waitForSkipCommands(conversation, "message:text");

    const timestamp = Date.parse(reply.message.text);

    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp);
    }

    await ctx.reply(errorMessage, {
      reply_to_message_id: reply.message.message_id,
    });
  }
}
