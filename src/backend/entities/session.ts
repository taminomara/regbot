import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

@Entity()
export class Session {
  @PrimaryKey({ autoincrement: false })
  key: string;

  @Property()
  data: string;
}
