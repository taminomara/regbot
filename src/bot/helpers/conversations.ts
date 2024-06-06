import {
  ConversationFn,
  createConversation as createDefaultConversation,
} from "@grammyjs/conversations";
import { Filter, FilterQuery } from "grammy";
import moment from "moment-timezone";

import { Context, Conversation } from "#root/bot/context.js";
import { logger as loggerMw } from "#root/bot/middlewares/index.js";
import { config } from "#root/config.js";

export function createConversation(fn: ConversationFn<Context>) {
  const wrappedFn = async (conversation: Conversation, ctx: Context) => {
    // Fixup logger before entering a conversation.
    await conversation.run(loggerMw());
    return fn(conversation, ctx);
  };
  return createDefaultConversation(wrappedFn, { id: fn.name });
}

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
  errorPastDateMessage: string,
) {
  while (true) {
    const reply = await waitForSkipCommands(conversation, "message:text");

    const timestamp = moment.tz(
      reply.message.text,
      "YYYY-MM-DD HH:mm",
      true,
      config.TIMEZONE,
    );

    if (!timestamp.isValid()) {
      await ctx.reply(errorMessage, {
        reply_to_message_id: reply.message.message_id,
      });
      continue;
    }

    if (timestamp.isBefore(moment.now())) {
      await ctx.reply(errorPastDateMessage, {
        reply_to_message_id: reply.message.message_id,
      });
      continue;
    }

    return {
      date: timestamp.toDate(),
      replyMessageId: reply.message.message_id,
    };
  }
}

export async function maybeExternal<T>(
  conversation: Conversation | null,
  closure: () => Promise<T>,
): Promise<T> {
  if (conversation === null) {
    return closure();
  } else {
    return conversation.external(closure);
  }
}
