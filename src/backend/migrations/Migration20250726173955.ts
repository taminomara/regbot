import { Migration } from '@mikro-orm/migrations';

export class Migration20250726173955 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `user` add column `admin_group_header_id` integer null;');
    this.addSql('alter table `user` add column `admin_group_header_is_open` integer not null default false;');
  }

}
