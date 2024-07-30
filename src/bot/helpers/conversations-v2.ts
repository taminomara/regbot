/**
 * Simple linear conversations, finite state machine style.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CallbackQueryContext,
  CommandContext,
  Composer,
  Context,
  Filter,
  FilterQuery,
  HearsContext,
  Middleware,
  MiddlewareFn,
  MiddlewareObj,
  SessionFlavor,
} from "grammy";

export type LinearConversationSessionData = {
  linearConversation?: {
    name: string;
    step: number;
    payload: unknown;
  };
};
type LinearConversationContext = Context &
  SessionFlavor<LinearConversationSessionData>;

const SEALED = Symbol("SEALED");

const REPEAT = Symbol("REPEAT");
type Repeat<P> = { __conversationAction: typeof REPEAT; payload: P };
function isRepeat(t: any): t is Repeat<any> {
  return t?.__conversationAction === REPEAT;
}

/**
 * Return this from a step handler to repeat it.
 */
export function repeatConversationStep(): Repeat<undefined>;
export function repeatConversationStep<P>(payload: P): Repeat<P>;
export function repeatConversationStep<P>(payload?: P): Repeat<P | undefined> {
  return { __conversationAction: REPEAT, payload };
}

const FINISH = Symbol("FINISH");
type Finish = { __conversationAction: typeof FINISH };
function isFinish(t: any): t is Finish {
  return t?.__conversationAction === FINISH;
}

/**
 * Return this from a step handler to finish the conversation.
 */
export function finishConversation(): Finish {
  return { __conversationAction: FINISH };
}

type Next<T> = T extends Finish ? never : T extends Repeat<any> ? never : T;

export type MaybePromise<T> = T | Promise<T>;
export type MaybeArray<T> = T | T[];

type Step<C> = {
  filter?: (ctx: C, payload: any) => MaybePromise<boolean>;
  func: (ctx: C, payload: any) => MaybePromise<any | Repeat<any> | Finish>;
};

/**
 * Conversation object.
 *
 * Use this object as a middleware in your composer or a bot. Then in your handlers,
 * call `enter` or `forceEnter` to start a conversation.
 *
 * @example
 *
 * Build a conversation and `use` it in your bot:
 *
 * ```ts
 * const composer = new Composer();
 *
 * const myConversation = conversation("myConversation")
 *  // ... build conversation steps
 *  .build();
 * composer.use(myConversation);
 * ```
 *
 * Then start a conversation from somewhere else:
 *
 * ```
 * composer.command("my_command", async (ctx) => {
 *   await myConversation.enter(ctx);
 * });
 * ```
 */
export class Conversation<C extends LinearConversationContext, IP>
  implements MiddlewareObj<C>
{
  /**
   * Unique name of this conversation.
   */
  readonly name: string;

  private readonly steps: Step<C>[];
  private readonly middlewares: Middleware<C>[];

  /** @private */
  constructor(
    name: string,
    steps: Step<C>[],
    middlewares: Middleware<C>[],
    _: typeof SEALED,
  ) {
    this.name = name;
    this.steps = steps;
    this.middlewares = middlewares;
  }

  /**
   * Start this conversation. If another conversation is currently running,
   * force-stop it.
   */
  async forceEnter(
    ctx: C,
    ...args: IP extends undefined ? [payload?: IP] : [payload: IP]
  ) {
    ctx.session.linearConversation = undefined;
    await this.enter(ctx, ...args);
  }

  /**
   * Start this conversation. If another conversation is currently running,
   * raise an error.
   */
  async enter(
    ctx: C,
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

  private async filter(ctx: C) {
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

  private async run(ctx: C) {
    if (ctx.session.linearConversation === undefined) return;
    if (ctx.session.linearConversation.name !== this.name) return;

    // When we enter this cycle, the context is already filtered
    // by the current step's filter. This cycle repeats for
    // all the 'proceed' steps following after this one.
    // If we encounter a 'wait' step, we return from this function
    // and wait for the next message that passes this 'wait' step's filter.
    while (ctx.session.linearConversation.step < this.steps.length) {
      const { func } = this.steps[ctx.session.linearConversation.step];
      const result = await func(ctx, ctx.session.linearConversation.payload);
      if (isRepeat(result)) {
        // Repeat the same step after user gives their answer.
        ctx.session.linearConversation.payload = result.payload;
        return;
      } else if (isFinish(result)) {
        // Finish the conversation early, i.e. break out of this cycle.
        break;
      } else {
        // Move to next step.
        ctx.session.linearConversation.step += 1;
        ctx.session.linearConversation.payload = result;
        if (
          this.steps[ctx.session.linearConversation.step]?.filter !== undefined
        ) {
          // This is a 'wait' step, so we wait for the next message from user.
          return;
        } else {
          // This is a 'proceed' step, it runs immediately.
          continue;
        }
      }
    }

    // Conversation is finished.
    ctx.session.linearConversation = undefined;
  }

  middleware(): MiddlewareFn<C> {
    const composer = new Composer<C>();
    composer
      .filter(async (ctx) => this.filter(ctx))
      .use(...this.middlewares)
      .use(async (ctx) => this.run(ctx));
    return composer.middleware();
  }
}

class ConversationBuilder<C extends LinearConversationContext, P, IP> {
  /**
   * Unique name of this conversation.
   */
  readonly name: string;

  private readonly steps: Step<LinearConversationContext>[];
  private readonly middlewares: Middleware<C>[];

  /** @private */
  constructor(
    name: string,
    steps: Step<LinearConversationContext>[],
    middlewares: Middleware<C>[],
    _: typeof SEALED,
  ) {
    this.name = name;
    this.steps = steps;
    this.middlewares = middlewares;
  }

  /**
   * Run a handler immediately after the previous step.
   * The handler can't repeat itself, because it doesn't wait
   * for any user input.
   */
  proceed(
    func: (ctx: C, payload: P) => MaybePromise<Finish>,
  ): ConversationBuilder<C, never, IP>;
  proceed<T>(
    func: (ctx: C, payload: P) => MaybePromise<Next<T> | Finish>,
  ): ConversationBuilder<C, T, IP>;
  proceed<T>(func: (ctx: C, payload: P) => MaybePromise<Next<T> | Finish>) {
    this.steps.push({ func: func as any });
    return this as unknown as ConversationBuilder<C, T, IP>;
  }

  /**
   * Wait for the user to respond with a specific type of message,
   * then run a handler.
   */
  wait<F extends C>(
    filter: (ctx: C, payload: P) => ctx is F,
    func: (ctx: F, payload: P) => MaybePromise<Repeat<P> | Finish>,
  ): ConversationBuilder<C, never, IP>;
  wait<F extends C, T>(
    filter: (ctx: C, payload: P) => ctx is F,
    func: (ctx: F, payload: P) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ): ConversationBuilder<C, T, IP>;
  wait<F extends C, T>(
    filter: (ctx: C, payload: P) => ctx is F,
    func: (ctx: F, payload: P) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ) {
    this.steps.push({ filter: filter as any, func: func as any });
    return this as unknown as ConversationBuilder<C, T, IP>;
  }

  waitFilterQuery<Q extends FilterQuery>(
    filter: Q | Q[],
    func: (ctx: Filter<C, Q>, payload: P) => MaybePromise<Repeat<P> | Finish>,
  ): ConversationBuilder<C, never, IP>;
  waitFilterQuery<Q extends FilterQuery, T>(
    filter: Q | Q[],
    func: (
      ctx: Filter<C, Q>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ): ConversationBuilder<C, T, IP>;
  waitFilterQuery<Q extends FilterQuery, T>(
    filter: Q | Q[],
    func: (
      ctx: Filter<C, Q>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ) {
    return this.wait(Context.has.filterQuery(filter), func);
  }

  waitFilterQueryIgnoreCmd<Q extends FilterQuery>(
    filter: Q | Q[],
    func: (ctx: Filter<C, Q>, payload: P) => MaybePromise<Repeat<P> | Finish>,
  ): ConversationBuilder<C, never, IP>;
  waitFilterQueryIgnoreCmd<Q extends FilterQuery, T>(
    filter: Q | Q[],
    func: (
      ctx: Filter<C, Q>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ): ConversationBuilder<C, T, IP>;
  waitFilterQueryIgnoreCmd<Q extends FilterQuery, T>(
    filter: Q | Q[],
    func: (
      ctx: Filter<C, Q>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ) {
    return this.wait(
      (ctx): ctx is Filter<C, Q> =>
        ctx.has(filter) && !ctx.has("::bot_command"),
      func,
    );
  }

  waitText(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: HearsContext<C>,
      payload: P,
    ) => MaybePromise<Repeat<P> | Finish>,
  ): ConversationBuilder<C, never, IP>;
  waitText<T>(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: HearsContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ): ConversationBuilder<C, T, IP>;
  waitText<T>(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: HearsContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ) {
    return this.wait(Context.has.text(trigger), func);
  }

  waitTextIgnoreCommand(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: HearsContext<C>,
      payload: P,
    ) => MaybePromise<Repeat<P> | Finish>,
  ): ConversationBuilder<C, never, IP>;
  waitTextIgnoreCommand<T>(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: HearsContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ): ConversationBuilder<C, T, IP>;
  waitTextIgnoreCommand<T>(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: HearsContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ) {
    return this.wait(
      (ctx): ctx is HearsContext<C> =>
        ctx.hasText(trigger) && !ctx.has("::bot_command"),
      func,
    );
  }

  waitCommand(
    command: MaybeArray<string>,
    func: (
      ctx: CommandContext<C>,
      payload: P,
    ) => MaybePromise<Repeat<P> | Finish>,
  ): ConversationBuilder<C, never, IP>;
  waitCommand<T>(
    command: MaybeArray<string>,
    func: (
      ctx: CommandContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ): ConversationBuilder<C, T, IP>;
  waitCommand<T>(
    command: MaybeArray<string>,
    func: (
      ctx: CommandContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ) {
    return this.wait(Context.has.command(command), func);
  }

  waitCallbackQuery(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: CallbackQueryContext<C>,
      payload: P,
    ) => MaybePromise<Repeat<P> | Finish>,
  ): ConversationBuilder<C, never, IP>;
  waitCallbackQuery<T>(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: CallbackQueryContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ): ConversationBuilder<C, T, IP>;
  waitCallbackQuery<T>(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: CallbackQueryContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ) {
    return this.wait(Context.has.callbackQuery(trigger), func);
  }

  either(): EitherBuilder<C, P, IP> {
    return new EitherBuilder(this, SEALED);
  }

  /**
   * Strip away all type information about the previous conversation step
   * and return a simple conversation object that can be user as a middleware.
   */
  build(): Conversation<C, IP> {
    return new Conversation(this.name, this.steps, this.middlewares, SEALED);
  }
}

class EitherBuilder<C extends LinearConversationContext, P, IP, RP = never> {
  private readonly builder: ConversationBuilder<C, P, IP>;
  private readonly options: Step<C>[];

  /** @private */
  constructor(builder: ConversationBuilder<C, P, IP>, _: typeof SEALED) {
    this.builder = builder;
    this.options = [];
  }

  wait<F extends C>(
    filter: (ctx: C, payload: P) => ctx is F,
    func: (ctx: F, payload: P) => MaybePromise<Repeat<P> | Finish>,
  ): EitherBuilder<C, P, IP, RP>;
  wait<F extends C, T>(
    filter: (ctx: C, payload: P) => ctx is F,
    func: (ctx: F, payload: P) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ): EitherBuilder<C, P, IP, RP | T>;
  wait<F extends C, T>(
    filter: (ctx: C, payload: P) => ctx is F,
    func: (ctx: F, payload: P) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ) {
    this.options.push({ filter: filter as any, func: func as any });
    return this as unknown as EitherBuilder<C, P, IP, RP | T>;
  }

  waitFilterQuery<Q extends FilterQuery>(
    filter: Q | Q[],
    func: (ctx: Filter<C, Q>, payload: P) => MaybePromise<Repeat<P> | Finish>,
  ): EitherBuilder<C, P, IP, RP>;
  waitFilterQuery<Q extends FilterQuery, T>(
    filter: Q | Q[],
    func: (
      ctx: Filter<C, Q>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ): EitherBuilder<C, P, IP, RP | T>;
  waitFilterQuery<Q extends FilterQuery, T>(
    filter: Q | Q[],
    func: (
      ctx: Filter<C, Q>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ) {
    return this.wait(Context.has.filterQuery(filter), func);
  }

  waitFilterQueryIgnoreCmd<Q extends FilterQuery>(
    filter: Q | Q[],
    func: (ctx: Filter<C, Q>, payload: P) => MaybePromise<Repeat<P> | Finish>,
  ): EitherBuilder<C, P, IP, RP>;
  waitFilterQueryIgnoreCmd<Q extends FilterQuery, T>(
    filter: Q | Q[],
    func: (
      ctx: Filter<C, Q>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ): EitherBuilder<C, P, IP, RP | T>;
  waitFilterQueryIgnoreCmd<Q extends FilterQuery, T>(
    filter: Q | Q[],
    func: (
      ctx: Filter<C, Q>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ) {
    return this.wait(
      (ctx): ctx is Filter<C, Q> =>
        ctx.has(filter) && !ctx.has("::bot_command"),
      func,
    );
  }

  waitText(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: HearsContext<C>,
      payload: P,
    ) => MaybePromise<Repeat<P> | Finish>,
  ): EitherBuilder<C, P, IP, RP>;
  waitText<T>(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: HearsContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ): EitherBuilder<C, P, IP, RP | T>;
  waitText<T>(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: HearsContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ) {
    return this.wait(Context.has.text(trigger), func);
  }

  waitTextIgnoreCommand(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: HearsContext<C>,
      payload: P,
    ) => MaybePromise<Repeat<P> | Finish>,
  ): EitherBuilder<C, P, IP, RP>;
  waitTextIgnoreCommand<T>(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: HearsContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ): EitherBuilder<C, P, IP, RP | T>;
  waitTextIgnoreCommand<T>(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: HearsContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ) {
    return this.wait(
      (ctx): ctx is HearsContext<C> =>
        ctx.hasText(trigger) && !ctx.has("::bot_command"),
      func,
    );
  }

  waitCommand(
    command: MaybeArray<string>,
    func: (
      ctx: CommandContext<C>,
      payload: P,
    ) => MaybePromise<Repeat<P> | Finish>,
  ): EitherBuilder<C, P, IP, RP>;
  waitCommand<T>(
    command: MaybeArray<string>,
    func: (
      ctx: CommandContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ): EitherBuilder<C, P, IP, RP | T>;
  waitCommand<T>(
    command: MaybeArray<string>,
    func: (
      ctx: CommandContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ) {
    return this.wait(Context.has.command(command), func);
  }

  waitCallbackQuery(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: CallbackQueryContext<C>,
      payload: P,
    ) => MaybePromise<Repeat<P> | Finish>,
  ): EitherBuilder<C, P, IP, RP>;
  waitCallbackQuery<T>(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: CallbackQueryContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ): EitherBuilder<C, P, IP, RP | T>;
  waitCallbackQuery<T>(
    trigger: MaybeArray<string | RegExp>,
    func: (
      ctx: CallbackQueryContext<C>,
      payload: P,
    ) => MaybePromise<Next<T> | Repeat<P> | Finish>,
  ) {
    return this.wait(Context.has.callbackQuery(trigger), func);
  }

  done() {
    return this.builder.wait(
      (ctx: C, payload: P): ctx is C => {
        for (const { filter } of this.options) {
          if (filter === undefined || filter(ctx, payload)) {
            return true;
          }
        }
        return false;
      },
      (ctx: C, payload: P): Next<RP> | Repeat<P> | Finish => {
        for (const { filter, func } of this.options) {
          if (filter === undefined || filter(ctx, payload)) {
            return func(ctx, payload);
          }
        }
        throw new Error("non-deterministic filter");
      },
    );
  }
}

/**
 * Create a new conversation builder. Name of the conversation should be unique.
 */
export function conversation<
  C extends LinearConversationContext,
  P = undefined,
>(name: string, ...args: Middleware<C>[]) {
  return new ConversationBuilder<C, P, P>(name, [], args, SEALED);
}
