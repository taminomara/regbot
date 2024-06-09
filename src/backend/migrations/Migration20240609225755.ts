import { Migration } from '@mikro-orm/migrations';

export class Migration20240609225755 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `event` add column `participation_options` text null;');
  }

}
