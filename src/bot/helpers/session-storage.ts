import { Enhance, StorageAdapter } from "grammy";

import { del, read, write } from "#root/backend/session.js";

export type Payload =
  | string
  | number
  | boolean
  | null
  | undefined
  | void
  | Date
  | { [key: string]: Payload }
  | Payload[];

export class SessionStorage<P extends Payload>
  implements StorageAdapter<Enhance<P>>
{
  async delete(key: string): Promise<void> {
    return del(key);
  }

  async read(key: string): Promise<Enhance<P> | undefined> {
    const data = await read(key);
    return data === undefined
      ? data
      : (JSON.parse(data, reviver) as Enhance<P>);
  }

  async write(key: string, value: Enhance<P>): Promise<void> {
    return write(key, JSON.stringify(value, replacer));
  }
}

function replacer(key: string, value: unknown) {
  return value instanceof Date ? { $date: value.toUTCString() } : value;
}

function reviver(key: string, value: unknown) {
  if (
    value !== null &&
    typeof value === "object" &&
    Object.keys(value).length === 1 &&
    "$date" in value &&
    typeof value.$date === "string"
  ) {
    return new Date(value.$date);
  } else {
    return value;
  }
}
