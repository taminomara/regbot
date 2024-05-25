import { orm } from "#root/backend/data-source.js";
import { EditCache } from "#root/backend/entities/edit-cache.js";

export async function saveCopiedMessageId(
  originId: number,
  originChatId: number,
  destinationId: number,
  destinationChatId: number,
) {
  await orm.em.persistAndFlush(
    new EditCache(originId, originChatId, destinationId, destinationChatId),
  );
}

export async function findCopiedMessagesByOriginId(
  originId: number,
  originChatId: number,
) {
  return orm.em.find(EditCache, { originId, originChatId });
}
