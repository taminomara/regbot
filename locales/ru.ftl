start_command =
    .description = Запустить бот
language_command =
    .description = Сменить язык / Change language
menu_command =
    .description = Открыть меню
manage_events_command =
    .description = Управление событиями
about_command =
    .description = Информация о пользователе
ban_command =
    .description = Забанить пользователя
unban_command =
    .description = Разбанить пользователя
cancel_command =
    .description = Отменить текущее действие
empty_command =
    .description = Удалить редактируемое поле
whois_command =
    .description = Показать информацию о пользователе

error_ocurred = Произошла ошибка 😢

welcome = Добро пожаловать!
    .all_set =
        Вы уже прошли собеседование.

        Посмотреть предстоящие события и зарегистрироваться на них можно командой /menu.
        Там же можно отредактировать свой профиль.
    .in_progress =
        Пожалуйста, пройдите собеседование и дождитесь нашего ответа.
    .pending_approval =
        Пожалуйста, дождитесь нашего ответа.

language =
    .select = Пожалуйста, выберите язык
    .changed = Язык успешно изменён!

unhandled = Неизвестная команда.
cant_perform_action_right_now = Сейчас эта команда недоступна.

edit_cache =
    .edited = (отредактировано {DATETIME($date, dateStyle: "short", timeStyle: "medium")})

interview =
    .too_long = Слишком длинный ответ. Пожалуйста, уложитесь в 150 символов.

    .i_dont_know_you = Я вас пока ещё не знаю, давайте знакомиться 👋
    .i_know_you = Вижу, вы уже прошли собеседование, но мне нужно уточнить пару деталей.

    .name = Как вас зовут?

    .pronouns = Какие местоимения вы используете?
    .pronouns_they_them = 🌻 Они/Их
    .pronouns_she_her = 🌸 Она/Её
    .pronouns_he_him = 🪻 Он/Его
    .pronouns_it_its = 🌿 Оно/Его
    .can_use_custom_pronouns = Можно указать местоимения не из списка...

    .gender = Какая у вас гендерная идентичность?
    .gender_nonbinary = 🐝 Небинарная персона
    .gender_woman = 🦊 Женщина
    .gender_man = 🐨 Мужчина
    .can_use_custom_gender = Можно указать идентичность не из списка...

    .sexuality = Какая у вас сексуальная ориентация?
    .sexuality_pansexual = 🧁 Пансексуальная
    .sexuality_bisexual = 🍩 Бисексуальная
    .sexuality_homosexual = 🍉 Гомосексуальная
    .sexuality_heterosexual = 🥑 Гетеросексуальная
    .can_use_custom_sexuality = Можно указать идентичность не из списка...

    .positioning = Как вы позиционируете себя в БДСМ?
    .positioning_top = 😈 Верх
    .positioning_bottom = 🥺 Низ
    .positioning_switch = 🙃 Свич
    .can_use_custom_positioning = Можно указать позиционирование не из списка...

    .rules =
        Прочитайте <a href="notion.so/taminomara/1f06a005adb344ffb0f3be28804bbd9f">наши правила</a>.
        Согласны ли вы соблюдать их?
    .rules_yes = 👍 Да
    .rules_no = 😔 Нет

    .areyou18 = Вам уже есть 18?
    .areyou18_yes = 👍 Да
    .areyou18_no = 😱 Нет

    .experience =
        Расскажите, есть ли у вас опыт посещения сексуальных и БДСМ вечеринок?
        Если да, то какой?
        Если нет, то чего вы ожидаете от такой вечеринки?

    .how_do_you_know_us =
        Откуда вы о нас узнали?

    .active_consent =
        Как вы понимаете, что такое активное согласие (enthusiastic consent)?
        Опишите пример взаимодействия с активным согласием?

    .lgbt_check =
        Как вы относитесь к ЛГБТК людям?
        Если бы вы увидели двух целующихся мужчин или женщин, как вам было бы с этим?

    .transgender_check =
        Как вы относитесь к трансгендерности и трансгендерным людям?
        Если бы вы начали с кем-то взаимодействовать, и в процессе выяснилось бы, что это трансгендерная персона, как бы вы отреагировали?

    .personal_borders =
        Как бы вы поступили, если бы на вечеринке к вам подошёл человек и начал взаимодействовать, не спросив разрешения?

    .about_me =
        Напишите что-нибудь о себе, что считаете важным сообщить другим участникам вечеринок.

        Хорошей идеей будет рассказать немного о себе, написать о своих предпочтениях и практиках, которые хотелось бы сделать.

    .about_me_later = Введу позже
    .about_me_later_response = После прохождения собеседования, вы сможете отредактировать свой профиль командой /menu.

    .interview_replies_saved =
        Ответы сохранены ✨ Скоро мы посмотрим их и вернёмся.
        Если у вас появятся какие-нибудь вопросы, можете задавать их прямо в этом чате.

    .edit_name = Введите новое имя (или /cancel для отмены):
    .edit_pronouns = Введите новые местоимения (или /cancel для отмены):
    .edit_gender = Введите новую гендерную идентичность (или /cancel для отмены):
    .edit_sexuality = Введите новую сексуальную идентичность (или /cancel для отмены):
    .edit_positioning = Введите новое позиционирование (или /cancel для отмены):
    .edit_about_me = Введите новое описание (или /cancel для отмены):
    .edit_about_me_with_current_text =
        Введите новое описание (или /cancel для отмены). Чтобы удалить текущее описание, отправьте /empty.

        Текущий текст «обо мне» в сообщении ниже, его можно скопировать.
    .edit_success = Данные сохранены
    .edit_cancel = Отменено 👌

    .finish_interview_first = Сначала нужно закончить собеседование.
    .edit_name_first = Сначала введите новое имя.
    .edit_pronouns_first = Сначала введите новые местоимения.
    .edit_gender_first = Сначала введите новую гендерную идентичность.
    .edit_sexuality_first = Сначала введите новую сексуальную идентичность.
    .edit_positioning_first = Сначала введите новое позиционирование.
    .edit_about_me_first = Сначала введите новое описание.

    .admin_message_approved =
        ✅ Пользователь верифицирован админом <a href="{$adminLink}">{$adminName}</a> {$date}.
    .message_approved =
        ✅ <b>Добро пожаловать на квирные квартирники!</b>

        Вы можете присоединиться к <a href="{$chatLink}">нашему чату</a>.
        Не забудьте рассказать о себе под тегом #hi.

    .admin_message_rejected =
        ❌ Пользователь отклонён админом <a href="{$adminLink}">{$adminName}</a> {$date}.
    .message_rejected =
        ❌ <b>К сожалению, ваша заявка была отклонена.</b>

        Спасибо за вашу заявку и интерес к нашему мероприятию. Мы очень ценим это.
        К сожалению, на этот раз мы не сможем вас принять.

        Надеемся на ваше понимание и желаем всего самого наилучшего.

admin_group =
    .topic_name = {$name} (@{$username})
    .topic_header =
        <b>Диалог с пользователем <a href="{$userLink}">{$name}</a> (@{$username})</b>
    .topic_body =
        Имя: <b>{$name}</b>
        Местоимения: <b>{$pronouns}</b>
        Гендерная идентичность: <b>{$gender}</b>
        Сексуальная идентичность: <b>{$sexuality}</b>
        Позиционирование: <b>{$positioning}</b>
        Статус: <b>{$status ->
            *[New]                  ⏳ собеседование не начато.
             [InterviewInProgress]  ⏳ собеседование в процессе.
             [PendingApproval]      ⏳ собеседование закончено, ждём ответ.
             [Approved]             ✅ собеседование пройдено.
             [Rejected]             ❌ собеседование не пройдено.
             [Banned]               ⛔ пользователь забанен.
        }</b>
    .rejection_details =
        Собеседовал админ <a href="{$adminLink}">{$adminName}</a> {$date}
    .ban_details =
        Забанил админ <a href="{$adminLink}">{$adminName}</a> {$date}

        {$reason}
    .about_me = Обо мне:

    .message_interview_question =
        ↩️ <b>Interview question</b>

        {$question}
    .message_interview_finished =
        ℹ️ <b>Собеседование закончено, пользователь ждёт решения.</b>
    .message_invite_confirmation_needed =
        ℹ️ <b>Требуется подтверждение.</b>

        Пользователь присоединился через специальное приглашение. Это значит, что пользователь уже проходил собеседование раньше, но информация об этом была утеряна.

        Так как пользователя нет в чате квирных квартирников, необходимо ручное подтверждение. Пожалуйста, проверьте, что это именно тот пользователь, который проходил собеседование раньше.

        Поменять статус пользователя можно командой /about@{$botUsername}.

    .approve = ✅ Подтвердить
    .message_interview_approved =
        ✅ Пользователь верифицирован админом <a href="{$adminLink}">{$adminName}</a> {$date}.

    .reject = ❌ Отказать
    .message_interview_rejected =
        ❌ Пользователь отклонён админом <a href="{$adminLink}">{$adminName}</a> {$date}.

    .ban = ⛔ Забанить
    .ban_prompt =
        Вы уверены, что хотите забанить пользователя <a href="{$userLink}">{$name}</a>?

        Пользователь будет удалён из чатов, регистрации пользователя на будущие события будут отозваны.

        Пользователь не получит сообщения о бане. Прокомуницируйте причину бана через этот чат самостоятельно!
    .message_banned =
        ⛔ Пользователь забанен админом <a href="{$adminLink}">{$adminName}</a> {$date}.

        {$reason}
    .message_banned_privileged_user = ⚠️ Пользователь является админом {$chat ->
        *[MEMBERS_GROUP] чата квирных квартирников
        [ADMIN_GROUP] группы собеседований
        [CHANNEL] канала с анонсами
    }, бот не имеет достаточно прав для разжалования.

    .unban = ⚠️ Разбанить
    .unban_prompt =
        Вы уверены, что хотите разбанить пользователя <a href="{$userLink}">{$name}</a>?

        Пользователь сможет присоединяться к чатам и регистрироваться на события.

        Пользователь не получит сообщения о разбане и свежую ссылку на чат участников. Прокомуницируйте разбан через этот чат самостоятельно!

    .message_unbanned =
        ✅ Пользователь разбанен админом <a href="{$adminLink}">{$adminName}</a> {$date}.

event =
    .title_signup_prefix = {$status ->
       *[Approved]         ✅
        [Rejected]         ❌
        [PendingApproval]  ⏳
        [PendingPayment]   ⏳
    }
    .title_cancelled_prefix = 🚫 Отмена |
    .title_date_change_prefix = 📅 Перенос |
    .title_with_date = {$titlePrefix}{$title} | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}
    .title = {$titlePrefix}{$title}
    .free = бесплатно
    .free_donation = любой донат

menu =
    .outdated = Это меню устарело, попробуйте заново.

    .new_user = Пожалуйста, зарегистрируйтесь с помощью команды /start.

    .in_progress_user = Меню заработает после прохождения собеседования.

    .unverified_fields_notice =
        ☝️ <b>Обратите внимание</b>

        После недавнего сбоя мы потеряли часть данных о пользователях. Пожалуйста, проверьте, всё ли верно в вашем профиле:

    .pending_approval_after_invitation =
        После недавнего сбоя мы потеряли часть данных о пользователях.

        Мы видим, что вы уже прошли собеседование, но из-за ваших настроек приватности нам нужно проверить всё ещё раз.

        Скоро мы посмотрим ваш профиль и активируем его. Большое спасибо за понимание и терпение 🤗

    .about =
        Имя: <b>{$name}</b>
        Местоимения: <b>{$pronouns}</b>
        Гендерная идентичность: <b>{$gender}</b>
        Сексуальная идентичность: <b>{$sexuality}</b>
        Позиционирование: <b>{$positioning}</b>

    .back = ⬅️ Назад
    .profile = 👩🏽‍🎤 Мой профиль
    .update = 🔃 Обновить
    .name = Имя
    .pronouns = Местоимения
    .gender = Гендерная идентичность
    .sexuality = Сексуальная идентичность
    .positioning = Позиционирование
    .about_me = Обо мне:

    .edit = ✏️ Редактировать
    .edit_prompt = Что вы хотите отредактировать?
    .edit_name = Имя
    .edit_pronouns = Местоимения
    .edit_gender = Гендерную идентичность
    .edit_sexuality = Сексуальную идентичность
    .edit_positioning = Позиционирование
    .edit_about_me = Обо мне

    .events = Предстоящие события:
    .signup_button = {$signedUp ->
        *[no]       Зарегистрироваться
         [approved] ✅ Вы зарегистрированы
         [rejected] ❌ В регистрации отказано
         [pending]  ⏳ Ожидаем подтверждения
    }

    .cancel_signup_button = 🙅🏽‍♀️ Отменить регистрацию
    .cancel_signup_button_no = ⬅️ Нет
    .cancel_signup_button_yes = 🙅🏽‍♀️ Да
    .cancel_signup_confirmation = Вы действительно хотите отменить регистрацию?

    .who_else_coming_button = 👯‍♀️ Кто ещё будет?

    .event_participants =
        <b>Ещё записались на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}:</b>
    .event_participants_empty =
        На <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")} пока что никто не записался.
    .event_participant = <b><a href="{$userLink}">{$name}</a></b> (@{$username}), {$pronouns}{$options}
    .event_participant_no_username = <b><a href="{$userLink}">{$name}</a></b>, {$pronouns}{$options}
    .event_participant_button = {$name} (@{$username}), {$pronouns}{$options}
    .event_participant_button_no_username = {$name}, {$pronouns}{$options}
    .event_participant_gender = Гендерная идентичность: <b>{$gender}</b>
    .event_participant_sexuality = Сексуальная идентичность: <b>{$sexuality}</b>
    .event_participant_positioning = Позиционирование: <b>{$positioning}</b>
    .event_participant_options = Выбранные опции: <b>{$options}</b>
    .next_profile = ▶️ Следующий профиль
    .previous_profile = ◀️ Предыдущий профиль

manage_events =
    .events = Предстоящие события:
    .event =
        <b>{$name}</b>

        Статус: {$status ->
            *[draft]        📝 Черновик
            [published]     🚀 Опубликовано
            [date_changed]  🚀 Опубликовано, перенесено
            [cancelled]     🚫 Отменено
        }
        Когда: <b>{DATETIME($date, dateStyle: "short", timeStyle: "short")}</b>
        Опции: <b>{$options}</b>
        Ссылка для регистрации: <code>https://t.me/{$botUsername}?start={$id}</code>.
        {$payment ->
            [Required]
                Стоимость: <b>{$price}</b>
                IBAN: <b><code>{$iban}</code></b>
                Получатель: <b><code>{$recipient}</code></b>
            [Donation]
                Донат: <b>{$price}</b>
                IBAN: <b><code>{$iban}</code></b>
                Получатель: <b><code>{$recipient}</code></b>
            *[NotRequired]
                Стоимость: <b>бесплатно</b>
                IBAN: <b><i>&lt;empty&gt;</i></b>
                Получатель: <b><i>&lt;empty&gt;</i></b>
        }
    .event_text = <b>Пост:</b>
    .event_reminder = <b>Напоминание перед событием:</b>

    .update = 🔃 Обновить
    .back = ⬅️ Назад
    .create = ➕ Создать событие
    .event_title = {$prefix} {$name} | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")} | {$suffix}
    .event_title_prefix = {$published ->
        [yes]           🚀
        [no]            📝
        *[cancelled]    🚫
    }
    .event_title_suffix = {$participants}
    .event_title_suffix_with_pending = {$participants}+{$pending}⏳

    .confirmation = {$required ->
         [yes]          ☑️ Требуется подтверждение
        *[no]           ➖ Подтверждение не требуется
    }
    .manage_event_price = {$payment ->
        [Required]      ☑️ Требуется оплата
        [Donation]      🍩 Вход за донат
        *[NotRequired]  ➖ Оплата не требуется
    }
    .visible_in_menu = {$visibleInMenu ->
         [yes]          ✅ Событие видно в меню
        *[no]           🚀 Показывать событие в меню
    }
    .registration_open = {$registrationOpen ->
         [yes]          ✅ Регистрация открыта
        *[no]           🚀 Открыть регистрацию
         [no_permanent] 🚫 Регистрация закрыта
    }
    .published = {$published ->
         [yes]          ✅ Анонс опубликован
        *[no]           🚀 Опубликовать анонс
         [no_permanent] 🚫 Анонс не опубликован
    }

    .publish_confirm = Вы действительно хотите опубликовать анонс события?
    .publish_no = ⬅️ Нет
    .publish_yes = 🚀 Да
    .make_visible_confirm = Вы действительно хотите показать событие в меню?
    .make_visible_yes = 🚀 Да
    .make_visible_no = ⬅️ Нет
    .make_invisible_confirm = Вы действительно хотите скрыть событие из меню?
    .make_invisible_yes = 📝 Да
    .make_invisible_no = ⬅️ Нет
    .open_registration_confirm = Вы действительно хотите открыть событие для регистрации?
    .open_registration_yes = 🚀 Да
    .open_registration_no = ⬅️ Нет
    .close_registration_confirm = Вы действительно хотите закрыть событие для регистрации?
    .close_registration_yes = 🙅‍♀️ Да
    .close_registration_no = ⬅️ Нет

    .edit_post = ✏️ Пост
    .edit_name = ✏️ Название
    .edit_date = ✏️ Дата
    .edit_price = ✏️ Стоимость
    .edit_payment_details = ✏️ Данные оплаты
    .edit_reminder = ✏️ Напоминание перед событием
    .edit_options =  ✏️ Опции

    .manage_participants = 👯‍♀️ Участники ({$participants})
    .manage_participants_with_pending = 👯‍♀️ Участники ({$participants}+{$pending}⏳)
    .message_participants = ✉️ Отправить сообщение участникам

    .delete = 🗑️ Удалить событие
    .delete_confirm =
        Вы действительно хотите удалить событие?
    .delete_yes = 🗑️ Да
    .delete_no = ⬅️ Нет

    .cancel = 🚫 Отменить событие
    .cancelled = 🚫 Событие отменено
    .cancel_confirm =
        Вы действительно хотите отменить событие?
    .cancel_yes = 🚫 Да
    .cancel_no = ⬅️ Нет

    .post_to_channel = Опубликовать в канале
    .message_event_participants = Разослать участникам

    .enter_name = Введите название события:
    .enter_date = Введите дату и время события:
    .date_invalid = Введите дату и время в формате <code>YYYY-MM-DD HH:MM</code>:'
    .date_in_past = Дата и время события не должны быть в прошлом.
    .date_not_changed = Новая дата и время совпадают с прежними.
    .enter_date_change_reason =
        Новая дата: <b>{DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.</b>
        Введите причину переноса события, она будет разослана участникам и отправлена в канал.
        Отправьте /empty, чтобы не указывать причину переноса события.
    .date_change_post_no_signup_link_no_reason =
        <b>⚠️ Перенос: <a href="{$eventPostLink}">{$name}</a></b>

        Новая дата: <b>{DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}</b>
    .date_change_post_no_signup_link =
        <b>⚠️ Перенос: <a href="{$eventPostLink}">{$name}</a></b>

        {$reasonTextHtml}

        Новая дата: <b>{DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}</b>
    .date_change_post_no_reason =
        <b>⚠️ Перенос: <a href="{$eventPostLink}">{$name}</a></b>

        Новая дата: <b>{DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}</b>
        Записаться на новую дату можно <a href="{$eventSignupLink}">по ссылке</a>.
    .date_change_post =
        <b>⚠️ Перенос: <a href="{$eventPostLink}">{$name}</a></b>

        {$reasonTextHtml}

        Новая дата: <b>{DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}</b>
        Записаться на новую дату можно <a href="{$eventSignupLink}">по ссылке</a>.
    .enter_cancellation_reason =
        Введите причину отмены события, она будет разослана участникам и отправлена в канал.
        Отправьте /empty, чтобы не указывать причину отмены события.
    .event_cancellation_post_no_reason =
        <b>🚫 Отмена: <a href="{$eventPostLink}">{$title}</a></b>

        Нам пришлось отменить {$title}.
        Приносим свои извинения и надеемся на понимание 😢
    .event_cancellation_post =
        <b>🚫 Отмена: <a href="{$eventPostLink}">{$title}</a></b>

        {$reasonTextHtml}
    .event_in_past = Событие уже прошло.
    .event_cancelled = Событие отменено.
    .enter_post =
        Введите текст поста с анонсом события.
        К посту можно прикрепить одну фотографию.

        Текущий текст поста в сообщении ниже, его можно скопировать:
    .post_is_too_long = ⚠️ Слишком длинный текст поста!
    .too_long_to_display = &lt;<i>text is too long to display</i>&gt;
    .enter_price =
        Введите стоимость или отправьте /empty чтобы сбросить стоимость.
    .enter_iban =
        Введите IBAN.
    .enter_recipient =
        Введите ФИО получателя платежа.
    .enter_options =
        Введите опции для регистрации, по одной на каждую строку, или отправьте /empty чтобы сбросить опции.
    .enter_reminder =
        Введите текст, который будет разослан участникам за день до события, или отправьте /empty чтобы сбросить напоминание.
   .enter_reminder_with_current =
        Введите текст, который будет разослан участникам за день до события, или отправьте /empty чтобы сбросить напоминание.

        Текущий текст в сообщении ниже, его можно скопировать:

    .edit_success = Данные сохранены

    .event_created = Событие успешно создано.
    .signup_link = Ссылка для регистрации: <code>{$eventSignupLink}</code>.

    .event_participants =
        Участники <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}:

        {$participants}
    .event_participants_empty = Пока что никто не записался.
    .event_participant_with_status = {$status ->
        [PendingApproval] {$event_participant}, ⏳ Ожидаем подтверждения
        [PendingPayment] {$event_participant}, ⏳ Ожидаем оплаты
        [Approved] {$event_participant}
        *[Rejected] {$event_participant}, ❌ Заявка отклонена
    }
    .event_participant = <b><a href="{$userLink}">{$name}</a></b> (@{$username}), {$pronouns}{$options}
    .event_participant_no_username = <b><a href="{$userLink}">{$name}</a></b>, {$pronouns}{$options}

    .enter_message_for_event_participants =
        Введите сообщение, которое будет разослано участникам.
    .include_approved_participants = Зарегистрированным
    .include_pending_participants = Ожидающим регистрации
    .include_rejected_participants = Отклонённым

event_signup =
    .event_in_past = Событие уже прошло.
    .unknown_event =
        Неизвестное событие.
        Возможно, мы накосячили со ссылкой в посте, напишите нам об этом.
    .registration_closed =
        Регистрация на событие закрыта.

    .chosen_options = Выбранные опции: <b>{$options}</b>

    .pending_approval =
        Заявка на участие отправлена, скоро мы посмотрим её и вернёмся.
    .admin_message_pending_approval =
        ℹ️ Пользователь хочет на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.

        {$options}

    .pending_payment =
        Пожалуйста, оплатите участие в событии и пришлите скриншот с подтверждением оплаты в этот чат.

        Стоимость: <b>{$price}</b>
        IBAN: <b><code>{$iban}</code></b>
        Получатель: <b><code>{$recipient}</code></b>
    .admin_message_pending_payment =
        ℹ️ Ждём оплаты за <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.

        {$options}

    .registered =
        ✅ Вы зарегистрированы на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.
    .admin_message_registered =
        ✅ Пользователь зарегистрирован на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")} админом <a href="{$adminLink}">{$adminName}</a> {$approveDate}.

        {$options}

    .rejected =
        ❌ К сожалению, мы не можем зарегистрировать вас на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.
    .admin_message_rejected =
        ❌ Пользователь не зарегистрирован на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")} админом <a href="{$adminLink}">{$adminName}</a> {$rejectDate}.

    .rejected_with_refund =
        ❌ К сожалению, мы не можем зарегистрировать вас на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.

        Скоро мы напишем вам по поводу возврата денег.
    .admin_message_rejected_with_refund =
        ❌ Пользователь не зарегистрирован на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")} админом <a href="{$adminLink}">{$adminName}</a> {$rejectDate}.

        ⚠️ Возможно, нужен возврат денег.

    .withdrawn = Вы отменили регистрацию на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.
    .admin_message_withdrawn = ℹ️ Пользователь отменил регистрацию на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.

    .withdrawn_with_refund =
        Вы отменили регистрацию на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.

        Скоро мы напишем вам по поводу возврата денег.
    .admin_message_withdrawn_with_refund =
        ℹ️ Пользователь отменил регистрацию на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.

        ⚠️ Возможно, нужен возврат денег.

    .prompt_signup = Хотите зарегистрироваться на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}?
    .already_registered = Вы уже зарегистрированы на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.

event_reminders =
    .event_reminder =
        <b>{$name}</b> уже завтра! Начинаем в {DATETIME($date, hour: "2-digit", minute: "2-digit")}.

        Если вы хотите прийти, но ещё не регистрировались, <a href="https://t.me/{$botUsername}?start={$eventId}">самое время это сделать</a>!

    .signup_reminder =
        Завтра, в {DATETIME($date, hour: "2-digit", minute: "2-digit")}, будет <b>{$name}</b>!

        {$more}

    .signup_reminder_today = {$more}

    .i_cant_make_it = 😥 Ой, а я не приду
    .i_will_be_there = ☺️ Я буду

    .donate_reminder =
        🍩 Квирные квартирники существуют на ваши донаты.
        Вы можете оставлять их наличкой на самом мероприятиии, или сделать перевод вот по этим реквизитам:

        {$paymentDetails}

    .payment_details =
        IBAN: <b><code>{$iban}</code></b>
        Получатель: <b><code>{$recipient}</code></b>

    .payment_details_with_price =
        Донат: <b>{$price}</b>
        IBAN: <b><code>{$iban}</code></b>
        Получатель: <b><code>{$recipient}</code></b>

    .waiting_for_you =
        Ждём тебя!

whois =
    .about =
        <b>{$name} @{$username}</b>, {$pronouns}.

        Гендерная идентичность: <b>{$gender}</b>
        Сексуальная идентичность: <b>{$sexuality}</b>
        Позиционирование: <b>{$positioning}</b>

    .invalid_syntax =
        Команда набрана неверно. Должно быть: <code>/whois@{$botUsername} @username</code>.

    .invalid_syntax_no_reply =
        Отправьте эту команду в ответ на другое сообщение, или укажите username пользователя: <code>/whois@{$botUsername} @username</code>.

    .not_found =
        Я не нашла информацию об этом пользователе 🤷‍♀️

    .not_found_username =

        Я не нашла информацию {$isVowel ->
              *[yes]    об @{$username} 🤷‍♀️
               [no]     о @{$username} 🤷‍♀️
          }
