import { EntityDTO, wrap } from "@mikro-orm/core";

import { orm } from "#root/backend/data-source.js";
import {
  UserLite as UserLiteObject,
  User as UserObject,
  UserStatus,
} from "#root/backend/entities/user.js";
import { cancelAllFutureSignupsForUser } from "#root/backend/event.js";

export { UserStatus } from "#root/backend/entities/user.js";
export type UserLite = EntityDTO<UserLiteObject>;
export type User = EntityDTO<UserObject>;

export async function getUserLite(
  id: number,
  defaultName?: string,
): Promise<UserLite> {
  const result = await orm.em.findOne(UserLiteObject, { id });
  return result === null ? createUser(id, defaultName) : result;
}

export async function getOrInsertUserLite(
  id: number,
  defaultName?: string,
): Promise<[UserLite, boolean]> {
  const result = await orm.em.findOne(UserLiteObject, { id });
  return result === null
    ? [await createUser(id, defaultName), true]
    : [result, false];
}

export async function createUser(id: number, name?: string): Promise<UserLite> {
  const user = await orm.em.upsert(
    UserObject,
    { id, name },
    { onConflictAction: "ignore" },
  );
  return wrap(orm.em.create(UserLiteObject, user)).toObject();
}

export async function getUser(id: number): Promise<User | null> {
  const user = await orm.em.findOne(UserObject, { id });
  return user === null ? null : wrap(user).toObject();
}

export async function getUserOrFail(id: number): Promise<User> {
  return wrap(await orm.em.findOneOrFail(UserObject, { id })).toObject();
}

export async function updateUser(
  id: number,
  data: Partial<Omit<User, "id">>,
): Promise<User> {
  const user = await orm.em.findOneOrFail(UserObject, { id });
  return wrap(user).assign(data);
}

export async function setUserAdminGroupTopicId(
  id: number,
  topicId: number,
): Promise<User> {
  return updateUser(id, { adminGroupTopic: topicId });
}

export async function approveUser(id: number, adminId: number): Promise<User> {
  return updateUser(id, {
    status: UserStatus.Approved,
    verifiedBy: adminId,
    verifiedAt: new Date(),
  });
}

export async function rejectUser(id: number, adminId: number): Promise<User> {
  return updateUser(id, {
    status: UserStatus.Rejected,
    verifiedBy: adminId,
    verifiedAt: new Date(),
  });
}

export async function banUser(
  id: number,
  adminId: number,
  banReason: string,
): Promise<User> {
  await cancelAllFutureSignupsForUser(id);
  return updateUser(id, {
    status: UserStatus.Banned,
    bannedBy: adminId,
    bannedAt: new Date(),
    canManageEvents: false,
    canManageInterviews: false,
    banReason,
  });
}

export async function unbanUser(id: number, adminId: number): Promise<User> {
  return updateUser(id, {
    status: UserStatus.Approved,
    verifiedBy: adminId,
    verifiedAt: new Date(),
  });
}

export async function setUserName(id: number, name: string): Promise<User> {
  return updateUser(id, { name: name.trim() });
}

export async function setUserPronouns(
  id: number,
  pronouns: string,
): Promise<User> {
  return updateUser(id, { pronouns: normalizeIdentity(pronouns) });
}

export async function setUserGender(id: number, gender: string): Promise<User> {
  return updateUser(id, { gender: normalizeIdentity(gender) });
}

export async function setUserSexuality(
  id: number,
  sexuality: string,
): Promise<User> {
  return updateUser(id, { sexuality: normalizeIdentity(sexuality) });
}

export async function setUserPositioning(
  id: number,
  positioning: string,
): Promise<User> {
  return updateUser(id, { positioning: normalizeIdentity(positioning) });
}

const normalizeIdentity = (s: string) => {
  return s
    .replaceAll(/^[🌻🌸🪻🌿🐝🦊🐨🧁🍩🍉🥑😈🥺🙃]/gu, "")
    .replaceAll(/\s+/gu, " ")
    .replaceAll(/\s*?\/\s*/gu, "/")
    .trim()
    .toLowerCase();
};

export async function getUserLiteByAdminGroupTopic(
  adminGroupTopic: number,
): Promise<UserLite | null> {
  const userLite = await orm.em.findOne(UserLiteObject, { adminGroupTopic });
  return userLite === null ? null : wrap(userLite).toObject();
}

export async function getUserByAdminGroupTopic(
  adminGroupTopic: number,
): Promise<User | null> {
  const user = await orm.em.findOne(UserObject, { adminGroupTopic });
  return user === null ? null : wrap(user).toObject();
}
