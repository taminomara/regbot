import { Entity, Index, PrimaryKey, Property } from "@mikro-orm/core";

@Entity()
@Index({ properties: ["originId", "originChatId"] })
@Index({ properties: ["originId", "originChatId", "destinationId"] })
export class EditCache {
  constructor(
    originId: number,
    originChatId: number,
    destinationId: number,
    destinationChatId: number,
  ) {
    this.originId = originId;
    this.originChatId = originChatId;
    this.destinationId = destinationId;
    this.destinationChatId = destinationChatId;
  }

  @PrimaryKey()
  id: number;

  @Property()
  originId: number;

  @Property()
  originChatId: number;

  @Property()
  destinationId: number;

  @Property()
  destinationChatId: number;
}
