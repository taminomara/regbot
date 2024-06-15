import { Migration } from '@mikro-orm/migrations';

export class Migration20240613234542 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `user` add column `ban_reason` text null;');
    this.addSql('alter table `user` add column `can_manage_events` integer not null default false;');
    this.addSql('alter table `user` add column `can_manage_interviews` integer not null default false;');
  }

}
