import { Migration } from '@mikro-orm/migrations';

export class Migration20240805092412 extends Migration {

  async up(): Promise<void> {
    this.addSql('PRAGMA foreign_keys = OFF;');
    this.addSql('CREATE TABLE `_knex_temp_alter210` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `origin_id` integer not null, `origin_chat_id` integer not null, `destination_id` integer not null, `destination_chat_id` integer not null);');
    this.addSql('INSERT INTO "_knex_temp_alter210" SELECT NULL as id, * FROM "edit_cache";;');
    this.addSql('DROP TABLE "edit_cache";');
    this.addSql('ALTER TABLE "_knex_temp_alter210" RENAME TO "edit_cache";');
    this.addSql('create index `edit_cache_origin_id_origin_chat_id_destination_id_index` on `edit_cache` (`origin_id`, `origin_chat_id`, `destination_id`);');
    this.addSql('create index `edit_cache_origin_id_origin_chat_id_index` on `edit_cache` (`origin_id`, `origin_chat_id`);');
    this.addSql('PRAGMA foreign_keys = ON;');
  }

}
