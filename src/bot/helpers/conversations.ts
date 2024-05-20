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
