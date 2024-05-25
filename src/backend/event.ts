import { orm } from "#root/backend/data-source.js";
import { Event } from "#root/backend/entities/event.js";

export async function upcomingEvents() {
  return orm.em.find(Event, { date: { $gte: new Date() } });
}
