import { Composer } from "grammy";

import type { Context } from "#root/bot/context.js";

import { composer as adminGroupMenuComposer } from "./admin-group-menu.js";
import { composer as adminGroupComposer } from "./admin-group.js";
import { composer as editUserComposer } from "./edit-user.js";
import { composer as eventRemindersComposer } from "./event-reminders.js";
import { composer as interviewComposer } from "./interview-v2.js";
import { composer as languageComposer } from "./language.js";
import { composer as manageEventsMenuComposer } from "./manage-events-menu.js";
import { composer as menuComposer } from "./menu.js";
import { composer as startComposer } from "./start.js";
import { composer as unhandledComposer } from "./unhandled.js";

export const composer = new Composer<Context>();

// Menus
composer.use(menuComposer);
composer.use(adminGroupMenuComposer);
composer.use(manageEventsMenuComposer);
// Conversations
composer.use(interviewComposer);
composer.use(editUserComposer);
// Commands and features
composer.use(adminGroupComposer);
composer.use(languageComposer);
composer.use(startComposer);
composer.use(eventRemindersComposer);

composer.use(unhandledComposer); // Must be the last composer.
