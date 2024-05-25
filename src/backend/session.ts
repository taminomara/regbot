import { orm } from "#root/backend/data-source.js";
import { Session } from "#root/backend/entities/session.js";

export async function del(key: string) {
  await orm.em.nativeDelete(Session, { key });
}

export async function read(key: string): Promise<unknown | undefined> {
  const data = await orm.em.findOne(Session, { key });
  return data === null ? undefined : JSON.parse(data.data);
}

export async function write(key: string, value: unknown) {
  const data = JSON.stringify(value);
  await orm.em.upsert(Session, { key, data });
  await orm.em.flush();
}
