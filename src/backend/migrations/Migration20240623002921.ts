import { Migration } from '@mikro-orm/migrations';

export class Migration20240623002921 extends Migration {

  async up(): Promise<void> {
    this.addSql('PRAGMA foreign_keys = OFF;');
    this.addSql('CREATE TABLE `_knex_temp_alter393` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `name` text NOT NULL, `date` datetime NOT NULL, `announce_text_html` text, `announce_photo_id` text, `published` integer NOT NULL DEFAULT false, `channel_post_id` integer, `chat_post_id` integer, `registration_open` integer NOT NULL DEFAULT false, `require_approval` integer NOT NULL DEFAULT false, `price` text, `participation_options` json, `reminder_sent` integer NOT NULL DEFAULT false, `payment` text NOT NULL DEFAULT \'Donation\', `iban` text NULL, `recipient` text NULL, `reminder_text_html` text NULL);');
    this.addSql('INSERT INTO "_knex_temp_alter393" SELECT * FROM "event";;');
    this.addSql('DROP TABLE "event";');
    this.addSql('ALTER TABLE "_knex_temp_alter393" RENAME TO "event";');
    this.addSql('PRAGMA foreign_keys = ON;');
  }

}
