import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

@Entity()
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

  @Property({ index: true })
  originId: number;

  @Property({ index: true })
  originChatId: number;

  @Property()
  destinationId: number;

  @Property()
  destinationChatId: number;
}
