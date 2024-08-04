import { orm } from "#root/backend/data-source.js";
import { Session } from "#root/backend/entities/session.js";

export async function del(key: string) {
  await orm.em.nativeDelete(Session, { key });
}

export async function read(key: string): Promise<string | undefined> {
  const data = await orm.em.findOne(Session, { key });
  return data === null ? undefined : data.data;
}

export async function write(key: string, data: string) {
  await orm.em.upsert(Session, { key, data });
  await orm.em.flush();
}
