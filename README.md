# SplitRace

[![CI](https://github.com/oleg-voloshyn/SplitRace/actions/workflows/ci.yml/badge.svg)](https://github.com/oleg-voloshyn/SplitRace/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/oleg-voloshyn/SplitRace/branch/main/graph/badge.svg)](https://codecov.io/gh/oleg-voloshyn/SplitRace)

SplitRace is a Rails API/admin application with a React web app and an Expo mobile app for running tournaments, route segments, activity tracking, notifications, and admin moderation.

## Project Structure

- `app/`, `config/`, `db/`, `test/` - Rails backend, API, admin panel, database schema, and integration tests.
- `frontend/` - React/Vite web app served during development by Vite and built into `public/app/` for Rails production serving.
- `mobile/` - Expo React Native app with Jest tests.
- `.github/workflows/ci.yml` - CI pipeline for linting, tests, coverage, build, and Playwright e2e.

## Prerequisites

- Ruby `4.0.4`
- Bundler
- PostgreSQL with PostGIS enabled
- Node.js `22+` recommended for frontend/mobile tooling
- npm
- Expo CLI for mobile development, usually via `npx expo`
- Playwright browsers for frontend e2e tests

The app uses PostgreSQL databases named:

- `splitrace_development`
- `splitrace_test`

Database connection can be configured with:

```sh
export DB_HOST=localhost
export DB_USERNAME=postgres
export DB_PASSWORD=postgres
```

Adjust these values to match your local PostgreSQL user.

## Backend Setup

Install Ruby dependencies:

```sh
bundle install
```

Prepare the development and test databases:

```sh
bin/rails db:prepare
RAILS_ENV=test bin/rails db:test:prepare
```

You can also run the Rails setup script:

```sh
bin/setup
```

## Frontend Setup

Install frontend dependencies:

```sh
cd frontend
npm ci
```

The frontend dev server expects the Rails backend to be available locally.

## Mobile Setup

Install mobile dependencies:

```sh
cd mobile
npm ci
```

The mobile API base URL is currently defined in `mobile/src/api/client.js`. Update `WEB_URL` there if you want the mobile app to talk to a local backend instead of the deployed backend.

Mobile Google sign-in uses Expo AuthSession. Set the Google OAuth client IDs before starting or building the app:

```sh
export EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=your-expo-client-id
export EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id
export EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id
export EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id
```

The Rails API verifies Google ID tokens against these backend env vars:

```sh
export GOOGLE_CLIENT_ID=your-web-client-id
export GOOGLE_WEB_CLIENT_ID=your-web-client-id
export GOOGLE_IOS_CLIENT_ID=your-ios-client-id
export GOOGLE_ANDROID_CLIENT_ID=your-android-client-id
export GOOGLE_EXPO_CLIENT_ID=your-expo-client-id
```

## Running Locally

Start the Rails backend:

```sh
bin/rails server
```

Rails runs on:

```text
http://localhost:3000
```

Start the React web app in another terminal:

```sh
cd frontend
npm run dev
```

Vite usually runs on:

```text
http://localhost:5173
```

Useful local URLs:

- Web app: `http://localhost:5173`
- Rails health check: `http://localhost:3000/up`
- Admin panel: `http://localhost:3000/admin`
- API root namespace: `http://localhost:3000/api/v1`

Start the Expo mobile app:

```sh
cd mobile
npx expo start
```

Android shortcut:

```sh
cd mobile
npx expo start --android
```

## Building The Web App

The React app builds into `public/app/`, which Rails serves as the production web app.

```sh
cd frontend
npm run build
```

`public/app/` is generated output and is intentionally ignored by git. Render runs the frontend build during deploy via `render.yaml`. Docker builds it in the `frontend-build` stage and copies the generated `public/app` into the final Rails image.

## Backend Checks

Run RuboCop:

```sh
RUBOCOP_CACHE_ROOT=tmp/rubocop_cache bundle exec rubocop
```

Run Rails tests:

```sh
bin/rails test
```

Run Rails tests with coverage:

```sh
COVERAGE=1 bin/rails test
```

Backend coverage output is written to:

```text
coverage/index.html
coverage/lcov.info
```

## Frontend Checks

Run ESLint:

```sh
cd frontend
npm run lint
```

Check Prettier formatting:

```sh
cd frontend
npx prettier --check .
```

Build the frontend:

```sh
cd frontend
npm run build
```

Install Playwright Chromium:

```sh
cd frontend
npx playwright install chromium
```

Run Playwright smoke/e2e tests:

```sh
cd frontend
npx playwright test
```

Playwright starts a Rails test server automatically unless `E2E_BASE_URL` is set.

## Mobile Checks

Run ESLint:

```sh
cd mobile
npm run lint
```

Check Prettier formatting:

```sh
cd mobile
npx prettier --check .
```

Run Jest tests:

```sh
cd mobile
npm test -- --runInBand
```

Run Jest tests with coverage:

```sh
cd mobile
npm run test:coverage -- --runInBand
```

Mobile coverage output is written to:

```text
mobile/coverage/lcov-report/index.html
mobile/coverage/lcov.info
mobile/coverage/coverage-summary.json
```

## Full Local Verification

These commands mirror the important CI gates:

```sh
RUBOCOP_CACHE_ROOT=tmp/rubocop_cache bundle exec rubocop
bin/rails test
COVERAGE=1 bin/rails test

cd frontend
npx prettier --check .
npm run lint
npm run build
npx playwright test

cd ../mobile
npx prettier --check .
npm run lint
npm test -- --runInBand
npm run test:coverage -- --runInBand
```

## CI And Coverage

GitHub Actions runs on pushes to `main`/`master` and on pull requests.

CI currently checks:

- Backend RuboCop
- Backend Rails tests with SimpleCov coverage
- Frontend Prettier
- Frontend ESLint
- Frontend production build
- Frontend Playwright smoke/e2e tests
- Mobile Prettier
- Mobile ESLint
- Mobile Jest tests with coverage

Backend and mobile coverage reports are uploaded from each CI run as artifacts. The Codecov badge starts showing real coverage after the repository is connected to Codecov or `CODECOV_TOKEN` is added for private repositories.
