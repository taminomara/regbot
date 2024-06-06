import {
  Entity,
  Index,
  PrimaryKey,
  PrimaryKeyProp,
  Property,
} from "@mikro-orm/core";

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
  originId: number;

  @PrimaryKey()
  originChatId: number;

  [PrimaryKeyProp]?: ["originId", "originChatId"];

  @Property()
  destinationId: number;

  @Property()
  destinationChatId: number;
}
