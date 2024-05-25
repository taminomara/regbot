import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

export enum UserStatus {
  New,
  InterviewInProgress,
  PendingApproval,
  Approved,
  Rejected,
  Banned,
}

@Entity()
export class User {
  constructor(id: number) {
    this.id = id;
    this.status = UserStatus.New;
  }

  @PrimaryKey({ autoincrement: false })
  id: number;

  @Property({ default: UserStatus.New })
  status: UserStatus;

  @Property({ default: false })
  finishedInitialSurvey: boolean;

  @Property({ index: true })
  adminGroupTopic: number | null;

  @Property()
  verifiedBy: number | null;

  @Property()
  verifiedAt: Date | null;

  @Property()
  bannedBy: number | null;

  @Property()
  bannedAt: Date | null;

  @Property()
  name: string | null;

  @Property()
  username: string | null;

  @Property()
  pronouns: string | null;

  @Property()
  gender: string | null;

  @Property()
  sexuality: string | null;
}

@Entity({
  expression:
    "select id, status, username, finished_initial_survey, admin_group_topic, name from user",
})
export class UserLite {
  @Property()
  id: number;

  @Property()
  status: UserStatus;

  @Property()
  username: string | null;

  @Property()
  finishedInitialSurvey: boolean;

  @Property()
  adminGroupTopic: number | null;

  @Property()
  name: string | null;
}
