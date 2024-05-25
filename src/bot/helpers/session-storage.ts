import { StorageAdapter } from "grammy";

import { del, read, write } from "#root/backend/session.js";

export class SessionStorage implements StorageAdapter<unknown> {
  async delete(key: string): Promise<void> {
    return del(key);
  }

  async read(key: string): Promise<unknown | undefined> {
    return read(key);
  }

  async write(key: string, value: unknown): Promise<void> {
    return write(key, value);
  }
}
