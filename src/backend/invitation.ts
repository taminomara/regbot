import { EntityDTO, Reference, wrap } from "@mikro-orm/core";

import { orm } from "#root/backend/data-source.js";

import { Invitation as InvitationObject } from "./entities/invitation.js";

export type Invitation = EntityDTO<InvitationObject>;

export async function findInvitation(
  username: string,
): Promise<Invitation | null> {
  const invitation = await orm.em.findOne(InvitationObject, { username });
  return invitation === null ? null : wrap(invitation).toObject();
}

export function dropInvitation(id: number) {
  orm.em.remove(Reference.createFromPK(InvitationObject, id));
}
