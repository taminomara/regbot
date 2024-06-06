import { or } from "grammy-guard";

import { UserStatus } from "#root/backend/entities/user.js";
import { Context } from "#root/bot/context.js";
import { isAdmin } from "#root/bot/filters/is-admin.js";

export const isApproved = or(
  isAdmin,
  (ctx: Context) => ctx.user.status === UserStatus.Approved,
);
