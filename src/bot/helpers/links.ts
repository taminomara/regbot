export function userLink(userId: number | undefined | null): string {
  return !userId ? "" : `tg://user?id=${userId}`;
}

export function signupLink(
  botUsername: string,
  eventId: number | undefined | null,
): string {
  return !eventId ? "" : `https://t.me/${botUsername}?start=${eventId}`;
}

export function messageLink(
  chatId: number,
  messageId: number | undefined | null,
): string {
  return chatId >= 0 || !messageId
    ? ""
    : `https://t.me/c/${chatId.toString().slice(4)}/${messageId}`;
}
