/* KotakApp i18n v25: ru (исходный) → kk / en. Словарь: "ru|kk|en". Ключи с пробелом в конце = префикс, с пробелом в начале = суффикс. */
(function(){
const LANGS={ru:'Русский',kk:'Қазақша',en:'English'};
const LOC={ru:'ru',kk:'kk',en:'en-GB'};
let L='ru'; try{ L=localStorage.getItem('kotak_lang')||'ru'; }catch(e){}
if(!LANGS[L]) L='ru';
window.LANGS=LANGS; window.LANG=L; window.LC=LOC[L];
document.documentElement.lang=L;
if(L==='ru'){ window.tr=s=>s; return; }
const DATA=`
Вы|Сіз|You
Чат|Чат|Chat
Все|Барлығы|Everyone
Имя|Аты|Name
Идея|Идея|Idea
Фото|Фото|Photo
Язык|Тіл|Language
Обои|Фон|Wallpaper
файл|файл|file
Дети|Балалар|Children
Чаты|Чаттар|Chats
изм.|өзг.|edited
Звук|Дыбыс|Sound
Меню|Мәзір|Menu
Тема|Тақырып|Theme
Ночь|Түн|Night
Видео|Бейне|Video
Скоро|Жақында|Soon
Войти|Кіру|Log in
Никто|Ешкім|Nobody
Архив|Мұрағат|Archive
Ответ|Жауап|Reply
Медиа|Медиа|Media
Назад|Артқа|Back
Синяя|Көк|Blue
Поиск|Іздеу|Search
Ссылки|Сілтемелер|Links
О себе|Өзім туралы|About me
Вызов…|Қоңырау…|Calling…
Камера|Камера|Camera
 вышел| шықты| left
В сети|Желіде|Online
📷 Фото|📷 Фото|📷 Photo
Бирюза|Көгілдір|Teal
Ошибка|Қате|Error
Готово|Дайын|Done
Мелкий|Кіші|Small
в сети|желіде|online
Личные|Жеке|Personal
Пароль|Құпиясөз|Password
Графит|Графит|Graphite
Отмена|Бас тарту|Cancel
Фото: |Фото: |Photo: 
Кто мы|Біз кімбіз|Who we are
Помощь|Көмек|Help
аноним|аноним|anonymous
ошибка|қате|error
Группа|Топ|Group
Чёрная|Қара|Black
Звонок|Қоңырау|Call
Фиолет|Күлгін|Violet
Аврора|Аврора|Aurora
Группы|Топтар|Groups
Аккаунт|Аккаунт|Account
Обычный|Қалыпты|Normal
🎬 Видео|🎬 Бейне|🎬 Video
Удалить|Жою|Delete
Крупный|Үлкен|Large
История|Тарих|Story
Вернуть|Қайтару|Restore
Профиль|Профиль|Profile
Считаю…|Санап жатырмын…|Counting…
Закрыть|Жабу|Close
Принять|Қабылдау|Accept
 в сети| желіде| online
Новых: |Жаңа: |New: 
Микрофон|Микрофон|Microphone
Изменить|Өзгерту|Edit
Ответить|Жауап беру|Reply
Вибрация|Дірілдеу|Vibration
Ошибка: |Қате: |Error: 
Вложение|Тіркеме|Attachment
Написать|Жазу|Message
Контакты|Контактілер|Contacts
Участник|Қатысушы|Member
Проверяю…|Тексеріп жатырмын…|Checking…
 свободен| бос| is available
Загружаю…|Жүктелуде…|Loading…
Соединяю…|Қосылуда…|Connecting…
Изменения|Өзгерістер|Changes
Без обоев|Фонсыз|No wallpaper
печатает…|жазып жатыр…|typing…
Не в сети|Желіде емес|Offline
Реакция: |Реакция: |Reaction: 
Профиль: |Профиль: |Profile: 
не в сети|желіде емес|offline
Новый чат|Жаңа чат|New chat
Настройки|Баптаулар|Settings
Отправить|Жіберу|Send
Выбрано: |Таңдалды: |Selected: 
Завершить|Аяқтау|End call
Сохранить|Сақтау|Save
Поддержка|Қолдау|Support
Группа · |Топ · |Group · 
Голосовые|Дауыстық|Voice
Обращения|Өтініштер|Requests
Сообщение|Хабарлама|Message
Отправляю…|Жіберілуде…|Sending…
Публикую…|Жарияланып жатыр…|Publishing…
Недоступно|Қолжетімсіз|Unavailable
Отправлено|Жіберілді|Sent
 уже занят| бос емес| is already taken
Нет ответа|Жауап жоқ|No answer
Ваши права|Сіздің құқықтарыңыз|Your rights
Архив пуст|Мұрағат бос|Archive is empty
 или камере| немесе камераға| or camera
Не найдено.|Табылмады.|Not found.
Пока пусто.|Әзірге бос.|Nothing here yet.
Поиск чатов|Чаттарды іздеу|Search chats
Уведомления|Хабарландырулар|Notifications
Разработчик|Әзірлеуші|Developer
🎤 Голосовое|🎤 Дауыстық|🎤 Voice message
Скоро будет|Жақында болады|Coming soon
Обращение: |Өтініш: |Request: 
Изменение: |Өзгерту: |Editing: 
✎ Изменение: |✎ Өзгерту: |✎ Editing: 
Фото профиля|Профиль фотосы|Profile photo
Список пуст.|Тізім бос.|The list is empty.
Заблокирован|Бұғатталған|Blocked
Новая группа|Жаңа топ|New group
Опубликовать|Жариялау|Publish
Админ-панель|Әкімші панелі|Admin panel
Удалить фото|Фотоны жою|Remove photo
Фото удалено|Фото жойылды|Photo removed
Пользователь|Пайдаланушы|User
Онлайн и лог|Онлайн және журнал|Online & log
Пользователи|Пайдаланушылар|Users
О приложении|Қолданба туралы|About
Добавить фото|Фото қосу|Add photo
Размер текста|Мәтін өлшемі|Text size
Абонент занят|Абонент бос емес|Line is busy
Сейчас онлайн|Қазір онлайн|Online now
Непрочитанные|Оқылмаған|Unread
Уведомления: |Хабарландырулар: |Notifications: 
Изменить фото|Фотоны өзгерту|Change photo
Ошибка звонка|Қоңырау қатесі|Call error
Перезагрузить|Қайта жүктеу|Reload
Чёрный список|Қара тізім|Blocklist
Заблокировать|Бұғаттау|Block
Разблокирован|Бұғат алынды|Unblocked
Новая история|Жаңа тарих|New story
Кто что видит|Кім нені көреді|Who sees what
Отменить ответ|Жауапты болдырмау|Cancel reply
Удалить у меня|Менде жою|Delete for me
Звук сообщений|Хабарлама дыбысы|Message sound
Не удалилось: |Жойылмады: |Not deleted: 
Фото обновлено|Фото жаңартылды|Photo updated
С возвращением|Қайта келгеніңізбен|Welcome back
Разблокировать|Бұғатты алу|Unblock
Загружаю фото…|Фото жүктелуде…|Uploading photo…
Создать группу|Топ құру|Create group
Не сохранено: |Сақталмады: |Not saved: 
Удалить у всех|Барлығында жою|Delete for everyone
Новое сообщение|Жаңа хабарлама|New message
Данные и память|Деректер мен жад|Data & storage
История удалена|Тарих жойылды|Story deleted
Отменить запись|Жазуды болдырмау|Cancel recording
Не отправлено: |Жіберілмеді: |Not sent: 
Посмотреть фото|Фотоны қарау|View photo
Звонок уже идёт|Қоңырау жүріп жатыр|A call is already in progress
Звонок завершён|Қоңырау аяқталды|Call ended
Настройки чатов|Чат баптаулары|Chat settings
Чатов пока нет.|Чаттар әзірге жоқ.|No chats yet.
Входящий звонок|Кіріс қоңырау|Incoming call
Создание чата: |Чат құру: |Creating chat: 
Название группы|Топ атауы|Group name
Новые сообщения|Жаңа хабарламалар|New messages
Создать аккаунт|Аккаунт құру|Create account
Звонок пропущен|Қоңырау өткізіліп кетті|Missed call
Файл недоступен|Файл қолжетімсіз|File unavailable
Кто может писать|Кім жаза алады|Who can message me
Изменить профиль|Профильді өзгерту|Edit profile
Не загрузилось: |Жүктелмеді: |Failed to load: 
Профиль сохранён|Профиль сақталды|Profile saved
Это твой аккаунт|Бұл — сенің аккаунтың|This is your account
Как вас называть|Сізді қалай атаймыз|What should we call you
Проверь username|Username тексер|Check the username
📷 Фото или видео|📷 Фото немесе бейне|📷 Photo or video
📷 Загрузить фото|📷 Фото жүктеу|📷 Upload photo
Имя пользователя|Пайдаланушы аты|Username
Добавить контакт|Контакт қосу|Add contact
Уведомления чатов|Чат хабарландырулары|Chat notifications
например, alex_01|мысалы, alex_01|e.g. alex_01
Выйти из аккаунта|Аккаунттан шығу|Log out
Видимость профиля|Профиль көрінуі|Profile visibility
Создание группы: |Топ құру: |Creating group: 
Что пошло не так?|Не дұрыс болды?|What went wrong?
Сообщение удалено|Хабарлама жойылды|Message deleted
Результаты поиска|Іздеу нәтижелері|Search results
Не опубликовано: |Жарияланбады: |Not published: 
Мои файлы в чатах|Чаттардағы файлдарым|My files in chats
Видимость статуса|Статус көрінуі|Status visibility
Не заблокирован: |Бұғатталмады: |Not blocked: 
🎬 Загрузить видео|🎬 Бейне жүктеу|🎬 Upload video
Конфиденциальность|Құпиялылық|Privacy
Найти по @username|@username бойынша іздеу|Find by @username
Зарегистрироваться|Тіркелу|Sign up
Выйти из аккаунта?|Аккаунттан шығасыз ба?|Log out?
Удалить обращение?|Өтінішті жою керек пе?|Delete this request?
Создатель KotakApp|KotakApp жасаушысы|KotakApp creator
Записать голосовое|Дауыстық жазу|Record voice message
Сообщить об ошибке|Қате туралы хабарлау|Report a bug
Автозагрузка медиа|Медианы автожүктеу|Auto-download media
+ Добавить историю|+ Тарих қосу|+ Add story
Написать создателю|Жасаушыға жазу|Message the creator
Сообщений пока нет|Хабарламалар әзірге жоқ|No messages yet
Истории недоступны|Тарихтар қолжетімсіз|Stories unavailable
Где хранятся данные|Деректер қайда сақталады|Where data is stored
Чего мы не собираем|Нені жинамаймыз|What we don't collect
🚫 Сообщение удалено|🚫 Хабарлама жойылды|🚫 Message deleted
Управление профилем|Профильді басқару|Manage profile
Предпросмотр текста|Мәтінді алдын ала көру|Text preview
Не менее 8 символов|Кемінде 8 таңба|At least 8 characters
Спасибо, отправлено|Рахмет, жіберілді|Thanks, sent
Обращений пока нет.|Өтініштер әзірге жоқ.|No requests yet.
Как создать группу?|Топты қалай құруға болады?|How do I create a group?
Как найти человека?|Адамды қалай табуға болады?|How do I find someone?
Входящий видеозвонок|Кіріс бейнеқоңырау|Incoming video call
Не удалось открыть: |Ашу мүмкін болмады: |Couldn't open: 
Предложить улучшение|Жақсарту ұсыну|Suggest an improvement
Уведомления включены|Хабарландырулар қосылды|Notifications on
Нет активной истории|Белсенді тарих жоқ|No active story
Удалить эту историю?|Бұл тарихты жою керек пе?|Delete this story?
Звонок не был принят|Қоңырау қабылданбады|The call wasn't answered
Не удалось загрузить|Жүктеу мүмкін болмады|Couldn't load
История опубликована|Тарих жарияланды|Story published
Версия |Нұсқа |Version 
Проверить базу данных|Дерекқорды тексеру|Check database
Обращения в поддержку|Қолдау өтініштері|Support requests
Только фото или видео|Тек фото немесе бейне|Photos or videos only
Введи название группы|Топ атауын енгіз|Enter a group name
Уведомления выключены|Хабарландырулар өшірілді|Notifications off
Не удалось проверить: |Тексеру мүмкін болмады: |Couldn't check: 
Какие данные мы храним|Қандай деректерді сақтаймыз|What data we store
Не приходят уведомления|Хабарландырулар келмейді|Not getting notifications
Абонент отклонил звонок|Абонент қоңырауды қабылдамады|The call was declined
Аккаунт owner не найден|owner аккаунты табылмады|Owner account not found
Фото, видео и голосовые|Фото, бейне және дауыстық|Photos, videos and voice messages
Уже есть аккаунт? Войти|Аккаунтыңыз бар ма? Кіру|Already have an account? Log in
Нет доступа к микрофону|Микрофонға рұқсат жоқ|No microphone access
Введи минимум 2 символа.|Кемінде 2 таңба енгіз.|Enter at least 2 characters.
Вложение не отправлено: |Тіркеме жіберілмеді: |Attachment not sent: 
Непрочитанных чатов нет.|Оқылмаған чаттар жоқ.|No unread chats.
Пользователи не найдены.|Пайдаланушылар табылмады.|No users found.
Напиши хотя бы пару слов|Кемінде бірнеше сөз жаз|Write at least a few words
Блокировка пользователей|Пайдаланушыларды бұғаттау|Blocking users
Ошибка загрузки аккаунта|Аккаунтты жүктеу қатесі|Account loading error
Голосовое не отправлено: |Дауыстық хабарлама жіберілмеді: |Voice message not sent: 
Автовоспроизведение видео|Бейнені автоойнату|Autoplay video
Прикрепить фото или видео|Фото немесе бейне тіркеу|Attach photo or video
Обновлено: 28 ноября 2026|Жаңартылды: 2026 жылғы 28 қараша|Updated: 28 November 2026
Как сменить фото профиля?|Профиль фотосын қалай ауыстыруға болады?|How do I change my profile photo?
Пользователь заблокирован|Пайдаланушы бұғатталды|User blocked
В этом разделе чатов нет.|Бұл бөлімде чаттар жоқ.|No chats in this section.
Эта функция скоро появится|Бұл функция жақында қосылады|This feature is coming soon
Не удалось выполнить вход.|Кіру мүмкін болмады.|Couldn't log in.
Не удалось обработать фото|Фотоны өңдеу мүмкін болмады|Couldn't process the photo
Данные на вашем устройстве|Құрылғыңыздағы деректер|Data on your device
Что улучшить или добавить?|Нені жақсарту немесе қосу керек?|What to improve or add?
Выберите чат, чтобы начать|Бастау үшін чатты таңдаңыз|Select a chat to start
3–24 символа: a–z, 0–9 и _|3–24 таңба: a–z, 0–9 және _|3–24 characters: a–z, 0–9 and _
Слишком короткое сообщение|Хабарлама тым қысқа|Message is too short
Не удалось воспроизвести: |Ойнату мүмкін болмады: |Couldn't play: 
Политика конфиденциальности|Құпиялылық саясаты|Privacy Policy
Новое обращение в поддержку|Қолдауға жаңа өтініш|New support request
Найти участника по username|Қатысушыны username бойынша іздеу|Find a member by username
Уведомления отдельных чатов|Жеке чат хабарландырулары|Per-chat notifications
Только после моего сообщения|Тек менің хабарламамнан кейін|Only after my message
Ссылок в переписке пока нет.|Хат алмасуда сілтемелер әзірге жоқ.|No links in this chat yet.
Отображение времени сообщений|Хабарлама уақытын көрсету|Show message time
Официальный аккаунт владельца|Иесінің ресми аккаунты|Official owner account
Голосовых сообщений пока нет.|Дауыстық хабарламалар әзірге жоқ.|No voice messages yet.
Можно ли восстановить пароль?|Құпиясөзді қалпына келтіруге бола ма?|Can I recover my password?
Написать владельцу в KotakApp|KotakApp-та иесіне жазу|Message the owner in KotakApp
Войди в свой аккаунт KotakApp|KotakApp аккаунтыңа кір|Log in to your KotakApp account
Сколько хранятся фото и видео?|Фото мен бейне қанша сақталады?|How long are photos and videos kept?
Выбери хотя бы одного участника|Кемінде бір қатысушыны таңда|Choose at least one member
Нет аккаунта? Зарегистрироваться|Аккаунтыңыз жоқ па? Тіркелу|No account? Sign up
Не удалось запустить приложение.|Қолданбаны іске қосу мүмкін болмады.|Couldn't start the app.
Здесь ваши истории хранятся 15 дней|Мұнда тарихтарыңыз 15 күн сақталады|Your stories are kept here for 15 days
🕓 Файл удалён (срок хранения истёк)|🕓 Файл жойылды (сақтау мерзімі өтті)|🕓 File deleted (retention period expired)
Расскажите о себе (до 200 символов)|Өзіңіз туралы жазыңыз (200 таңбаға дейін)|Tell us about yourself (up to 200 characters)
Удалить сообщение у всех участников?|Хабарламаны барлық қатысушыларда жою керек пе?|Delete the message for all members?
Можно отправлять только фото и видео|Тек фото мен бейне жіберуге болады|Only photos and videos can be sent
Придумай уникальный username и пароль|Бірегей username мен құпиясөз ойлап тап|Pick a unique username and password
Добавьте описание: Профиль → Изменить|Сипаттама қосыңыз: Профиль → Өзгерту|Add a bio: Profile → Edit
Сначала закончите изменение сообщения|Алдымен хабарламаны өзгертуді аяқтаңыз|Finish editing the message first
Видео больше 50 МБ. Выберите покороче.|Бейне 50 МБ-тан үлкен. Қысқарақ таңдаңыз.|Video is over 50 MB. Pick a shorter one.
Видео больше 25 МБ. Выберите покороче.|Бейне 25 МБ-тан үлкен. Қысқарақ таңдаңыз.|Video is over 25 MB. Pick a shorter one.
Напишите текст или выберите фото/видео|Мәтін жазыңыз немесе фото/бейне таңдаңыз|Write some text or choose a photo/video
Уведомления недоступны в этом браузере|Бұл браузерде хабарландырулар қолжетімсіз|Notifications aren't available in this browser
Файлы хранятся 15 дней, затем удаляются.|Файлдар 15 күн сақталады, содан кейін жойылады.|Files are kept for 15 days, then deleted.
Звонки не поддерживаются в этом браузере|Бұл браузерде қоңыраулар қолдау таппайды|Calls aren't supported in this browser
Звонки пока доступны только в личных чатах|Қоңыраулар әзірге тек жеке чаттарда қолжетімді|Calls are only available in private chats for now
Пароль должен содержать минимум 8 символов.|Құпиясөз кемінде 8 таңбадан тұруы керек.|Password must be at least 8 characters.
Username: 3–24 символа, только a-z, 0-9 и _.|Username: 3–24 таңба, тек a-z, 0-9 және _.|Username: 3–24 characters, only a-z, 0-9 and _.
Профиль → нажми на аватар → «Изменить фото».|Профиль → аватарды бас → «Фотоны өзгерту».|Profile → tap the avatar → “Change photo”.
Абонент недоступен: приложение у него закрыто|Абонент қолжетімсіз: қолданбасы жабық|User unavailable: their app is closed
Идеи, ошибки и вопросы можно писать прямо сюда.|Идея, қате және сұрақтарды осында жаза аласыз.|Ideas, bugs and questions can be sent right here.
Запись голоса не поддерживается в этом браузере.|Бұл браузерде дауыс жазу қолдау таппайды.|Voice recording isn't supported in this browser.
Файл не выбран. Можно опубликовать только текст.|Файл таңдалмады. Тек мәтінді жариялауға болады.|No file chosen. You can publish text only.
KotakApp не предназначен для детей младше 13 лет.|KotakApp 13 жасқа дейінгі балаларға арналмаған.|KotakApp is not intended for children under 13.
Чатов пока нет. Найди друзей во вкладке «Контакты».|Чаттар әзірге жоқ. Достарыңды «Контактілер» қойындысынан тап.|No chats yet. Find friends in the “Contacts” tab.
Supabase не загрузился. Проверь интернет-соединение.|Supabase жүктелмеді. Интернет байланысын тексер.|Supabase failed to load. Check your internet connection.
История видна друзьям 24 часа, потом попадает в архив|Тарих достарға 24 сағат көрінеді, содан кейін мұрағатқа түседі|A story is visible to friends for 24 hours, then goes to the archive
Фото и видео в этом чате пока нет. Файлы хранятся 15 дней.|Бұл чатта фото мен бейне әзірге жоқ. Файлдар 15 күн сақталады.|No photos or videos in this chat yet. Files are kept for 15 days.
Пока нет: вход только по username и паролю. Запомни пароль.|Әзірге жоқ: кіру тек username мен құпиясөз арқылы. Құпиясөзді есте сақта.|Not yet: login is by username and password only. Remember your password.
Вкладка «Контакты» → поиск по @username → кнопка «Написать».|«Контактілер» қойындысы → @username бойынша іздеу → «Жазу» түймесі.|“Contacts” tab → search by @username → “Message” button.
Контактов пока нет. Найди человека по @username и напиши ему.|Контактілер әзірге жоқ. Адамды @username бойынша тауып, жаз.|No contacts yet. Find someone by @username and message them.
Не удалось загрузить Supabase. Проверь подключение к интернету.|Supabase жүктелмеді. Интернет байланысын тексер.|Couldn't load Supabase. Check your internet connection.
смена username пока недоступна (сервер требует подтверждение email)|username ауыстыру әзірге қолжетімсіз (сервер email растауын талап етеді)|changing username isn't available yet (server requires email confirmation)
Нет доступа к микрофону. Разреши его для сайта в настройках Chrome.|Микрофонға рұқсат жоқ. Chrome баптауларында сайтқа рұқсат бер.|No microphone access. Allow it for this site in Chrome settings.
Файлы из чатов удаляются автоматически через 15 дней, текст остаётся.|Чаттағы файлдар 15 күннен кейін автоматты жойылады, мәтін қалады.|Chat files are deleted automatically after 15 days; text stays.
Если правила изменятся, мы обновим этот текст и дату вверху страницы.|Ереже өзгерсе, осы мәтінді және беттің жоғарғы жағындағы күнді жаңартамыз.|If the rules change, we'll update this text and the date at the top of the page.
Разрешение не выдано. Включи уведомления для сайта в настройках браузера.|Рұқсат берілмеді. Браузер баптауларында сайт үшін хабарландыруды қос.|Permission not granted. Enable notifications for this site in browser settings.
Не удалось соединиться. Возможно, сеть не поддерживает прямое соединение.|Қосылу мүмкін болмады. Желі тікелей байланысты қолдамауы мүмкін.|Couldn't connect. The network may not support direct connections.
В шапке списка чатов нажми ⋮ → «Новая группа», выбери участников по username.|Чаттар тізімінің үстіндегі ⋮ → «Жаңа топ» басып, қатысушыларды username бойынша таңда.|In the chat list header tap ⋮ → “New group” and pick members by username.
Среди контактов никого нет. Введи ещё символ, чтобы искать по всем пользователям.|Контактілерде ешкім жоқ. Барлық пайдаланушылардан іздеу үшін тағы бір таңба енгіз.|No one in your contacts. Type one more character to search all users.
Регистрация по username. Для восстановления пароля позже добавим подтверждённый способ связи.|Тіркелу username арқылы. Құпиясөзді қалпына келтіру үшін кейін расталған байланыс тәсілін қосамыз.|Sign-up is by username. We'll add a verified contact method for password recovery later.
Аккаунт создан. Если включено подтверждение email, отключи Confirm email в Supabase и попробуй снова.|Аккаунт құрылды. Email растау қосулы болса, Supabase-те Confirm email өшіріп, қайта көр.|Account created. If email confirmation is on, disable Confirm email in Supabase and try again.
На iPhone сначала добавь сайт на экран «Домой»: Поделиться → На экран Домой. Потом открой его оттуда.|iPhone-да алдымен сайтты «Үйге» экранына қос: Бөлісу → Үй экранына. Содан кейін сол жерден аш.|On iPhone, first add the site to your Home Screen: Share → Add to Home Screen. Then open it from there.
Заблокированный не сможет писать тебе в личку, а ты ему, пока не разблокируешь. В группах блок не действует.|Бұғатталған адам саған жеке жаза алмайды, сен де оған — бұғатты алғанша. Топтарда бұғат жұмыс істемейді.|A blocked user can't message you privately and you can't message them until you unblock. Blocking doesn't apply in groups.
Файлы, которые ты отправил и которые ещё хранятся. Через 15 дней после отправки они удаляются автоматически.|Сен жіберген және әлі сақталған файлдар. Жіберілгеннен 15 күннен кейін автоматты жойылады.|Files you sent that are still stored. They are deleted automatically 15 days after sending.
Мы не просим телефон и настоящий email: вход идёт по username. Мы не продаём данные и не показываем рекламу.|Телефон мен нақты email сұрамаймыз: кіру username арқылы. Деректерді сатпаймыз және жарнама көрсетпейміз.|We don't ask for a phone number or real email: login is by username. We don't sell data or show ads.
Лог за текущий сеанс: входы и выходы, регистрации, обращения. Текст переписок не показывается.|Ағымдағы сеанс журналы: кіру-шығу, тіркелу, өтініштер. Хат алмасу мәтіні көрсетілмейді.|Log for the current session: sign-ins and sign-outs, registrations, requests. Message text is not shown.
Пароль хранится в Supabase только в виде необратимого хеша. Владелец приложения не может его увидеть или восстановить.|Құпиясөз Supabase-те тек қайтымсыз хэш түрінде сақталады. Қолданба иесі оны көре де, қалпына келтіре де алмайды.|Your password is stored in Supabase only as an irreversible hash. The app owner can't see or recover it.
Если выбрано «Никто», другие не увидят твоё «в сети» и «печатает…». Ты сам тоже не будешь отображаться онлайн для других.|«Ешкім» таңдалса, басқалар сенің «желіде» және «жазып жатыр…» күйіңді көрмейді.|If you choose “Nobody”, others won't see your “online” and “typing…” status.
Часть настроек (тема, размер текста, обои, звук, мьют чатов) хранится только в вашем браузере и на сервер не отправляется.|Кейбір баптаулар (тақырып, мәтін өлшемі, фон, дыбыс, чаттарды өшіру) тек браузеріңізде сақталады, серверге жіберілмейді.|Some settings (theme, text size, wallpaper, sound, muted chats) are stored only in your browser and not sent to the server.
Это официальный аккаунт автора и владельца приложения. Галочка подтверждает, что вы общаетесь с настоящим создателем.|Бұл қолданба авторы мен иесінің ресми аккаунты. Белгі сіз нақты жасаушымен сөйлесіп жатқаныңызды растайды.|This is the official account of the app's author and owner. The badge confirms you're talking to the real creator.
Работает только в открытом приложении на этом устройстве: без звука, вибрации и всплывающих подсказок.|Тек осы құрылғыда ашық қолданбада жұмыс істейді: дыбыссыз, дірілсіз және қалқымалы хабарларсыз.|Works only in the open app on this device: no sound, vibration or pop-up hints.
Эта функция скоро появится|Бұл функция жақында қосылады|This feature is coming soon
Загрузить|Жүктеу|Upload
Поделиться|Бөлісу|Share
Пересланное|Жіберілген|Forwarded
Сегодня|Бүгін|Today
Вчера|Кеше|Yesterday
Видимость|Көрінуі|Visibility
Подтвердить|Растау|Confirm
Продолжить|Жалғастыру|Continue
Имя пользователя (username)|Пайдаланушы аты (username)|Username
Отображаемое имя|Көрсетілетін аты|Display name
О себе (до 200 символов)|Өзім туралы (200 таңбаға дейін)|About me (up to 200 characters)
Сообщение…|Хабарлама…|Message…
Написать сообщение…|Хабарлама жазу…|Write a message…
Пароль (минимум 8 символов)|Құпиясөз (кемінде 8 таңба)|Password (at least 8 characters)
Username|Username|Username
Участники · |Қатысушылар · |Members · 
Ответ на |Жауап: |Reply to 
 ч| сағ| h
идея|идея|idea
ещё |тағы |+
 уч.| қатысушы| members
Реакции: |Реакциялар: |Reactions: 
Удаление: |Жою: |Deleting: 
Всего аккаунтов|Барлық аккаунттар|Total accounts
. Разреши его для сайта в настройках браузера.|. Браузер баптауларында сайтқа рұқсат бер.|. Allow it for this site in browser settings.
 (выполни SQL из чата в Supabase)| (чаттағы SQL-ді Supabase-те орында)| (run the SQL from the chat in Supabase)
`;
const D={};
DATA.split('\n').forEach(l=>{ if(!l) return; const p=l.split('|'); if(p.length<3) return; D[p[0]]=L==='kk'?p[1]:p[2]; });
const pre=[], suf=[];
Object.keys(D).forEach(k=>{ if(/(: | · | )$/.test(k)&&k.trim().length>2) pre.push(k); else if(k[0]===' '||k[0]==='.') suf.push(k); });
pre.sort((a,b)=>b.length-a.length); suf.sort((a,b)=>b.length-a.length);
const RU=/[А-Яа-яЁё]/;
function tr(s){
  if(typeof s!=='string'||!RU.test(s)) return s;
  const t=s.trim(); if(D[t]!==undefined) return s.replace(t,D[t]);
  if(D[s]!==undefined) return D[s];
  for(const k of pre) if(s.startsWith(k)) return D[k]+s.slice(k.length);
  for(const k of suf) if(s.endsWith(k)) return s.slice(0,-k.length)+D[k];
  return s;
}
window.tr=tr;
const ATTRS=['placeholder','title','aria-label','alt'];
function fixNode(n){
  if(n.nodeType===3){ const v=n.nodeValue; if(RU.test(v)){ const r=tr(v); if(r!==v) n.nodeValue=r; } return; }
  if(n.nodeType!==1||n.tagName==='SCRIPT'||n.tagName==='STYLE') return;
  for(const a of ATTRS){ const v=n.getAttribute&&n.getAttribute(a); if(v&&RU.test(v)){ const r=tr(v); if(r!==v) n.setAttribute(a,r); } }
  n.childNodes.forEach(fixNode);
}
const _alert=window.alert.bind(window), _confirm=window.confirm.bind(window);
window.alert=m=>_alert(String(m).split('\n').map(tr).join('\n'));
window.confirm=m=>_confirm(tr(String(m)));
const mo=new MutationObserver(ms=>{
  for(const m of ms){
    if(m.type==='childList') m.addedNodes.forEach(fixNode);
    else if(m.type==='characterData') fixNode(m.target);
    else if(m.type==='attributes'){ const v=m.target.getAttribute(m.attributeName); if(v&&RU.test(v)){ const r=tr(v); if(r!==v) m.target.setAttribute(m.attributeName,r); } }
  }
});
function start(){ fixNode(document.body); mo.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS}); }
document.body?start():document.addEventListener('DOMContentLoaded',start);
})();
