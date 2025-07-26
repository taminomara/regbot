import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

@Entity()
export class Invitation {
  constructor(id: number) {
    this.id = id;
  }

  @PrimaryKey({ autoincrement: false })
  id: number;

  @Property({ unique: true })
  username: string;

  @Property()
  name: string | null = null;

  @Property()
  pronouns: string | null = null;

  @Property()
  gender: string | null = null;

  @Property()
  sexuality: string | null = null;

  @Property()
  positioning: string | null = null;

  @Property()
  aboutMeHtml: string | null = null;

  @Property()
  isBanned: boolean = false;

  @Property()
  adminGroupTopic: number | null = null;
}
