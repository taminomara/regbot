import { Migration } from '@mikro-orm/migrations';

export class Migration20240610182542 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `event_signup` add column `participation_options` json null;');
  }

}
