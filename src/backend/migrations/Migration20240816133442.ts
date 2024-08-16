import { Migration } from '@mikro-orm/migrations';

export class Migration20240816133442 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `user` add column `positioning` text null;');
  }

}
