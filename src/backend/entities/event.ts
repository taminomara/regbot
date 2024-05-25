import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

@Entity()
export class Event {
  @PrimaryKey({ autoincrement: false })
  id: number;

  @Property()
  name: string;

  @Property()
  date: Date;

  @Property()
  announceId: number;

  @Property({ default: true })
  registrationOpen: boolean;

  @Property({ default: false })
  firstReminderSent: boolean;

  @Property({ default: false })
  secondReminderSent: boolean;
}
