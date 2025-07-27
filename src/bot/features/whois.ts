import { Composer } from "grammy";
import { and } from "grammy-guard";

import { User, UserStatus, findUser, getUser } from "#root/backend/user.js";
import { Context } from "#root/bot/context.js";
import {
  CommandPrivileges,
  CommandScope,
  registerCommandHelp,
} from "#root/bot/features/help.js";
import { chatIsMembersGroup, isApproved } from "#root/bot/filters/index.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { sanitizeHtmlOrEmpty } from "#root/bot/helpers/sanitize-html.js";
import { i18n } from "#root/bot/i18n.js";
import { config } from "#root/config.js";

export const composer = new Composer<Context>();

const feature = composer.filter(and(isApproved, chatIsMembersGroup));

feature.command("whois", logHandle("command:whois"), async (ctx) => {
  const command =
    /^\/whois(?:@[a-zA-Z_]*)?(?:\s+@(?<username>[a-zA-Z0-9_]+))?\s*$/u.exec(
      ctx.msg.text,
    );

  if (!command) {
    await ctx.reply(
      ctx.t("whois.invalid_syntax", { botUsername: ctx.me.username }),
      { reply_to_message_id: ctx.msgId },
    );
    return;
  }

  let { username }: { username?: string } = command.groups!;

  let user = null;
  if (username === undefined) {
    const userData = ctx.msg?.reply_to_message?.from;
    if (userData === undefined) {
      await ctx.reply(
        ctx.t("whois.invalid_syntax_no_reply", {
          botUsername: ctx.me.username,
        }),
        { reply_to_message_id: ctx.msgId },
      );
      return;
    }
    username = userData.username;
    user = await getUser(userData.id);
  } else {
    user = await findUser(username);
  }

  if (user === null || user.status !== UserStatus.Approved) {
    await ctx.reply(
      ctx.t(username ? "whois.not_found_username" : "whois.not_found", {
        username,
        isVowel:
          username && "aeiou".includes(username[0].toLowerCase())
            ? "yes"
            : "no",
      }),
      {
        reply_to_message_id: ctx.msgId,
      },
    );
  } else {
    await ctx.reply(formatAbout(ctx, user), { reply_to_message_id: ctx.msgId });
  }
});

registerCommandHelp({
  command: "whois",
  scope: CommandScope.MembersGroup,
  privileges: CommandPrivileges.AllUsers,
});
registerCommandHelp({
  command: "whois",
  scope: CommandScope.MembersGroup,
  privileges: CommandPrivileges.Admins,
});

function formatAbout(ctx: Context, user: User) {
  let about = i18n.t(user.locale ?? config.DEFAULT_LOCALE, "whois.about", {
    username: sanitizeHtmlOrEmpty(user.username),
    name: sanitizeHtmlOrEmpty(user.name),
    pronouns: sanitizeHtmlOrEmpty(user.pronouns),
    gender: sanitizeHtmlOrEmpty(user.gender),
    sexuality: sanitizeHtmlOrEmpty(user.sexuality),
    positioning: sanitizeHtmlOrEmpty(user.positioning),
  });

  if (user.aboutMeHtml !== null) {
    about += `\n\n<b>${ctx.t("menu.about_me")}</b>\n\n<blockquote>${
      user.aboutMeHtml
    }</blockquote>`;
  }

  return about;
}
