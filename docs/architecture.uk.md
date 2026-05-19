# SplitRace — Архітектура

> In English: [architecture.md](architecture.md)
>
> Детально про трекінг сегментів: [segment-tracking.uk.md](segment-tracking.uk.md)

SplitRace — це біговий додаток із GPS-турнірами. Бігун записує GPS-трек, система
визначає, через які сегменти турніру він пробіг, ранжує учасників у межах турніру
і пушить події в соцстрічку решті учасників.

## 1. Деплоюваності

Три незалежні кодові бази, всі звертаються до одного Rails API:

| Кодова база | Роль | Стек | Де працює |
|-------------|------|------|-----------|
| Rails API (`app/`, `config/`) | Джерело правди: auth, турніри, сегменти, скоринг, нотіфікації | Rails 8.1 + Postgres+PostGIS + Redis + Sidekiq | [Render](../render.yaml) |
| React-фронтенд (`frontend/`) | Веб-клієнт: перегляд турнірів/сегментів, адмінка, маркетинг | React + Vite + Tailwind + Leaflet/Mapbox | Статичні файли через Rails у проді |
| React Native додаток (`mobile/`) | Клієнт для бігунів: запис пробіжок, live-скоринг, push-нотіфікації | Expo SDK + RN + NativeWind + lucide-react-native | Android (EAS / GitHub APK build), iOS (EAS) |

Веб і мобілка ніколи не спілкуються напряму; обидва ходять до Rails API
на `/api/v1/*` через HTTPS з JWT bearer-токеном, виданим при логіні.

## 2. Модель домену

Цікаві моделі живуть у [app/models/](../app/models/). Що з чим зв'язано:

```
User ──┬── володіє ───► Tournament ──┬── has many ── TournamentSegment ── refs ── Segment
       │                              ├── has many ── TournamentParticipant ── refs ── User
       │                              ├── has many ── TournamentScore ── refs ── User
       │                              ├── has many ── TournamentSegmentUnlock ── refs ── User + SegmentEffort
       │                              └── has many ── TournamentEvent ── refs ── User (actor) + Segment
       ├── has many ── Activity ──── has many ── SegmentEffort ── refs ── Segment
       ├── has many ── Notification ── optionally refs ── TournamentEvent
       ├── has many ── DevicePushToken
       └── has many ── OauthIdentity
```

| Модель | Роль |
|--------|------|
| `User` | Auth-ідентичність. Має роль (`user`/`moderator`/`admin`), тип акаунта (`user`/`club`), `locale` (en/uk), `gender` (потрібно для скорингу). |
| `Segment` | Іменований маршрут, який можна перевикористовувати: `polyline` (PostGIS MultiLineString), `start_point`, `end_point`, дистанція. Належить юзеру; модерується через `is_active`. |
| `Tournament` | Контейнер, що включає N сегментів, з яких K — рейтингові (рахуються в скор). Має статус: `draft → pending_review → active → completed` (плюс `rejected`). |
| `TournamentSegment` | Join-таблиця, що додає сегменту в турнірі `order_number` і `is_rated`. |
| `TournamentParticipant` | Хто долучився до турніру (для `club`-юзерів — заборонено). |
| `Activity` | Записана пробіжка: GPS-точки (JSONB) + `gps_track` (PostGIS LineString) + час старту/фінішу + дистанція. |
| `SegmentEffort` | Один прохід одного сегмента одним юзером. На одного юзера може бути багато (по одному на кожну активність, що перетнула сегмент). |
| `TournamentSegmentUnlock` | Турнірне джерело правди, що користувач відкрив ordered `TournamentSegment` саме в цьому турнірі. Захищає від ситуації, коли старі глобальні efforts рахуються як новий турнірний прогрес. |
| `TournamentScore` | Агрегат на пару юзер-турнір: rank, gender_rank, completed_segments_count, score. Перераховується цілком після кожної нової пробіжки. |
| `TournamentEvent` | Запис у стрічці турніру, видимий усім учасникам (напр. "X opened Segment Y"). Title/body зберігається в дефолтній локалі; кожному глядачу рендериться його мовою з `metadata`. |
| `Notification` | Push/in-app нотіфікація конкретному отримувачу. Title/body пишуться при створенні мовою отримувача. |
| `DevicePushToken` | Expo push-токен, зареєстрований мобілкою; використовується `ExpoPushNotificationService`. |
| `CheatingReport` | Скарга юзера на іншого учасника турніру; розглядається модераторами. |

PostGIS — ключовий елемент. `gps_track`, `polyline`, `start_point`, `end_point` —
всі географічні типи, а матчинг сегментів використовує `ST_DWithin`
(див. [SegmentMatcher#passes_through?](../app/services/segment_matcher.rb)).

## 3. Скоринг: Golden Fever

Реалізовано в [TournamentScore.recalculate_all](../app/models/tournament_score.rb).

Для кожного юзера в турнірі, по кожному рейтинговому сегменту:

```
бали_сегмента = (найкращий_час_тієї_ж_статі / власний_найкращий_час) × 100
```

`власний_найкращий_час` — це **мінімальний** `elapsed_time_seconds` серед усіх
спроб юзера на цьому сегменті. Тобто повторний прохід повільніше — нічого не псує,
прохід швидше — покращує бали.

Якщо юзер закрив **усі** рейтингові сегменти, отримує бонус за загальне завершення,
залежно від порядку, в якому завершив останній з них:

```
бонус = всього_учасників × max(10 − rank, 0)
```

Місця 1–10 отримують бонус (за зменшенням); 11+ — 0.

Гендерні таблиці лідерів використовують той самий `score`, просто фільтрується
по статі через `gender_rank`. Якщо `gender = nil` — юзер не потрапляє в гендерні
таблиці (але в загальну — потрапляє).

## 4. Гарячий шлях: пробіжка → бали → нотіфікація

Коли бігун завершує запис на мобілці і POST'ить активність:

1. **`POST /api/v1/activities`** ([ActivitiesController#create](../app/controllers/api/v1/activities_controller.rb))
   - Парсить `gps_points` (JSONB-масив `{lat, lng, ts, accuracy}`) і будує
     `gps_track` як PostGIS LineString.
   - Створює `Activity`.
   - **Синхронно** запускає `SegmentMatcher.new(activity).call` та
     `TournamentScore.recalculate_all` для кожного активного турніру, в якому юзер бере участь.
2. **`SegmentMatcher`** ([app/services/segment_matcher.rb](../app/services/segment_matcher.rb))
   - Для кожного активного турніру юзера:
     - Ігнорує активності поза ефективним турнірним вікном:
       `max(tournament.starts_at, participant.joined_at)` до
       `tournament.ends_at`.
     - Перевіряє рейтингові сегменти за `order_number`, використовуючи
       адаптивний start/end proximity, GPS accuracy filtering, мінімальну
       GPS density, мінімальну matched distance, мінімальну matched duration
       і route coverage.
     - Перевіряє проходження маршруту через projection GPS-точок на polyline
       і вимагає монотонного progress along route.
     - При match створює/оновлює `SegmentEffort` і записує
       `TournamentSegmentUnlock` для наступного потрібного турнірного сегмента.
       Unlocks, а не історичні efforts, є джерелом правди для порядку і
       прогресу в турнірі.
3. **`TournamentEventPublisher.segment_unlocked!`** ([app/services/tournament_event_publisher.rb](../app/services/tournament_event_publisher.rb))
   - Створює `TournamentEvent` (видимий усім у стрічці турніру).
   - Для кожного учасника турніру **крім actor'а**:
     - Створює `Notification` локалізовану під його `user.locale`.
     - Викликає `ExpoPushNotificationService.deliver(notification)`, який
       no-op, якщо у юзера немає активних push-токенів.
4. **`TournamentScore.recalculate_all`** перераховує бали, гендерні ранги
   й бонусні ранги по всьому турніру.

Та сама логіка існує і як [MatchSegmentsJob](../app/jobs/match_segments_job.rb)
для асинхронних перезапусків (наприклад, бекфіли) — Sidekiq + Redis.

Повний алгоритм трекінгу сегментів, пороги, діаграми, покриті edge cases і
мапу тестів дивись у [Трекінг сегментів](segment-tracking.uk.md).

## 5. Авторизація

Три потоки, всі закінчуються JWT bearer-токеном, виданим [JwtService](../app/services/jwt_service.rb):

- **Email + пароль** → `POST /api/v1/auth/{register,login}` ([AuthController](../app/controllers/api/v1/auth_controller.rb), використовує `has_secure_password`).
- **Google** → мобілка через `expo-auth-session` отримує `id_token`, POST'ить на `/api/v1/auth/google`. Бекенд верифікує через [GoogleIdentityTokenVerifier](../app/services/google_identity_token_verifier.rb) (звертається до Google tokeninfo, перевіряє `aud` проти налаштованих env-змінних `GOOGLE_*_CLIENT_ID`).
- **Apple** → аналогічно, через [AppleIdentityTokenVerifier](../app/services/apple_identity_token_verifier.rb).

Кожний провайдер створює `OauthIdentity`, що зв'язує `sub` провайдера з User'ом.
Веб-фронтенд також користується класичним OmniAuth callback'ом на
`/auth/:provider/callback` для редірект-флоу.

Поточний юзер визначається в [`BaseController#authenticate_user!`](../app/controllers/api/v1/base_controller.rb),
який ще й виставляє `I18n.locale` з `current_user.locale` на весь запит через
`around_action` — саме завдяки цьому нотіфікації й стрічка приходять мовою глядача.

## 6. Нотіфікації

In-app:
- Записи `TournamentEvent` показуються у соцстрічці турніру (див. `tournaments#feed`).
  Title/body локалізуються при читанні з `metadata` під локаль глядача.
- Записи `Notification` рендеряться у списку нотіфікацій (іконка дзвіночка).
  Title/body пишуться при створенні мовою отримувача.

Push:
- Мобілка реєструє Expo push-токен через `POST /api/v1/push_tokens` на старті
  додатка (див. [mobile/src/services/pushNotifications.js](../mobile/src/services/pushNotifications.js)).
- [ExpoPushNotificationService](../app/services/expo_push_notification_service.rb)
  POST'ить на `https://exp.host/--/api/v2/push/send` для кожного активного токена;
  при `DeviceNotRegistered` — автоматично деактивує токен.

## 7. Інфраструктура

| Частина | Призначення | Де налаштовано |
|---------|-------------|----------------|
| Postgres + PostGIS | Основне сховище; географічні операції над треками/сегментами | [render.yaml](../render.yaml) (`splitrace-db`), gem `activerecord-postgis-adapter` |
| Redis | Sidekiq-черга, Action Cable (у майбутньому), кеш | [render.yaml](../render.yaml) (`splitrace-redis`) |
| Sidekiq | Фонові задачі (`MatchSegmentsJob`) | [config/sidekiq.yml](../config/sidekiq.yml) |
| Expo push servers | Доставка push на мобілку | зовнішнє; авторизація по токенах на пристрій |
| Google / Apple OAuth | Федеративна автентифікація | через env-змінні; див. [auth](#5-авторизація) |

## 8. Структура репи

```
splitrace/
├── app/                        # Rails-додаток
│   ├── controllers/api/v1/     # JSON API для мобілки + фронту
│   ├── controllers/admin/      # Серверно-рендерена адмінка (Slim views)
│   ├── models/                 # Доменні моделі
│   ├── services/               # OAuth-верифікатори, SegmentMatcher, push, JWT
│   └── jobs/                   # Sidekiq-задачі
├── config/
│   ├── routes.rb               # Усі ендпоінти
│   ├── locales/                # Бекенд i18n (en, uk) — тексти нотіфікацій тут
│   └── application.rb          # I18n + глобальний конфіг
├── db/                         # Schema + міграції (PostGIS-aware)
├── frontend/                   # Веб-додаток (Vite, Tailwind)
│   └── src/                    # pages, components, locales (en/uk)
├── mobile/                     # Expo React Native додаток
│   └── src/
│       ├── screens/            # Топ-рівневі екрани (Tournaments, RunTracker, …)
│       ├── components/         # Спільні компоненти (мапи, share-картки, модалки)
│       ├── api/client.js       # JSON-клієнт; читає JWT із SecureStore
│       ├── contexts/AuthContext.jsx
│       ├── i18n/locales/       # en.json, uk.json
│       └── services/           # Реєстрація push та інше
├── .github/workflows/          # CI + білд Android APK
├── docs/                       # ← ти тут
└── render.yaml                 # Конфіг деплою на Render
```

## 9. Що дивує нових розробників

- **Текст у стрічці турніру не зберігається як фінальні рядки.** `TournamentEvent.title/body`
  — це рендер у дефолтній локалі; контролер перерендерює під локаль запиту з
  `event.metadata`. Якщо додаєш новий тип події — обов'язково додай i18n-ключ
  і онови [`TournamentEventPublisher`](../app/services/tournament_event_publisher.rb)
  та `localized_event_text` у контролері.
- **Повторний прохід сегмента повільніше — ніколи не псує бали по сегменту**,
  але може погіршити бонусний ранг за «закрив усі сегменти», бо той бонус
  бере час останньої спроби серед усіх рейтингових сегментів, а не часу
  першого завершення. (Свідома компромісна спрощеність.)
- **Actor не отримує push на свій власний unlock**, але `TournamentEvent` усе одно
  видно йому у стрічці. Notification-запис теж не створюється.
- **GPS matching більше не є просто start/end proximity.** Matcher тепер
  вимагає route coverage, монотонний progress along polyline, мінімальну GPS
  density, мінімальний matched movement, перевірки tournament window і
  `TournamentSegmentUnlock` records для турнірного прогресу. Suspicious GPS
  позначається, а важкі GPS-сигнали reject matching, але продукт все ще
  трактує це як evidence для admin review, а не як автоматичний бан.
- **`mobile/android/` ігнорується git'ом** і регенерується `expo prebuild` на
  кожен білд. Не очікуй, що зміни там виживуть. Кастомізація — через
  `app.json`, `app.config.js`, expo-плагіни або post-prebuild патч у білд-workflow.
