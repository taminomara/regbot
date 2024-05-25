import { Migration } from '@mikro-orm/migrations';

export class Migration20240522085713 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `user` add column `interview_group_topic` integer null;');
  }

}
