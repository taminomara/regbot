start_command =
    .description = Запустить бот
language_command =
    .description = Сменить язык / Change language
menu_command =
    .description = Открыть меню
manage_events_command =
    .description = Управление событиями

welcome = Добро пожаловать!
    .all_set =
        Вы уже прошли собеседование.

        Посмотреть предстоящие события и записаться на них можно командой /menu.
        Там же можно отредактировать свой профиль.
    .in_progress =
        Пожалуйста, пройдите собеседование и дождитесь нашего ответа.

language =
    .select = Пожалуйста, выберите язык
    .changed = Язык успешно изменён!

unhandled = Неизвестная команда.

edit_cache =
    .edited = (отредактировано {DATETIME($date, dateStyle: "short", timeStyle: "medium")})

interview =
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
        Как вы понимаете, что такое активное согласие?
        Опишите пример взаимодействия с активным согласием?

    .lgbt_check =
        Как вы относитесь к ЛГБТК людям?
        Если бы вы увидели двух целующихся мужчин или женщин, как вам было бы с этим?

    .transgender_check =
        Как вы относитесь к трансгендерности и трансгендерным людям?
        Если бы вы начали с кем-то взаимодействовать, и в процессе выяснилось бы, что это трансгендерная персона, как бы вы отреагировали?

    .personal_borders =
        Как бы вы поступили, если бы на вечеринке к вам подошёл человек и начал взаимодействовать, не спросив разрешения?

    .interview_replies_saved =
        Ответы сохранены ✨ Скоро мы посмотрим их и вернёмся.

    .edit_name = Введите новое имя:
    .edit_pronouns = Введите новые местоимения:
    .edit_gender = Введите новую гендерную идентичность:
    .edit_sexuality = Введите новую сексуальную идентичность:
    .edit_success = Данные сохранены

    .finish_interview_first = Сначала нужно закончить собеседование.
    .edit_name_first = Сначала введите новое имя.
    .edit_pronouns_first = Сначала введите новые местоимения.
    .edit_gender_first = Сначала введите новую гендерную идентичность.
    .edit_sexuality_first = Сначала введите новую сексуальную идентичность.

    .admin_message_approved =
        ✅ Пользователь верифицирован админом <a href="tg://user?id={$adminId}">{$adminName}</a> {$date}.
    .user_message_approved =
        ✅ <b>Добро пожаловать на квирные квартирники!</b>

        Вы можете присоединиться к <a href="{$chatLink}">нашему чату</a>.
        Не забудьте рассказать о себе под тегом #hi.

        Посмотреть предстоящие события и записаться на них можно командой /menu.
        Там же можно отредактировать свой профиль.

    .admin_message_rejected =
        ❌ Пользователь отклонён админом <a href="tg://user?id={$adminId}">{$adminName}</a> {$date}.
    .user_message_rejected =
        ❌ <b>К сожалению, ваша заявка была отклонена.</b>

        Спасибо за вашу заявку и интерес к нашему мероприятию. Мы очень ценим это.
        К сожалению, на этот раз мы не сможем вас принять.

        Надеемся на ваше понимание и желаем всего самого наилучшего.

admin_group =
    .topic_name = {$name} (@{$username})
    .topic_header =
        <b>Диалог с пользователем <a href="tg://user?id={$id}">{$name}</a></b>
    .message_question =
        ↩️ <b>Interview question</b>

        {$question}
    .interview_finished = ℹ️ <b>Собеседование закончено, пользователь ждёт решения.</b>
    .approve = ✅ Подтвердить
    .reject = ❌ Отказать
    .about =
        Имя: <b>{$name}</b>
        Местоимения: <b>{$pronouns}</b>
        Гендерная идентичность: <b>{$gender}</b>
        Сексуальная идентичность: <b>{$sexuality}</b>
        Статус: <b>{$status ->
            *[New]                  ⏳ собеседование не начато.
             [InterviewInProgress]  ⏳ собеседование в процессе.
             [PendingApproval]      ⏳ собеседование закончено, ждём ответ.
             [Approved]             ✅ собеседование пройдено.
             [Rejected]             ❌ собеседование не пройдено.
             [Banned]               ⛔ пользователь забанен.
        }</b>

menu =
    .about =
        Имя: <b>{$name}</b>
        Местоимения: <b>{$pronouns}</b>
        Гендерная идентичность: <b>{$gender}</b>
        Сексуальная идентичность: <b>{$sexuality}</b>

    .back = ⬅️ Назад
    .profile = 👩🏽‍🎤 Мой профиль
    .update = 🔃 Обновить
    .name = Имя
    .pronouns = Местоимения
    .gender = Гендерная идентичность
    .sexuality = Сексуальная идентичность
    .edit = ✏️ Редактировать
    .edit_prompt = Что вы хотите отредактировать?
    .edit_name = Имя
    .edit_pronouns = Местоимения
    .edit_gender = Гендерную идентичность
    .edit_sexuality = Сексуальную идентичность

    .events = Предстоящие события:
    .event_title = {$signedUp ->
        *[no]          {$name}
         [approved] ✅ {$name}
         [rejected] ❌ {$name}
         [pending]  ⏳ {$name}
    } | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}
    .event =
        <b>{$name}</b>

        Когда: <b>{DATETIME($date, dateStyle: "short", timeStyle: "short")}</b>
    .signup_button = {$signedUp ->
        *[no]       Зарегистрироваться
         [approved] ✅ Вы зарегистрированы
         [rejected] ❌ Вы не зарегистрированы
         [pending]  ⏳ Ожидаем подтверждения
    }
    .cancel_signup_button = 🙅🏽‍♀️ Отменить регистрацию
    .cancel_signup_button_no = ⬅️ Нет
    .cancel_signup_button_yes = 🙅🏽‍♀️ Да
    .cancel_signup_confirmation = Вы действительно хотите отменить регистрацию?
    .who_else_coming_button = 👯‍♀️ Кто ещё будет?
    .event_participants =
        <b>Ещё записались:</b>

        {$participants}
    .event_participants_empty = Пока что никто не записался.
    .event_participant = <b><a href="tg://user?id={$id}">{$name}</a></b> (@{$username}), {$pronouns}
    .event_participant_no_username = <b><a href="tg://user?id={$id}">{$name}</a></b>, {$pronouns}

manage_events =
    .events = Предстоящие события:
    .event =
        <b>{$name}</b>

        Когда: <b>{DATETIME($date, dateStyle: "short", timeStyle: "short")}</b>

        -------

        {$text}

    .update = 🔃 Обновить
    .back = ⬅️ Назад
    .create = ➕ Создать событие
    .event_title = {$prefix} {$name} | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")} | {$suffix}
    .event_title_prefix = {$published ->
        [yes] 🚀
        [no] ▶️
        *[hidden] 📝
    }
    .event_title_suffix = {$participants}
    .event_title_suffix_with_pending = {$participants}+{$pending}⏳

    .confirmation = {$required ->
         [yes] ✅ Требуется подтверждение
        *[no]  ❌ Подтверждение не требуется
    }
    .payment = {$required ->
         [yes] ✅ Требуется оплата
        *[no]  ❌ Оплата не требуется
    }
    .visible = {$published ->
         [yes] ✅ Событие видно
        *[no]  🚀 Сделать событие видимым
    }
    .published = {$published ->
         [yes] ✅ Анонс опубликован
        *[no]  🚀 Опубликовать анонс
    }

    .publish_confirm = Вы действительно хотите опубликовать анонс события?
    .publish_yes = 🚀 Да
    .publish_no = ⬅️ Нет

    .add_post = ✏️ Добавить пост
    .edit_post = ✏️ Редактировать пост
    .edit_name = ✏️ Редактировать название
    .edit_date = ✏️ Редактировать дату

    .manage_participants = 👯‍♀️ Участники ({$participants})
    .manage_participants_with_pending = 👯‍♀️ Участники ({$participants}+{$pending}⏳)

    .delete = 🗑️ Удалить событие
    .delete_confirm =
        Вы действительно хотите удалить событие?
    .delete_yes = 🗑️ Да
    .delete_no = ⬅️ Нет

    .enter_name = Введите название события:
    .enter_date = Введите дату и время события:
    .date_invalid = Введите дату и время в формате <code>YYYY-MM-DD HH:MM</code>:'
    .date_in_past = Дата и время события не должны быть в прошлом.
    .event_in_past = Событие уже прошло.
    .enter_post =
        Введите текст поста с анонсом события.
        К посту можно прикрепить одну фотографию.
    .edit_success = Данные сохранены

    .event_created = Событие успешно создано.
    .signup_link = Ссылка для регистрации: <code>https://t.me/{$username}?start={$eventId}</code>.

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
    .event_participant = <b><a href="tg://user?id={$id}">{$name}</a></b> (@{$username}), {$pronouns}
    .event_participant_no_username = <b><a href="tg://user?id={$id}">{$name}</a></b>, {$pronouns}

event_signup =
    .event_in_past = Событие уже прошло.
    .unknown_event =
        Неизвестное событие.
        Возможно, мы накосячили со ссылкой в посте, напишите нам об этом.

    .pending_approval = Заявка на участие отправлена, скоро мы посмотрим её и вернёмся.
    .admin_message_pending_approval = ℹ️ Пользователь хочет на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.

    .pending_payment =
        Пожалуйста, оплатите участие в событии и пришлите скриншот с подтверждением оплаты в этот чат.

        Стоимость: <b>{$price}</b>
        IBAN: <b><code>{$iban}</code></b>
        Получатель: <b><code>{$recipient}</code></b>
    .admin_message_pending_payment = ℹ️ Ждём оплаты за <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.

    .registered = ✅ Вы зарегистрированы на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.
    .admin_message_registered = ✅ Пользователь зарегистрирован на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")} админом <a href="tg://user?id={$adminId}">{$adminName}</a> {$approveDate}.

    .rejected = ❌ К сожалению, мы не можем зарегистрировать вас на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.
    .admin_message_rejected = ❌ Пользователь не зарегистрирован на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")} админом <a href="tg://user?id={$adminId}">{$adminName}</a> {$rejectDate}.

    .rejected_with_refund =
        ❌ К сожалению, мы не можем зарегистрировать вас на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.

        Скоро мы напишем вам по поводу возврата денег.
    .admin_message_rejected_with_refund =
        ❌ Пользователь не зарегистрирован на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")} админом <a href="tg://user?id={$adminId}">{$adminName}</a> {$rejectDate}.

        ⚠️ Возможно, нужен возврат денег.

    .withdrawn = Вы отменили регистрацию на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.
    .admin_message_withdrawn = ℹ️ Пользователь отменил регистрацию на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.

    .withdrawn_with_refund =
        Вы отменили регистрацию на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.

        Скоро мы напишем вам по поводу возврата денег.
    .admin_message_withdrawn_with_refund =
        ℹ️ Пользователь отменил регистрацию на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.

        ⚠️ Возможно, нужен возврат денег.

    .prompt_signup = Хотите записаться на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}?
    .prompt_signup_no = ⬅️ Нет
    .prompt_signup_yes = ✅ Да
    .prompt_signup_reject_ok = Хорошо 😌👌

    .already_registered = Вы уже зарегистрированы на <b>{$name}</b> | {DATETIME($date, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short")}.