import { EntityDTO, wrap, Reference } from "@mikro-orm/core";

import { orm } from "#root/backend/data-source.js";
import { Invitation as InvitationObject } from "./entities/invitation.js";

export type Invitation = EntityDTO<InvitationObject>;

export async function getInvitation(id: number): Promise<Invitation | null> {
  const invitation = await orm.em.findOne(InvitationObject, { id });
  return invitation === null ? null : wrap(invitation).toObject();
}

export async function findInvitation(username: string): Promise<Invitation | null> {
  const invitation = await orm.em.findOne(InvitationObject, { username });
  return invitation === null ? null : wrap(invitation).toObject();
}

export function dropInvitation(id: number) {
  orm.em.remove(Reference.createFromPK(InvitationObject, id));
}

export async function updateInvitation(
  id: number,
  data: Partial<Omit<Invitation, "id">>,
): Promise<Invitation> {
  const invitation = await orm.em.findOneOrFail(InvitationObject, { id });
  return wrap(invitation).assign(data);
}
