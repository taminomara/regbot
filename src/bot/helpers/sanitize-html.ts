import sanitize from "sanitize-html";

export function sanitizeHtml(s: string): string;
export function sanitizeHtml(s: string | undefined | null): string | undefined;
export function sanitizeHtml(s: string | undefined | null): string | undefined {
  return s === undefined || s === null
    ? undefined
    : sanitize(s, { allowedTags: [], allowedAttributes: {} });
}

export function sanitizeHtmlOrEmpty(s: string | undefined | null): string {
  return s === undefined || s === null
    ? "<i>&lt;empty&gt;</i>"
    : sanitize(s, { allowedTags: [], allowedAttributes: {} });
}
