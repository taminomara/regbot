import { Migration } from '@mikro-orm/migrations';

export class Migration20240810204144 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `event` add column `cancelled` integer not null default false;');
    this.addSql('alter table `event` add column `date_changed` integer not null default false;');
    this.addSql('alter table `event` add column `visible_in_menu` integer not null default false;');
    this.addSql("update event set visible_in_menu=published OR registration_open;");
  }

}
