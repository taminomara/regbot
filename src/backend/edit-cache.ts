import { EntityDTO, wrap } from "@mikro-orm/core";

import { orm } from "#root/backend/data-source.js";
import { EditCache as EditCacheObject } from "#root/backend/entities/edit-cache.js";

export type EditCache = EntityDTO<EditCacheObject>;

export async function saveCopiedMessageId(
  originId: number,
  originChatId: number,
  destinationId: number,
  destinationChatId: number,
) {
  orm.em.persist(
    new EditCacheObject(
      originId,
      originChatId,
      destinationId,
      destinationChatId,
    ),
  );
  orm.em.persist(
    new EditCacheObject(
      destinationId,
      destinationChatId,
      originId,
      originChatId,
    ),
  );
}

export async function findCopiedMessagesByOriginId(
  originId: number,
  originChatId: number,
): Promise<EditCache[]> {
  return (await orm.em.find(EditCacheObject, { originId, originChatId })).map(
    (o) => wrap(o).toObject(),
  );
}

export async function findCopiedMessagesByOriginIdAndDestinationChatId(
  originId: number,
  originChatId: number,
  destinationChatId: number,
): Promise<EditCache[]> {
  return (
    await orm.em.find(EditCacheObject, {
      originId,
      originChatId,
      destinationChatId,
    })
  ).map((o) => wrap(o).toObject());
}
