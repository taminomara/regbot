import { Migration } from '@mikro-orm/migrations';

export class Migration20240619002518 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `user` drop column `finished_initial_survey`;');
  }

}
