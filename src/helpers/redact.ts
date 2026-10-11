export function redactBotToken(line: string, token: string): string {
  if (!token) return line;
  const botId = token.split(":")[0];
  return line.replaceAll(token, `${botId}:***`);
}
