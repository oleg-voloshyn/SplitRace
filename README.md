# SplitRace

[![CI](https://github.com/oleg-voloshyn/SplitRace/actions/workflows/ci.yml/badge.svg)](https://github.com/oleg-voloshyn/SplitRace/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/oleg-voloshyn/SplitRace/branch/main/graph/badge.svg)](https://codecov.io/gh/oleg-voloshyn/SplitRace)

## Quality gates

CI runs RuboCop, ESLint, Prettier, backend tests, frontend Playwright smoke/e2e, and mobile Jest tests. Backend and mobile coverage reports are uploaded from each CI run as artifacts; the Codecov badge starts showing real coverage after the repository is connected to Codecov or `CODECOV_TOKEN` is added for private repositories.

## Frontend build

The React app lives in `frontend/` and builds into `public/app/`, which Rails serves as the web app.

`public/app/` is generated output and is intentionally ignored by git. Rebuild it when needed:

```sh
cd frontend
npm ci
npm run build
```

Render runs this during deploy via `render.yaml`. Docker builds it in the `frontend-build` stage and copies the generated `public/app` into the final Rails image.
