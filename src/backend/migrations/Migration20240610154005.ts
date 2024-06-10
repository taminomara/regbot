import { Migration } from '@mikro-orm/migrations';

export class Migration20240610154005 extends Migration {

  async up(): Promise<void> {
    this.addSql('PRAGMA foreign_keys = OFF;');
    this.addSql('CREATE TABLE `_knex_temp_alter751` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `name` text NOT NULL, `date` datetime NOT NULL, `announce_text_html` text, `announce_photo_id` text, `published` integer NOT NULL DEFAULT false, `channel_post_id` integer, `chat_post_id` integer, `registration_open` integer NOT NULL DEFAULT true, `require_approval` integer NOT NULL DEFAULT false, `require_payment` integer NOT NULL DEFAULT false, `first_reminder_sent` integer NOT NULL DEFAULT false, `second_reminder_sent` integer NOT NULL DEFAULT false, `price` text, `participation_options` json);');
    this.addSql('INSERT INTO "_knex_temp_alter751" SELECT * FROM "event";;');
    this.addSql('DROP TABLE "event";');
    this.addSql('ALTER TABLE "_knex_temp_alter751" RENAME TO "event";');
    this.addSql('PRAGMA foreign_keys = ON;');
  }

}
