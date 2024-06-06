import { BotCommand } from "@grammyjs/types";
import { Composer } from "grammy";

import { UserStatus, updateUser } from "#root/backend/user.js";
import type { Context } from "#root/bot/context.js";
import { ensureHasAdminGroupTopic } from "#root/bot/features/admin-group.js";
import { signupForEvent } from "#root/bot/features/event-signup.js";
import { registerCommandHelpProvider } from "#root/bot/features/help.js";
import { enterInterview } from "#root/bot/features/interview.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

export const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("start", logHandle("command-start"), async (ctx) => {
  const command = /^\/start\s+(?<eventId>\d+)\s*$/u.exec(ctx.message.text);
  const eventId = command ? Number(command.groups!.eventId) : undefined;

  if (eventId !== undefined) {
    if (ctx.session.postInterviewSignupEventId === undefined) {
      ctx.session.postInterviewSignupEventId = [];
    }
    ctx.session.postInterviewSignupEventId.push(eventId);
  }

  if (
    !("interview" in (await ctx.conversation.active())) &&
    (!ctx.user.finishedInitialSurvey ||
      [UserStatus.New, UserStatus.InterviewInProgress].includes(
        ctx.user.status,
      ))
  ) {
    // Allow manually approved people in.
    const chatMember = await ctx.api.getChatMember(
      config.MEMBERS_GROUP,
      ctx.user.id,
    );
    if (["member", "creator", "administrator"].includes(chatMember.status)) {
      ctx.user.status = UserStatus.Approved;
      await updateUser(ctx.user.id, { status: UserStatus.Approved });
    }

    // Start an interview.
    await ctx.reply(ctx.t("welcome"));
    await enterInterview(ctx);
  } else {
    await ensureHasAdminGroupTopic(null, ctx, ctx.user);

    if ("interview" in (await ctx.conversation.active())) {
      await ctx.reply(ctx.t("welcome.in_progress"));
    } else if (!ctx.session.postInterviewSignupEventId?.length) {
      await ctx.reply(ctx.t("welcome.all_set"));
    } else {
      for (const eventId of new Set(ctx.session.postInterviewSignupEventId)) {
        await signupForEvent(ctx, eventId);
      }
      ctx.session.postInterviewSignupEventId = undefined;
    }
  }
});

registerCommandHelpProvider((localeCode: string): BotCommand[] => {
  return [
    {
      command: "start",
      description: i18n.t(localeCode, "start_command.description"),
    },
  ];
});
