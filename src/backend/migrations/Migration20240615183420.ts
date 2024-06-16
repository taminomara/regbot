import { Migration } from '@mikro-orm/migrations';

export class Migration20240615183420 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `event` drop column `require_payment`;');

    this.addSql('alter table `event` add column `payment` text not null default \'Donation\';');
    this.addSql('alter table `event` add column `iban` text null;');
    this.addSql('alter table `event` add column `recipient` text null;');
    this.addSql('alter table `event` add column `reminder_text_html` text null;');
  }

}
