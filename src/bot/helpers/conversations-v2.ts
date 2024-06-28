/**
 * Simple linear conversations, finite state-machine style.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Other } from "@grammyjs/hydrate";
import {
  Context as DefaultContext,
  Filter,
  FilterQuery,
  InlineKeyboard,
  MiddlewareFn,
  MiddlewareObj,
} from "grammy";

import { Context } from "#root/bot/context.js";

import { editMessageTextSafe } from "./edit-text.js";

const SEALED = Symbol("SEALED");

export type StringOrStringLiteral<T> = T extends string
  ? string extends T
    ? string
    : T
  : string;

/**
 * Return this from a step handler to repeat it.
 */
export const REPEAT = Symbol("REPEAT");

/**
 * Return this from a step handler to finish the conversation.
 */
export const FINISH = Symbol("FINISH");

/**
 * I mean... yeah!
 */
export type MaybePromise<T> = T | Promise<T>;

type Step<C> = {
  filter?: (ctx: C, payload: any) => MaybePromise<boolean>;
  func: (ctx: C, payload: any) => MaybePromise<any>;
};

export class Conversation<IP> implements MiddlewareObj<Context> {
  readonly name: string;
  private readonly steps: Step<Context>[];

  constructor(name: string, steps: Step<Context>[], _: typeof SEALED) {
    this.name = name;
    this.steps = steps;
  }

  middleware(): MiddlewareFn<Context> {
    return async (ctx, next) => {
      if (await this.filter(ctx)) {
        return this.run(ctx);
      } else {
        return next();
      }
    };
  }

  async forceEnter(
    ctx: Context,
    ...args: IP extends undefined ? [payload?: IP] : [payload: IP]
  ) {
    ctx.session.linearConversation = undefined;
    await this.enter(ctx, ...args);
  }

  async enter(
    ctx: Context,
    ...args: IP extends undefined ? [payload?: IP] : [payload: IP]
  ) {
    if (ctx.session.linearConversation !== undefined) {
      throw new Error(
        `can't instantiate conversation ${this.name} while ` +
          `${ctx.session.linearConversation.name} is in progress (force=false)`,
      );
    }

    ctx.session.linearConversation = {
      name: this.name,
      step: 0,
      payload: args[0],
    };

    return this.run(ctx);
  }

  private async filter(ctx: Context) {
    if (ctx.session.linearConversation === undefined) return false;

    const { name, step, payload } = ctx.session.linearConversation;

    if (name !== this.name) return false;

    if (step >= this.steps.length) {
      ctx.session.linearConversation = undefined;
      return false;
    }

    const { filter } = this.steps[step];
    return filter === undefined || filter(ctx, payload);
  }

  private async run(ctx: Context) {
    if (ctx.session.linearConversation === undefined) return false;

    if (ctx.session.linearConversation.name !== this.name) return false;

    // When we enter this cycle, the context is already filtered
    // by the current step's filter. This cycle repeats for
    // all the 'proceed' steps following after this one.
    // If we encounter a 'wait' step, we return from this function
    // and wait for the next message that passes this 'wait' step's filter.
    while (ctx.session.linearConversation.step < this.steps.length) {
      const { func } = this.steps[ctx.session.linearConversation.step];
      const result = await func(ctx, ctx.session.linearConversation.payload);
      switch (result) {
        case REPEAT: {
          // Repeat the same step after user gives their answer.
          return;
        }
        case FINISH: {
          // Finish the conversation early, i.e. break out of this cycle.
          ctx.session.linearConversation.step = this.steps.length;
          break;
        }
        default: {
          // Move to next step.
          ctx.session.linearConversation.step += 1;
          ctx.session.linearConversation.payload = result;
          if (
            this.steps[ctx.session.linearConversation.step]?.filter !==
            undefined
          ) {
            // This is a 'wait' step, so we wait for the next message from user.
            return;
          } else {
            // This is a 'proceed' step, it runs immediately.
            // Continue the cycle.
          }
        }
      }
    }

    // Interview is finished.
    ctx.session.linearConversation = undefined;
  }
}

class ConversationBuilder<C extends Context, P, IP> {
  readonly name: string;
  private readonly steps: Step<Context>[];

  constructor(name: string, steps: Step<Context>[], _: typeof SEALED) {
    this.name = name;
    this.steps = steps;
  }

  /**
   * Run a handler immediately after the previous step.
   * The handler can't repeat itself, because it doesn't wait
   * for any user input.
   */
  proceed<T>(
    func: (ctx: C, payload: P) => MaybePromise<T | typeof FINISH>,
  ): ConversationBuilder<C, T, IP> {
    this.steps.push({ func: func as any });
    return this as unknown as ConversationBuilder<C, T, IP>;
  }

  /**
   * Wait for the user to respond with a specific type of message,
   * then run a handler.
   */
  wait<F extends C, T>(
    filter: (ctx: C, payload: P) => ctx is F,
    func: (
      ctx: F,
      payload: P,
    ) => MaybePromise<T | typeof REPEAT | typeof FINISH>,
  ): ConversationBuilder<C, T, IP> {
    this.steps.push({ filter: filter as any, func: func as any });
    return this as unknown as ConversationBuilder<C, T, IP>;
  }

  /**
   * Wait for the user to respond with a specific type of message,
   * then run a handler.
   */
  waitFor<Q extends FilterQuery, T>(
    query: Q,
    func: (
      ctx: Filter<C, Q>,
      payload: P,
    ) => MaybePromise<T | typeof REPEAT | typeof FINISH>,
  ): ConversationBuilder<C, T, IP> {
    return this.wait(DefaultContext.has.filterQuery(query), func);
  }

  /**
   * Wait for the user to respond with a specific type of message,
   * then run a handler.
   */
  waitForTextOrCmd<Q extends FilterQuery, Cmd, T>(
    query: Q,
    allowedCommands: StringOrStringLiteral<Cmd>[],
    func: (
      ctx:
        | { ctx: Filter<C, "message:text">; command: Cmd }
        | { ctx: Filter<C, Q>; command: undefined },
      payload: P,
    ) => MaybePromise<T | typeof REPEAT | typeof FINISH>,
  ): ConversationBuilder<C, T, IP> {
    return this.wait(
      (ctx): ctx is C =>
        (ctx.has(query) && ctx.entities("bot_command").length === 0) ||
        (ctx.has("message:text") &&
          ctx.entities("bot_command").length === 1 &&
          allowedCommands.reduce(
            (prev, cmd) => prev || ctx.hasCommand(cmd),
            false,
          )),
      (ctx, payload) => {
        if (ctx.entities("bot_command").length > 0) {
          const { command } = /^\/?(?<command>[^@]*)/u.exec(
            ctx.entities("bot_command")[0].text,
          )!.groups!;
          return func(
            {
              ctx: ctx as Filter<C, "message:text">,
              command: command as Cmd,
            },
            payload,
          );
        } else {
          return func(
            {
              ctx: ctx as Filter<C, Q>,
              command: undefined,
            },
            payload,
          );
        }
      },
    );
  }

  /**
   * Strip away all type information about the previous conversation step
   * and return a simple conversation object that can be user as a middleware.
   */
  build(): Conversation<IP> {
    return new Conversation(this.name, this.steps, SEALED);
  }
}

export function conversation<P = undefined>(name: string) {
  return new ConversationBuilder<Context, P, P>(name, [], SEALED);
}

export async function prompt(
  ctx: Context,
  prompt: string,
  editMenu: boolean | undefined = true,
  other: Other<
    "editMessageText",
    | "chat_id"
    | "message_id"
    | "message_thread_id"
    | "inline_message_id"
    | "text"
    | "reply_markup"
  > = {},
) {
  if (ctx.menu !== undefined && editMenu) {
    await editMessageTextSafe(ctx, prompt, {
      reply_markup: new InlineKeyboard(),
      ...other,
    });
  } else {
    await ctx.reply(prompt, {
      message_thread_id: ctx.msg?.message_thread_id,
      ...other,
    });
  }
}
