import { Migration } from '@mikro-orm/migrations';

export class Migration20240816152925 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `user` add column `about_me_html` text null;');
  }

}
