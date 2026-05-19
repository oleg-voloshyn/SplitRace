# SplitRace — Architecture

> Українською: [architecture.uk.md](architecture.uk.md)
>
> Segment tracking deep dive: [segment-tracking.md](segment-tracking.md)

SplitRace is a GPS-tournament running app. Runners record GPS tracks; the system
detects which tournament segments their route passed through, ranks them per
tournament, and pushes social-feed events to other participants.

## 1. Deployables

Three independent codebases that talk to one Rails API:

| Codebase | Role | Tech | Where it runs |
|----------|------|------|---------------|
| Rails API (`app/`, `config/`) | Source of truth: auth, tournaments, segments, scoring, notifications | Rails 8.1 + Postgres+PostGIS + Redis + Sidekiq | [Render](../render.yaml) |
| React frontend (`frontend/`) | Web client: browse tournaments/segments, admin tools, marketing pages | React + Vite + Tailwind + Leaflet/Mapbox | Served as static files by Rails in prod |
| React Native app (`mobile/`) | Runner client: record runs, view live scoring, get push notifications | Expo SDK + RN + NativeWind + lucide-react-native | Android (EAS / GitHub APK build), iOS (EAS) |

Web and mobile never talk to each other; both call the Rails API at
`/api/v1/*` over HTTPS with a JWT bearer token issued at login.

## 2. Domain model

The interesting models live in [app/models/](../app/models/). Relationships
that matter:

```
User ──┬── owns ───────► Tournament ──┬── has many ── TournamentSegment ── refs ── Segment
       │                              ├── has many ── TournamentParticipant ── refs ── User
       │                              ├── has many ── TournamentScore ── refs ── User
       │                              ├── has many ── TournamentSegmentUnlock ── refs ── User + SegmentEffort
       │                              └── has many ── TournamentEvent ── refs ── User (actor) + Segment
       ├── has many ── Activity ──── has many ── SegmentEffort ── refs ── Segment
       ├── has many ── Notification ── optionally refs ── TournamentEvent
       ├── has many ── DevicePushToken
       └── has many ── OauthIdentity
```

| Model | Role |
|-------|------|
| `User` | Auth identity. Has role (`user`/`moderator`/`admin`), account type (`user`/`club`), `locale` (en/uk), `gender` (matters for scoring). |
| `Segment` | A reusable named route with `polyline` (PostGIS MultiLineString), `start_point`, `end_point`, distance. Owned by a User; admin-moderated via `is_active`. |
| `Tournament` | A container that picks N segments, of which K are "rated" (count towards the score). Has status: `draft → pending_review → active → completed` (plus `rejected`). |
| `TournamentSegment` | Join table that adds `order_number` and `is_rated` to a segment within a tournament. |
| `TournamentParticipant` | Who joined the tournament (cannot be a `club` user). |
| `Activity` | A recorded run: GPS points (JSONB) + `gps_track` (PostGIS LineString) + start/finish times + distance. |
| `SegmentEffort` | One run-through of one segment by one user. There can be many per user/segment (one per activity that crossed the segment). |
| `TournamentSegmentUnlock` | Tournament-specific source of truth that a user opened an ordered `TournamentSegment` in this tournament. Prevents old global efforts from counting as new tournament progress. |
| `TournamentScore` | Per-user-per-tournament aggregate: rank, gender_rank, completed_segments_count, score. Recomputed wholesale after each new run. |
| `TournamentEvent` | Feed entry shown to all tournament participants (e.g. "X opened Segment Y"). Title/body stored in default locale; re-rendered per viewer's locale from `metadata`. |
| `Notification` | Per-recipient push/in-app notification. Title/body stored in recipient's locale at creation time. |
| `DevicePushToken` | Expo push token registered by the mobile app; used by `ExpoPushNotificationService`. |
| `CheatingReport` | User-submitted report against another tournament participant; reviewed by moderators. |

PostGIS is essential — `gps_track`, `polyline`, `start_point`, `end_point` are
all geographic types, and segment matching uses `ST_DWithin` (see
[SegmentMatcher#passes_through?](../app/services/segment_matcher.rb)).

## 3. Scoring: Golden Fever

Implemented in [TournamentScore.recalculate_all](../app/models/tournament_score.rb).

For each user in the tournament, for each rated segment:

```
segment_points = (fastest_same_gender_time / user_best_time) × 100
```

User's `user_best_time` is the **minimum** `elapsed_time_seconds` across all
their efforts for that segment. So re-running slower never lowers the score;
re-running faster improves it.

If a user completed **all** rated segments, they get a completion bonus
based on the order they finished the last one:

```
bonus = total_participants × max(10 − rank, 0)
```

Ranks 1–10 get a bonus (descending); rank 11+ gets 0.

Gender-separated leaderboards use the same `score`, just filtered to one
gender via `gender_rank`. If a user's gender is `nil`, they're excluded
from gender ranking (and the global ranking still includes them).

## 4. The hot path: run → score → notification

When a runner finishes recording on the mobile app and POSTs the activity:

1. **`POST /api/v1/activities`** ([ActivitiesController#create](../app/controllers/api/v1/activities_controller.rb))
   - Parses `gps_points` (JSONB array of `{lat, lng, ts, accuracy}`) and
     builds `gps_track` as a PostGIS LineString.
   - Creates the `Activity` row.
   - **Synchronously** runs `SegmentMatcher.new(activity).call` and
     `TournamentScore.recalculate_all` for every active tournament the user
     is in.
2. **`SegmentMatcher`** ([app/services/segment_matcher.rb](../app/services/segment_matcher.rb))
   - For every active tournament the user participates in:
     - Ignores activities outside the effective tournament window:
       `max(tournament.starts_at, participant.joined_at)` through
       `tournament.ends_at`.
     - Checks rated tournament segments in `order_number` order using
       adaptive start/end proximity, GPS accuracy filtering, minimum GPS
       density, minimum matched distance, minimum matched duration, and route
       coverage.
     - Verifies route following by projecting GPS points onto the segment
       polyline and requiring monotonic progress along the route.
     - On match, creates/updates a `SegmentEffort` and records a
       `TournamentSegmentUnlock` for the next required tournament segment.
       Unlocks, not historical efforts, are the source of truth for tournament
       order and progress.
3. **`TournamentEventPublisher.segment_unlocked!`** ([app/services/tournament_event_publisher.rb](../app/services/tournament_event_publisher.rb))
   - Creates a `TournamentEvent` (visible in the tournament feed to everyone).
   - For every tournament participant **except the actor**:
     - Creates a `Notification` localised to that participant's `user.locale`.
     - Calls `ExpoPushNotificationService.deliver(notification)`, which
       no-ops if the user has no active push tokens.
4. **`TournamentScore.recalculate_all`** recomputes per-user scores, gender
   ranks, and bonus ranks for the tournament.

Same logic also exists as [MatchSegmentsJob](../app/jobs/match_segments_job.rb)
for async re-runs (e.g. backfills) — Sidekiq + Redis.

For the full segment tracking algorithm, thresholds, diagrams, covered edge
cases, and test map, see [Segment Tracking](segment-tracking.md).

## 5. Auth

Three flows, all ending in a JWT bearer token issued by [JwtService](../app/services/jwt_service.rb):

- **Email + password** → `POST /api/v1/auth/{register,login}` ([AuthController](../app/controllers/api/v1/auth_controller.rb), uses `has_secure_password`).
- **Google** → mobile calls `expo-auth-session` to get an `id_token`, posts to `/api/v1/auth/google`. Backend verifies via [GoogleIdentityTokenVerifier](../app/services/google_identity_token_verifier.rb) (hits Google's tokeninfo endpoint, checks `aud` against the configured `GOOGLE_*_CLIENT_ID` env vars).
- **Apple** → similar, via [AppleIdentityTokenVerifier](../app/services/apple_identity_token_verifier.rb).

Each provider has an `OauthIdentity` row that ties the provider's `sub` to a
User. The mobile/web also exposes a non-API OmniAuth callback at
`/auth/:provider/callback` for the web frontend's traditional redirect flow.

The current user is resolved by [`BaseController#authenticate_user!`](../app/controllers/api/v1/base_controller.rb),
which also sets `I18n.locale` from `current_user.locale` for the whole
request via an `around_action` — that's how notifications and feed text
come out in the viewer's language.

## 6. Notifications

In-app:
- `TournamentEvent` rows render the tournament's social feed (see
  `tournaments#feed`). Title/body are localised on read using the viewer's
  locale and the event's `metadata`.
- `Notification` rows render the per-user notifications list (bell icon).
  Title/body are written at creation time in the recipient's locale.

Push:
- Mobile registers an Expo push token via
  `POST /api/v1/push_tokens` whenever the app starts (see
  [mobile/src/services/pushNotifications.js](../mobile/src/services/pushNotifications.js)).
- [ExpoPushNotificationService](../app/services/expo_push_notification_service.rb)
  posts to `https://exp.host/--/api/v2/push/send` for each active token; on a
  `DeviceNotRegistered` ticket it disables the token automatically.

## 7. Infrastructure

| Piece | What it's for | Where configured |
|-------|---------------|------------------|
| Postgres + PostGIS | Primary store; geographic operations on tracks/segments | [render.yaml](../render.yaml) (`splitrace-db`), `activerecord-postgis-adapter` gem |
| Redis | Sidekiq queue, Action Cable (future), caching | [render.yaml](../render.yaml) (`splitrace-redis`) |
| Sidekiq | Background jobs (`MatchSegmentsJob`) | [config/sidekiq.yml](../config/sidekiq.yml) |
| Expo push servers | Mobile push delivery | external; auth via per-device tokens |
| Google / Apple OAuth | Federated identity | env-driven; see [auth flows](#5-auth) |

## 8. Repo layout

```
splitrace/
├── app/                        # Rails app
│   ├── controllers/api/v1/     # JSON API for mobile + frontend
│   ├── controllers/admin/      # Server-rendered admin (Slim views)
│   ├── models/                 # Domain models
│   ├── services/               # OAuth verifiers, SegmentMatcher, push, JWT
│   └── jobs/                   # Sidekiq jobs
├── config/
│   ├── routes.rb               # All endpoints
│   ├── locales/                # Backend i18n (en, uk) — notification text lives here
│   └── application.rb          # I18n + global config
├── db/                         # Schema + migrations (PostGIS-aware)
├── frontend/                   # React web app (Vite, Tailwind)
│   └── src/                    # pages, components, locales (en/uk)
├── mobile/                     # Expo React Native app
│   └── src/
│       ├── screens/            # Top-level screens (Tournaments, RunTracker, …)
│       ├── components/         # Shared components (maps, share cards, modals)
│       ├── api/client.js       # JSON client; reads JWT from SecureStore
│       ├── contexts/AuthContext.jsx
│       ├── i18n/locales/       # en.json, uk.json
│       └── services/           # Push registration, etc.
├── .github/workflows/          # CI + Android APK build
├── docs/                       # ← you are here
└── render.yaml                 # Render deployment config
```

## 9. Things that surprise new developers

- **Tournament feed text is not stored as final strings.** `TournamentEvent.title/body`
  is the default-locale rendering; the controller re-renders per request locale
  from `event.metadata`. If you add a new event type, you must add an i18n
  key and update [`TournamentEventPublisher`](../app/services/tournament_event_publisher.rb)
  and the controller's `localized_event_text`.
- **Re-running a segment slower never lowers your score**, but it *can* hurt
  your "completed all segments" bonus rank, because that bonus uses the time
  of the last effort across all rated segments, not the time of first
  completion. (Known trade-off, kept intentionally simple.)
- **Actor receives no push for their own unlock**, but the `TournamentEvent`
  still shows in the actor's feed. The Notification row is also skipped.
- **GPS matching is not just start/end proximity anymore.** The matcher now
  requires route coverage, monotonic progress along the polyline, minimum GPS
  density, minimum matched movement, tournament-window checks, and
  `TournamentSegmentUnlock` records for tournament progress. Suspicious GPS is
  flagged and severe GPS signals reject matching, but the product still treats
  this as admin-review evidence rather than an automatic ban.
- **`mobile/android/` is gitignored** and regenerated by `expo prebuild` on
  every build. Don't expect changes there to survive. Customisation lives in
  `app.json`, `app.config.js`, expo plugins, or the build workflow's
  post-prebuild patch step.
