import { Migration } from '@mikro-orm/migrations';

export class Migration20240613211846 extends Migration {

  async up(): Promise<void> {
    this.addSql('drop index `event_channel_post_id_index`;');
    this.addSql('alter table `event` drop column `first_reminder_sent`;');
    this.addSql('alter table `event` drop column `second_reminder_sent`;');

    this.addSql('alter table `event` add column `reminder_sent` integer not null default false;');

    this.addSql('alter table `event_signup` add column `participation_confirmed` integer not null default false;');
  }

}
