# SplitRace

## Frontend build

The React app lives in `frontend/` and builds into `public/app/`, which Rails serves as the web app.

`public/app/` is generated output and is intentionally ignored by git. Rebuild it when needed:

```sh
cd frontend
npm ci
npm run build
```

Render runs this during deploy via `render.yaml`. Docker builds it in the `frontend-build` stage and copies the generated `public/app` into the final Rails image.
