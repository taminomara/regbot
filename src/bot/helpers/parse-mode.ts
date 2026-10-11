import { Transformer } from "grammy";

/**
 * API transformer that sets a default `parse_mode` for requests that carry
 * text and don't specify entities or their own parse mode.
 */
export function parseMode(
  defaultParseMode: "HTML" | "Markdown" | "MarkdownV2",
) {
  const transformer: Transformer = (prev, method, payload, signal) => {
    const p = payload as Record<string, unknown>;
    if (
      !("parse_mode" in p) &&
      !("entities" in p) &&
      !("caption_entities" in p) &&
      ("text" in p || "caption" in p)
    ) {
      return prev(method, { ...payload, parse_mode: defaultParseMode }, signal);
    }
    return prev(method, payload, signal);
  };
  return transformer;
}
