import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";

import { composer as languageComposer } from "./language.js";
import { composer as unhandledComposer } from "./unhandled.js";
import { composer as welcomeComposer } from "./welcome.js";
import { composer as menuComposer } from "./menu.js";
import { composer as adminGroupComposer } from "./admin-group.js";
import { composer as interviewComposer } from "./interview.js";
import { composer as adminGroupMenuComposer } from "./admin-group-menu.js";
import { composer as editUserComposer } from "./edit-user.js";

export const composer = new Composer<Context>();

composer.use(editUserComposer);
composer.use(adminGroupMenuComposer);
composer.use(interviewComposer);
composer.use(adminGroupComposer);
composer.use(languageComposer);
composer.use(menuComposer);
composer.use(welcomeComposer);

composer.use(unhandledComposer); // Must be the last composer.
