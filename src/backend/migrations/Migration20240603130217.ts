import { Migration } from '@mikro-orm/migrations';

export class Migration20240603130217 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `edit_cache` (`origin_id` integer not null, `origin_chat_id` integer not null, `destination_id` integer not null, `destination_chat_id` integer not null, primary key (`origin_id`, `origin_chat_id`));');
    this.addSql('create index `edit_cache_origin_id_origin_chat_id_destination_id_index` on `edit_cache` (`origin_id`, `origin_chat_id`, `destination_id`);');
    this.addSql('create index `edit_cache_origin_id_origin_chat_id_index` on `edit_cache` (`origin_id`, `origin_chat_id`);');

    this.addSql('create table `event` (`id` integer not null primary key autoincrement, `name` text not null, `date` datetime not null, `announce_text_html` text null, `announce_photo_id` text null, `published` integer not null default false, `channel_post_id` integer null, `chat_post_id` integer null, `registration_open` integer not null default true, `require_approval` integer not null default false, `require_payment` integer not null default false, `first_reminder_sent` integer not null default false, `second_reminder_sent` integer not null default false, `price` text null);');

    this.addSql('create table `session` (`key` text not null, `data` text not null, primary key (`key`));');

    this.addSql('create table `user` (`id` integer not null, `status` text not null default \'New\', `finished_initial_survey` integer not null default false, `admin_group_topic` integer null, `verified_by` integer null, `verified_at` datetime null, `banned_by` integer null, `banned_at` datetime null, `name` text null, `username` text null, `locale` text null, `pronouns` text null, `gender` text null, `sexuality` text null, primary key (`id`));');
    this.addSql('create index `user_admin_group_topic_index` on `user` (`admin_group_topic`);');

    this.addSql('create table `event_signup` (`event_id` integer not null, `user_id` integer not null, `status` text not null, `approved_by` integer null, `approved_at` datetime null, constraint `event_signup_event_id_foreign` foreign key(`event_id`) references `event`(`id`) on delete cascade on update cascade, constraint `event_signup_user_id_foreign` foreign key(`user_id`) references `user`(`id`) on delete cascade on update cascade, primary key (`event_id`, `user_id`));');
    this.addSql('create index `event_signup_event_id_index` on `event_signup` (`event_id`);');
    this.addSql('create index `event_signup_user_id_index` on `event_signup` (`user_id`);');
    this.addSql('create index `event_signup_event_id_user_id_index` on `event_signup` (`event_id`, `user_id`);');
    this.addSql('create unique index `event_signup_event_id_user_id_unique` on `event_signup` (`event_id`, `user_id`);');
  }

}
