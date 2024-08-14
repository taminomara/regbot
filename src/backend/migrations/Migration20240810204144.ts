import { Migration } from '@mikro-orm/migrations';

export class Migration20240810204144 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `event` add column `cancelled` integer not null default false;');
    this.addSql('alter table `event` add column `date_changed` integer not null default false;');
    this.addSql('alter table `event` add column `visible_in_menu` integer not null default false;');
    this.addSql("update event set announce_text_html=ifnull(announce_text_html, 'n/a'), visible_in_menu=published OR registration_open;");
    this.addSql('PRAGMA foreign_keys = OFF;');
    this.addSql('CREATE TABLE `_knex_temp_alter410` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `name` text NOT NULL, `date` datetime NOT NULL, `announce_text_html` text, `announce_photo_id` text, `published` integer not null default false, `channel_post_id` integer, `chat_post_id` integer, `registration_open` integer NOT NULL DEFAULT false, `require_approval` integer NOT NULL DEFAULT false, `price` text, `participation_options` json, `reminder_sent` integer NOT NULL DEFAULT false, `payment` text NOT NULL DEFAULT \'Donation\', `iban` text NULL, `recipient` text NULL, `reminder_text_html` text NULL, `cancelled` integer NOT NULL DEFAULT false, `date_changed` integer NOT NULL DEFAULT false, `visible_in_menu` integer NOT NULL DEFAULT false);');
    this.addSql('INSERT INTO "_knex_temp_alter410" SELECT * FROM "event";;');
    this.addSql('DROP TABLE "event";');
    this.addSql('ALTER TABLE "_knex_temp_alter410" RENAME TO "event";');
    this.addSql('PRAGMA foreign_keys = ON;');
  }

}
