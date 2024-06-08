import { Migration } from '@mikro-orm/migrations';

export class Migration20240608002855 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `user` add column `pending_signup` integer null;');
  }

}
