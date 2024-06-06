import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

export enum UserStatus {
  New = "New",
  InterviewInProgress = "InterviewInProgress",
  PendingApproval = "PendingApproval",
  Approved = "Approved",
  Rejected = "Rejected",
  Banned = "Banned",
}

@Entity()
export class User {
  constructor(id: number) {
    this.id = id;
  }

  @PrimaryKey({ autoincrement: false })
  id: number;

  @Property()
  status: UserStatus = UserStatus.New;

  @Property()
  finishedInitialSurvey: boolean = false;

  @Property({ index: true })
  adminGroupTopic: number | null = null;

  @Property()
  verifiedBy: number | null = null;

  @Property()
  verifiedAt: Date | null = null;

  @Property()
  bannedBy: number | null = null;

  @Property()
  bannedAt: Date | null = null;

  @Property()
  name: string | null = null;

  @Property()
  username: string | null = null;

  @Property()
  locale: string | null = null;

  @Property()
  pronouns: string | null = null;

  @Property()
  gender: string | null = null;

  @Property()
  sexuality: string | null = null;
}

@Entity({
  expression:
    "select id, status, username, finished_initial_survey, admin_group_topic, name, locale from user",
})
export class UserLite {
  @Property()
  id: number;

  @Property()
  status: UserStatus;

  @Property()
  username: string | null;

  @Property()
  locale: string | null = null;

  @Property()
  finishedInitialSurvey: boolean;

  @Property()
  adminGroupTopic: number | null;

  @Property()
  name: string | null;
}
