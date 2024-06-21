import { Composer } from "grammy";

import { UserStatus, updateUser } from "#root/backend/user.js";
import type { Context } from "#root/bot/context.js";
import { ensureHasAdminGroupTopic } from "#root/bot/features/admin-group.js";
import { postInterviewSignup } from "#root/bot/features/event-signup.js";
import { interviewConversation } from "#root/bot/features/interview-v2.js";
import { logHandle } from "#root/bot/helpers/logging.js";

export const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("start", logHandle("command-start"), async (ctx) => {
  const command = /^\/start(?:@[a-zA-Z_]*)?\s+(?<eventId>\d+)\s*$/u.exec(
    ctx.message.text,
  );
  const eventId = command ? Number(command.groups!.eventId) : undefined;

  if (eventId !== undefined) {
    await updateUser(ctx.user.id, { pendingSignup: eventId });
  }

  if (ctx.user.status === UserStatus.New) {
    await interviewConversation.forceEnter(ctx);
  } else {
    await ensureHasAdminGroupTopic(null, ctx, ctx.user);

    if (ctx.user.status === UserStatus.InterviewInProgress) {
      await ctx.reply(ctx.t("welcome.in_progress"));
    } else if (eventId !== undefined) {
      await postInterviewSignup(null, ctx);
    } else {
      await ctx.reply(ctx.t("welcome.all_set"));
    }
  }
});
