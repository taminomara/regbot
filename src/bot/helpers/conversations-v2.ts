// /**
//  * Simple linear conversations, finite state-machine style.
//  */
// import { Context as DefaultContext, Filter, FilterQuery } from "grammy";
//
// import { Context } from "#root/bot/context.js";
//
// export enum InterviewStepResult {
//   DoNext,
//   WaitForResponseAndDoNext,
//   WaitForResponseAndRepeat,
//   Finish,
// }
//
// export class InterviewStep<C extends Context = Context> {
//   readonly filter: (ctx: Context) => ctx is C;
//   readonly func: (ctx: C) => InterviewStepResult;
//
//   constructor(
//     filter: (ctx: Context) => ctx is C,
//     func: (ctx: C) => InterviewStepResult,
//   ) {
//     this.filter = filter;
//     this.func = func;
//   }
//
//   static filter<Q extends FilterQuery>(
//     func: (ctx: Filter<Context, Q>) => InterviewStepResult,
//   ) {
//     return new InterviewStep(DefaultContext.has.filterQuery(Q), func);
//   }
// }
