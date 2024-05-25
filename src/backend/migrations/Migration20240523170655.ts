import { Migration } from '@mikro-orm/migrations';

export class Migration20240523170655 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `edit_cache` (`id` integer not null primary key autoincrement, `origin_id` integer not null, `origin_chat_id` integer not null, `destination_id` integer not null, `destination_chat_id` integer not null);');
    this.addSql('create index `edit_cache_origin_id_index` on `edit_cache` (`origin_id`);');
    this.addSql('create index `edit_cache_origin_chat_id_index` on `edit_cache` (`origin_chat_id`);');
  }

}
