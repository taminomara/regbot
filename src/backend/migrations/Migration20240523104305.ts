import { Migration } from '@mikro-orm/migrations';

export class Migration20240523104305 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `event` (`id` integer not null, `name` text not null, `date` datetime not null, `announce_id` integer not null, `registration_open` integer not null default true, `first_reminder_sent` integer not null default false, `second_reminder_sent` integer not null default false, primary key (`id`));');

    this.addSql('alter table `user` add column `username` text null;');
  }

}
