import { Enhance, StorageAdapter } from "grammy";

import { del, read, write } from "#root/backend/session.js";
import { SessionData } from "#root/bot/sessions.js";

type SessionDataExtended = Enhance<SessionData & { [key: string]: unknown }>;

export class SessionStorage implements StorageAdapter<SessionDataExtended> {
  async delete(key: string): Promise<void> {
    return del(key);
  }

  async read(key: string): Promise<SessionDataExtended | undefined> {
    return (await read(key)) as SessionDataExtended;
  }

  async write(key: string, value: SessionDataExtended): Promise<void> {
    return write(key, value);
  }
}
