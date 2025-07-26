import { isUserHasId, or } from "grammy-guard";

import { UserStatus } from "#root/backend/entities/user.js";
import { Context } from "#root/bot/context.js";
import { config } from "#root/config.js";

export const isAdmin = isUserHasId(...config.BOT_ADMINS);

export const isApproved = or(
  isAdmin,
  (ctx: Context) => ctx.user.status === UserStatus.Approved,
);

export const isNew = (ctx: Context) => ctx.user.status === UserStatus.New;

export const isInterviewInProgress = (ctx: Context) =>
  ctx.user.status === UserStatus.InterviewInProgress;

export const isInterviewFinished = (ctx: Context) =>
  ctx.user.status === UserStatus.PendingApproval;
