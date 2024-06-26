import {
  Collection,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  PrimaryKeyProp,
  Property,
  Ref,
  Unique,
} from "@mikro-orm/core";

import { User } from "#root/backend/entities/user.js";

@Entity()
export class Event {
  constructor(name: string, date: Date) {
    this.name = name;
    this.date = date;
  }

  @PrimaryKey()
  id: number;

  @Property()
  name: string;

  @Property()
  date: Date;

  @Property() // TODO: make lazy
  announceTextHtml: string | null = null;

  @Property()
  announcePhotoId: string | null = null;

  @Property()
  reminderTextHtml: string | null = null;

  @Property()
  published: boolean = false;

  @Property()
  channelPostId: number | null = null;

  @Property()
  chatPostId: number | null = null;

  @Property()
  registrationOpen: boolean = false;

  @Property()
  requireApproval: boolean = false;

  @Property()
  payment: EventPayment = EventPayment.Donation;

  @Property()
  price: string | null = null;

  @Property()
  iban: string | null = null;

  @Property()
  recipient: string | null = null;

  @Property({ type: "json" }) // TODO: make lazy
  participationOptions: string[] | null = null;

  @OneToMany("EventSignup", "event", { orphanRemoval: true })
  signups = new Collection<EventSignup>(this);

  @Property()
  reminderSent: boolean = false;
}

export enum SignupStatus {
  PendingApproval = "PendingApproval",
  PendingPayment = "PendingPayment",
  Approved = "Approved",
  Rejected = "Rejected",
}

export enum EventPayment {
  Required = "Required",
  Donation = "Donation",
  NotRequired = "NotRequired",
}

@Entity()
@Index({ properties: ["event", "user"] })
@Unique({ properties: ["event", "user"] })
export class EventSignup {
  constructor(event: Ref<Event>, user: Ref<User>, status: SignupStatus) {
    this.event = event;
    this.user = user;
    this.status = status;
  }

  @ManyToOne({ primary: true, updateRule: "cascade", deleteRule: "cascade" })
  event: Ref<Event>;

  @ManyToOne({ primary: true, updateRule: "cascade", deleteRule: "cascade" })
  user: Ref<User>;

  [PrimaryKeyProp]?: ["event", "user"];

  @Property()
  status: SignupStatus;

  @Property()
  approvedBy: number | null = null;

  @Property()
  approvedAt: Date | null = null;

  @Property({ type: "json" }) // TODO: make lazy
  participationOptions: string[] | null = null;

  @Property()
  participationConfirmed: boolean = false;
}
