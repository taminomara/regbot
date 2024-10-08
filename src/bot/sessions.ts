import { session as defaultSession, enhanceStorage } from "grammy";

import { Context } from "#root/bot/context.js";
import { SessionStorage } from "#root/bot/helpers/session-storage.js";
import { config } from "#root/config.js";

import { LinearConversationSessionData } from "./helpers/conversations-v2.js";

export type SessionData = LinearConversationSessionData;

export function getSessionKey(ctx: Omit<Context, "session">) {
  return ctx.chatId === config.ADMIN_GROUP
    ? `${ctx.chatId}/${ctx.msg?.message_thread_id}`
    : ctx.chat?.id.toString();
}

export function session() {
  return defaultSession<SessionData, Context>({
    initial: (): SessionData => ({}),
    storage: enhanceStorage({
      storage: new SessionStorage<SessionData>(),
      migrations: {
        1: migration1NewInterviewEngine,
      },
    }),
    getSessionKey,
  });
}

type SessionDataV0 = { interviewStep?: number };
function migration1NewInterviewEngine(old: SessionDataV0): SessionData {
  return {
    linearConversation:
      old.interviewStep === undefined
        ? undefined
        : {
            id: 0,
            name: "interview",
            payload: undefined,
            step: old.interviewStep,
          },
  };
}
