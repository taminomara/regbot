import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";

import { composer as adminComposer } from "./admin.js";
import { composer as languageComposer } from "./language.js";
import { composer as unhandledComposer } from "./unhandled.js";
import { composer as welcomeComposer } from "./welcome.js";

export const composer = new Composer<Context>();

composer.use(adminComposer);
composer.use(languageComposer);
composer.use(welcomeComposer);
composer.use(unhandledComposer); // Must be the last composer.
