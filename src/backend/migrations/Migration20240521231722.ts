import { Migration } from '@mikro-orm/migrations';

export class Migration20240521231722 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `session` (`key` text not null, `data` text not null, primary key (`key`));');

    this.addSql('create table `user` (`id` integer not null, `status` integer not null default 0, `finished_initial_survey` integer not null default false, `verified_by` integer null, `verified_at` datetime null, `banned_by` integer null, `banned_at` datetime null, `name` text null, `pronouns` text null, `gender` text null, `sexuality` text null, primary key (`id`));');
  }

}
