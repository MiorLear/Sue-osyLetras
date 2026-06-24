# @explorarte/shared

Framework-agnostic core shared by the ExplorArte **web** and **mobile** apps:

- **`src/types`** — domain models (Emotion, Post, CalEvent, Topic, ToolsContent,
  UserProfile, …). One source of truth for both apps and the backend DTOs.
- **`src/design/tokens.ts`** — colors, brand gradient, schools, event colors.
- **`src/api`** — the `ApiClient` interface plus two adapters:
  - `mock/` — serves the app's seed data in memory (default during development).
  - `http/` — fetch-based client for the real REST backend.
  - `createApiClient({ mode: 'mock' | 'http', baseUrl })` picks one.
- **`openapi.yaml`** — the REST contract a Python (FastAPI) or Java (Spring Boot)
  team implements. The HTTP adapter and the mock both conform to it.

## The point

Screens in either app call `client.emotions.list()`, `client.posts.create(...)`,
etc. — never `fetch`. Moving from local mock data to the live backend is a single
config change (`mode: 'http'`), with **zero screen code changes** in web or mobile.

```bash
npm install
npm run build      # emits dist/ (tsc)
npm run typecheck
```

> The web app aliases `@explorarte/shared` straight to `src/` for dev, so a build
> isn't required while iterating; `npm run build` is for publishing/consumers.

## Implementing the backend

1. Generate server stubs / models from `openapi.yaml`.
2. Seed the database from the exported `seed` module
   (`import { seed } from '@explorarte/shared'`).
3. Point the apps at it via `VITE_API_URL` (web) / the client factory (mobile).
