import { session as defaultSession, enhanceStorage } from "grammy";

import { Context } from "#root/bot/context.js";
import { SessionStorage } from "#root/bot/helpers/session-storage.js";
import { config } from "#root/config.js";

export type SessionData = {
  linearConversation?: {
    name: string;
    step: number;
    payload: unknown;
  };
};

export function getSessionKey(ctx: Omit<Context, "session">) {
  return ctx.chatId === config.ADMIN_GROUP
    ? `${ctx.chatId}/${ctx.msg?.message_thread_id}`
    : ctx.chat?.id.toString();
}

export function session() {
  return defaultSession<SessionData, Context>({
    initial: (): SessionData => ({}),
    storage: enhanceStorage({
      storage: new SessionStorage(),
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
            name: "interview",
            payload: undefined,
            step: old.interviewStep,
          },
  };
}
