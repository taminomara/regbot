import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";

import { composer as initialSurveyComposer } from "#root/bot/conversations/initial-survey.js";

export { enter as enterInitialSurvey } from "./initial-survey.js";

export const composer = new Composer<Context>();

composer.use(initialSurveyComposer);
