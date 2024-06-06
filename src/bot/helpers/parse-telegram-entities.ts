import { MessageEntity } from "@grammyjs/types";

import { sanitizeHtml } from "#root/bot/helpers/sanitize-html.js";

export function parseTelegramEntities(
  text: string,
  entities?: MessageEntity[],
) {
  if (!entities) {
    return sanitizeHtml(text);
  }

  const tags: { tag: string; index: number }[] = [];

  for (const entity of entities) {
    switch (entity.type) {
      case "bold": {
        tags.splice(bisectRight(tags, entity.offset), 0, {
          tag: "<strong>",
          index: entity.offset,
        });
        tags.splice(bisectLeft(tags, entity.offset + entity.length), 0, {
          tag: "</strong>",
          index: entity.offset + entity.length,
        });
        break;
      }
      case "pre": {
        tags.splice(bisectRight(tags, entity.offset), 0, {
          tag: "<pre>",
          index: entity.offset,
        });
        tags.splice(bisectLeft(tags, entity.offset + entity.length), 0, {
          tag: "</pre>",
          index: entity.offset + entity.length,
        });
        break;
      }
      case "code": {
        tags.splice(bisectRight(tags, entity.offset), 0, {
          tag: "<code>",
          index: entity.offset,
        });
        tags.splice(bisectLeft(tags, entity.offset + entity.length), 0, {
          tag: "</code>",
          index: entity.offset + entity.length,
        });
        break;
      }
      case "strikethrough": {
        tags.splice(bisectRight(tags, entity.offset), 0, {
          tag: "<s>",
          index: entity.offset,
        });
        tags.splice(bisectLeft(tags, entity.offset + entity.length), 0, {
          tag: "</s>",
          index: entity.offset + entity.length,
        });
        break;
      }
      case "underline": {
        tags.splice(bisectRight(tags, entity.offset), 0, {
          tag: "<u>",
          index: entity.offset,
        });
        tags.splice(bisectLeft(tags, entity.offset + entity.length), 0, {
          tag: "</u>",
          index: entity.offset + entity.length,
        });
        break;
      }
      case "spoiler": {
        tags.splice(bisectRight(tags, entity.offset), 0, {
          tag: '<span class="tg-spoiler">',
          index: entity.offset,
        });
        tags.splice(bisectLeft(tags, entity.offset + entity.length), 0, {
          tag: "</span>",
          index: entity.offset + entity.length,
        });
        break;
      }
      case "text_link": {
        tags.splice(bisectRight(tags, entity.offset), 0, {
          tag: `<a href="${entity.url}" target="_blank">`,
          index: entity.offset,
        });
        tags.splice(bisectLeft(tags, entity.offset + entity.length), 0, {
          tag: "</a>",
          index: entity.offset + entity.length,
        });
        break;
      }
      case "italic": {
        tags.splice(bisectRight(tags, entity.offset), 0, {
          tag: "<em>",
          index: entity.offset,
        });
        tags.splice(bisectLeft(tags, entity.offset + entity.length), 0, {
          tag: "</em>",
          index: entity.offset + entity.length,
        });
        break;
      }
    }
  }

  let result = "";
  let lastIndex = 0;
  for (const { tag, index } of tags) {
    result += sanitizeHtml(text.slice(lastIndex, index));
    result += tag;
    lastIndex = index;
  }
  result += sanitizeHtml(text.slice(lastIndex, text.length));

  return result;
}

function bisectLeft(array: { index: number }[], pos: number) {
  const result = array.findIndex(({ index }) => index >= pos);
  return result === -1 ? array.length : result;
}

function bisectRight(array: { index: number }[], pos: number) {
  const result = array.findIndex(({ index }) => index > pos);
  return result === -1 ? array.length : result;
}
