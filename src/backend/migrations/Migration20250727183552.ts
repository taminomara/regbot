import { Migration } from "@mikro-orm/migrations";

export class Migration20250727183552 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "create index `user_username_index` on `user` (`username` collate nocase);",
    );
  }
}
