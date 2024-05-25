import { Migration } from '@mikro-orm/migrations';

export class Migration20240522141937 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `user` rename column `interview_group_topic` to `admin_group_topic`;');
  }

}
