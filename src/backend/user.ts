import { orm } from "#root/backend/data-source.js";
import { User, UserLite } from "#root/backend/entities/user.js";

export { User, UserLite, UserStatus } from "#root/backend/entities/user.js";

export async function getUserLite(id: number): Promise<UserLite> {
  const result = await orm.em.findOne(UserLite, { id });

  if (result === null) {
    await orm.em.persistAndFlush(new User(id));
    return orm.em.findOneOrFail(UserLite, { id });
  }

  return result;
}

export async function getUserOrFail(id: number): Promise<User> {
  return orm.em.findOneOrFail(User, { id });
}

export async function updateUser(id: number, data: Partial<Omit<User, "id">>) {
  const user = await orm.em.findOneOrFail(User, { id });
  Object.assign(user, data);
  await orm.em.flush();
}

export async function setUserAdminGroupTopicId(id: number, topicId: number) {
  await updateUser(id, { adminGroupTopic: topicId });
}

export async function setUserName(id: number, name: string) {
  await updateUser(id, { name: name.trim() });
}

export async function setUserPronouns(id: number, pronouns: string) {
  await updateUser(id, { pronouns: normalizeIdentity(pronouns) });
}

export async function setUserGender(id: number, gender: string) {
  await updateUser(id, { gender: normalizeIdentity(gender) });
}

export async function setUserSexuality(id: number, sexuality: string) {
  await updateUser(id, { sexuality: normalizeIdentity(sexuality) });
}

const normalizeIdentity = (s: string) => {
  return s
    .replaceAll(/\p{Emoji}/gu, "")
    .replaceAll(/\s+/gu, " ")
    .replaceAll(/\s*?\/\s*/gu, "/")
    .trim()
    .toLowerCase();
};

export async function getUserLiteByAdminGroupTopic(
  adminGroupTopic: number,
): Promise<UserLite | null> {
  return orm.em.findOne(UserLite, { adminGroupTopic });
}

export async function getUserByAdminGroupTopicOrFail(
  adminGroupTopic: number,
): Promise<User> {
  return orm.em.findOneOrFail(User, { adminGroupTopic });
}
