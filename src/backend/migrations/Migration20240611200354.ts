import { Migration } from '@mikro-orm/migrations';

export class Migration20240611200354 extends Migration {

  async up(): Promise<void> {
    this.addSql('create index `event_channel_post_id_index` on `event` (`channel_post_id`);');
  }

}
