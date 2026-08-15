# ExplorArte / Sueños y Letras — Technical Audit

**Date:** 2026-08-02 · **Commit:** `61ac48c` · **Branch:** `main`
**Scope:** security, scalability, maintainability, correctness, and readiness for the Expo → PWA migration.

> Written in English to match the GitHub issue titles. Ask if you'd prefer a Spanish translation for the team — the rest of the repo docs are in Spanish.

---

## 1. What was audited, and how

Four passes over the repository at `61ac48c`:

1. **Architecture map** — every app, framework version, config file, and deployment path.
2. **Offline subsystem inventory** — all 10 modules in `src/lib/`, every storage API call site, and every native API that has no web equivalent.
3. **Security review** — secrets (including a scan of all 75 commits in history), auth/session, authorization, input validation, IDOR, file upload, transport config, and dependencies.
4. **Build and runtime verification** — dependency install, typecheck, production builds of both frontends, Maven dependency resolution, and read-only probes against the deployed API and static sites.

Everything asserted below cites a file and line that was actually read, or a command whose output is quoted. **Where the first pass was wrong, the correction is stated explicitly** — see §7.

### What could not be verified

The on-device QA sweep did not run: no Android device is connected (`adb devices` → empty), no emulator is installed (`emulator: command not found`), and Docker is not running, so the local API stack could not be started either. **The 13 screens have not been exercised in a running app.** Findings below are from code reading plus build/network verification. Connect a device and this can be completed — the defects it would most likely add are visual/responsive, which static analysis cannot see.

No exploitation was attempted against the deployed backend. Only unauthenticated, read-only endpoints were probed.

---

## 2. Verified by execution

These are not inferences. Each is a command output.

| Claim | Verification |
|---|---|
| `expo-sharing` and `expo-intent-launcher` were declared but not installed | `npm install` → "added 2 packages". `src/lib/open-file.ts` could not resolve its imports before this. |
| Spring Security is 6.3.3, exposing CVE-2025-22228 | `./mvnw dependency:tree` → `spring-security-crypto:jar:6.3.3`. Fixed only in 6.3.8 / 6.4.4. |
| The full API spec is public in production | `GET /v3/api-docs` → **200**; `GET /swagger-ui.html` → **302** (to the UI). |
| Render free-tier cold start is worse than documented | First `GET /actuator/health` **timed out after 90 s**. `render.yaml:11-12` documents "~30-60s". |
| Expo web export is 3.54× the Vite bundle | Fresh `npx expo export -p web` → **1,416,986 bytes**, one chunk. `npm run build` in `web/` → **400,130 bytes** JS + 11 KB CSS — for *more* screens. |
| `/posts` correctly requires auth | `GET /posts` (no token) → **401**. |
| The web app is type-clean and builds | `tsc -b && vite build` → 1624 modules, 0 errors, 2.12 s. |
| The mobile app is type-clean | `npx tsc --noEmit` → **0 errors inside `src/`**. All 76 errors come from `web/` being wrongly included (see MAINT-03). |
| 17 npm advisories at root, 3 high in `web/` | `npm audit` in both projects. |

---

## 3. Security

### P0 — act first

**SEC-01 · Login never checks account status.** `api/src/main/java/com/explorarte/api/auth/AuthController.java:56-64` compares the password and issues a token without reading `user.getStatus()`. The entire admin approve/reject workflow (`AdminUserController.java:35-41`, `UserStatus.REJECTED`) therefore has **no server-side effect** — a rejected user still receives a valid 24-hour token and can call every authenticated endpoint. The block exists only in the client, at `web/src/routes/Login.tsx:38-41`, so it is bypassed by calling `/auth/login` directly or by editing `localStorage`.

**SEC-02 · A working admin password is committed to a public repository.** `render.yaml:47-48` sets `SEED_USER_PASSWORD: explorarte-team-2026`, and `api/.../seed/DataSeeder.java:97-103` uses it to seed `admin@explorarte.org` with `UserRole.ADMIN`. The repo is public, so this is an admin credential for `explorarte-api.onrender.com` readable by anyone on the internet. The inline comment "no es un secreto real" is incorrect. **Rotate this in the Render dashboard before doing anything else, including filing a public issue about it.**

**SEC-03 · JWT signing key falls back to a public literal.** `api/src/main/resources/application.yml:47` and `docker-compose.yml:32` default to `dev-only-not-for-production-change-me`. Any deployment missing `JWT_SECRET` lets anyone forge `{"sub":"u-admin","role":"ADMIN"}`. Render sets it via `generateValue: true` (`render.yaml:41-42`), but the docker-compose and Cloud Run paths documented in `DESPLIEGUE.md` do not fail closed.

**SEC-04 · The dev OTP code is unbound and checked first.** `api/.../auth/VerificationCodeService.java:63-65` compares the incoming code to `AUTH_DEV_OTP_CODE` *before* any database lookup and *without* binding it to the identifier. `verify()` backs both `POST /auth/otp/verify` (which returns a full auth token, `AuthController.java:108-119`) and `POST /auth/reset-password` (`:157-171`). Knowing the fixed code means logging in as, or resetting the password of, **any account**, with no prior code request. `docker-compose.yml:45` defaults it to `123456`. Production leaves it unset — so this is latent, not currently live, but it is one env var away from total compromise.

**SEC-05 · No rate limiting anywhere, and OTP codes never lock out.** There is no rate-limit dependency in `api/pom.xml` and no filter or interceptor in `SecurityConfig.java`. `VerificationCodeService.java:59-70` has no attempt counter and does not invalidate a code on a failed guess. A 6-digit code with a 15-minute TTL is therefore brute-forceable to full account takeover, and `/auth/login` is equally unthrottled.

### P1

**SEC-06 · Auth fails open to a passwordless mock.** `usingMock = !baseUrl` at `web/src/lib/api.ts:9` and `src/lib/api.ts:43`. If `VITE_API_URL` / `EXPO_PUBLIC_API_URL` is absent at build time, the app silently uses the in-memory client, whose `login()` at `shared/src/api/mock/index.ts:64-69` **ignores the password entirely** and resolves the user by email alone — so `admin@explorarte.org` plus any string yields an admin session with the full CMS. There is no runtime guard or warning. This is a build-configuration-dependent auth bypass.

**SEC-07 · Request validation is entirely absent.** `spring-boot-starter-validation` is declared at `api/pom.xml:35-38`, but `@Valid`, `@NotNull`, `@Size`, `@Email`, and `@Pattern` appear **zero times** in the codebase. No request body on any endpoint is validated: no required fields, no length caps, no format checks. Oversize strings reach the database and surface as 500s.

**SEC-08 · File upload has no type or size allowlist.** `api/.../media/MediaUploadController.java:38-53` takes `file.getContentType()` straight from the client and forwards it to Supabase as the stored object's `Content-Type`. Any authenticated teacher can upload `.html`, `.svg`, or `.js` under the non-admin categories (`MediaCategory.java:11-12`) and receive a public, unauthenticated URL on the Supabase origin — stored XSS and arbitrary content hosting.

**SEC-09 · The JWT filter trusts the token and never loads the user.** `api/.../security/JwtAuthenticationFilter.java:40-45` reads the `role` claim directly. A demoted, rejected, or deleted user keeps full privileges for up to 24 hours, and there is no revocation path at all — no logout endpoint, no `jti`, no token version.

**SEC-10 · Credentials are written to application logs.** OTP codes at `AuthController.java:104`, password-reset codes at `:134` and `:138`, `EmailService.java:58` on any delivery failure, and the seed password at `DataSeeder.java:99` on every cold boot. On Render these logs are retained and readable from the dashboard.

### P2 / P3 (summary)

`SEC-11` Supabase bucket is public-read with unsigned URLs and `x-upsert: true`, and the API holds the RLS-bypassing **service_role** key (`SupabaseStorageClient.java:9-16,37-45`) · `SEC-12` **no Content-Security-Policy and no `Referrer-Policy`** on either static site, and the mobile export is additionally missing `X-Frame-Options`; the JWT lives in `localStorage` (`web/src/context/AuthContext.tsx:45`) so any XSS exfiltrates a 24-hour token · `SEC-13` registration has no password policy — a 1-character password is accepted, and a blank one silently becomes a random UUID (`AuthController.java:86-88`), leaving an unusable account; no email verification; no duplicate pre-check, so a collision surfaces as a 500 · `SEC-14` **confirmed live**: `/v3/api-docs` returns 200 and Swagger UI is reachable in production, `permitAll` in every environment (`SecurityConfig.java:55`) · `SEC-15` user-supplied attachment URLs are stored unvalidated (`PostController.java:59`) and then opened via `Linking.openURL` (`src/app/comunidad.tsx:291`) or rendered into `<video src>` (`web/src/routes/Comunidad.tsx:183`) · `SEC-16` **confirmed**: `spring-security-crypto:6.3.3` is affected by CVE-2025-22228, where `BCryptPasswordEncoder.matches()` returns true for any password over 72 bytes whose first 72 bytes match — and no maximum password length is enforced · `SEC-17` OTP and reset codes are stored in plaintext (`V3__verification_codes.sql:6-10`) · `SEC-18` phone lookup uses `findAll().stream().filter()` on unauthenticated endpoints, and `phone` has no unique constraint, so OTP login authenticates whichever duplicate row comes first · `SEC-19` CORS sets `allowedHeaders("*")` and splits the origin env var without trimming (`SecurityConfig.java:74-82`) · `SEC-20` no catch-all exception handler, so constraint violations return bare 500s, and `NoSuchElementException` echoes caller-supplied ids · `SEC-21` `scripts/setup-windows-firewall.ps1:12-13,33` opens ports 8000 and 5173 on the **Public** profile · `SEC-22` profile PII and the mutation queue are cached unencrypted in AsyncStorage · `SEC-23` `.claude/settings.local.json:12` ships a personal auto-approve list to all contributors.

### Clean — verified, not assumed

No SQL injection surface: zero `@Query`, zero `nativeQuery`, no `EntityManager` or `JdbcTemplate`, no string-concatenated SQL. Everything goes through Spring Data derived methods; Flyway migrations are static files. · No path traversal: the server's `sanitize()` (`MediaUploadController.java:56-58`) and the client's `fileNameFor()` (`src/lib/offlineStorage.ts:43-47`) both strip to `[a-zA-Z0-9._-]`, and stored paths are always `<enum-prefix>/<uuid>-<name>`. · No secrets in git history across all 75 commits. · No `console.*` calls anywhere in `src/`, `web/src/`, or `shared/src/` — so no tokens leak client-side. · Event ownership **is** enforced server-side (`EventController.java:74-81`). · Passwords use BCrypt correctly. · Mass assignment is not possible: `RegisterInput` and `UpdateProfileInput` omit `role` and `status`.

---

## 4. Scalability

**SCALE-01 (P1) · No pagination anywhere.** `/posts`, `/events`, and `/admin/users` return whole tables. Verified shape: `GET /emotions` returns a bare JSON array (11 items), not a page object. Emotions are a fixed set so that endpoint is fine, but the community feed grows without bound and there is no `limit`/`offset`/`cursor` on any endpoint.

**SCALE-02 (P1) · Full-table scan on unauthenticated endpoints.** `AuthController.java:113-116` and `:176-178` load every user row into memory to find one by phone, on `/auth/otp/*` and `/auth/forgot-password` — both public and unthrottled (see SEC-05).

**SCALE-03 (P1) · `syncAllContent()` is unthrottled.** It runs on every `online` flip (`src/app/_layout.tsx:22-27`) and walks ~12 endpoints plus every referenced media file. A tablet flapping between Wi-Fi and cellular hammers the API and burns a teacher's data plan.

**SCALE-04 (P2)** 200 MB multipart limit (`application.yml:23-25`) with no rate limiting → storage and cost exhaustion by any authenticated user · **SCALE-05 (P2)** no index review on the growth tables (`posts` by created_at, `comments` by post, `calendar_events` by owner) in `V1__init_schema.sql` · **SCALE-06 (P2)** **confirmed at >90 s**: Render free-tier cold start exceeds the 30-60 s documented at `render.yaml:11-12`; the PWA's offline shell will mask this for returning users but the first login still pays it · **SCALE-07 (P2)** neither frontend code-splits — the Vite build is one 400 KB chunk including the admin CMS that teachers never open; `React.lazy` on the 6 admin routes is nearly free · **SCALE-08 (P3)** no `ETag`/`Cache-Control` on API responses, so the offline layer cannot do cheap conditional GETs · **SCALE-09 (P3)** posts→likes/comments fetch strategy unreviewed for N+1.

---

## 5. Maintainability

**MAINT-01 (P1) · Zero tests.** No `*.test.*`, no `*.spec.*`, no `*Test.java` anywhere; `api/src/` has no `test` directory. `spring-boot-starter-test` and `spring-security-test` are declared but unused, and `api/Dockerfile:21` runs `mvn package -DskipTests`. A prior attempt exists on branch `claude/app-testing-setup-9577ad` and was reverted.

**MAINT-02 (P1) · Zero CI.** `.github/` contains only agent scratch files. Nothing gates typecheck, lint, or build on a PR. The only automated check is the Render build, which for the API skips tests. GitHub Actions is free and unlimited on a public repo, so this costs nothing to fix.

**MAINT-03 (P1) · The root `tsconfig.json` type-checks the wrong project.** It has no `include`, so `**/*.tsx` sweeps in `web/` and resolves web's `@/components/Icon` against the **mobile** `src/` via the `@/* → ./src/*` path alias. Result: **76 errors, all in `web/`, none in `src/`**, including 19 × `TS1149` casing collisions between `src/components/icon.tsx` and `web/src/components/Icon.tsx` on a case-insensitive filesystem. This is why the mobile app has no typecheck script — one cannot be added until the tsconfig is scoped. Both projects are individually type-clean.

**MAINT-04 (P1) · No ESLint config exists.** `package.json` declares `"lint": "expo lint"` but there is no `eslint.config.*` or `.eslintrc*` anywhere, and no `eslint` dependency. `web/` and `shared/` have no lint script at all.

**MAINT-05 (P1) · The 13 teacher screens are implemented twice** — once in React Native (`src/app/`) and once in Vite (`web/src/routes/`). Every fix must land in both. This is the duplication the PWA migration eliminates.

**MAINT-06 (P2)** dependency advisories: 17 at root (high: `brace-expansion` DoS, `postcss` XSS/path-traversal, `shell-quote` DoS — the postcss fix requires Expo 57, a breaking upgrade) and 3 high in `web/` (`react-router` **GHSA-qwww-vcr4-c8h2**, RSC-mode CSRF bypass, fixable in place) · **MAINT-07 (P2)** no service layer — 86 Java files with business logic in controllers and only 4 service classes · **MAINT-08 (P2)** the 12 cache keys are duplicated as string literals across `src/lib/media-sync.ts` and 8 screens, with a comment at `media-sync.ts:12` asking readers not to let them drift · **MAINT-09 (P2)** `shared/` is wired via `file:` deps plus a `postinstall` build hack instead of workspaces · **MAINT-10 (P2)** no Prettier and no `.editorconfig`; formatting is enforced only by a local `.vscode/settings.json` · **MAINT-11 (P2)** stale docs: `OFFLINE.md` describes a `DownloadableResource` type that never landed and points at Firebase Storage instead of Supabase, `render.yaml:105-106` claims Expo prerenders one HTML per route (false with `output: "single"`), `README.md:138` references a deleted `demo.mp4`, and `instrucciones-correcciones-explorarte.md` describes an obsolete `screens/*` layout · **MAINT-12 (P3)** 10 declared-but-unused Expo dependencies · **MAINT-13 (P3)** local Node is v24 while `render.yaml` pins `NODE_VERSION: 20` — builds and dev run on different majors · **MAINT-14 (P3)** no Checkstyle/Spotless/SpotBugs on the Java side · **MAINT-15 (P3)** two competing deployment stories: `render.yaml` (live) vs `DESPLIEGUE.md` + `web/firebase.json` (Firebase + Cloud Run, planned) · **MAINT-16 (P3)** `.claude/worktrees/` holds 4 full repo copies that inflate every repo-wide search.

---

## 6. Correctness defects

**BUG-01 (P1) · The calendar's date and time pickers do nothing on web.** `@react-native-community/datetimepicker` has no web implementation — its platform-agnostic `src/datetimepicker.js` returns `null` with a `console.warn`. `DateField` and `TimeField` (`src/app/calendar.tsx:673-704`) render a trigger button that opens nothing. **Event create and edit are broken today in the deployed `explorarte-mobile` web export.**

**BUG-02 (P1) · `Alert.alert` is a silent no-op on react-native-web.** `react-native-web/dist/exports/Alert/index.js` is literally `class Alert { static alert() {} }`. Nothing throws and nothing logs. All 25 call sites across 7 files — every offline confirmation and failure message, including "Guardado sin conexión" and "No disponible sin conexión" — produce **complete silence** on web.

**BUG-03 (P1) · One bad mutation blocks the outbox forever.** `src/lib/mutation-queue.ts:181-201` is `while (queue.length) { try { dispatch(queue[0]) } catch { break } }`. A permanently-invalid mutation (a comment on a deleted post, a 403 from a revoked account) blocks the entire queue indefinitely while the banner reports "N cambios se sincronizarán al reconectar". There is no attempt counter, no cap, no dead-letter, and a 401 is indistinguishable from a network blip — so it retries into a redirect loop.

**BUG-04 (P1) · Array-reference race during flush.** `enqueueEventRemove` at `mutation-queue.ts:109-115` does `queue = queue.filter(...)`, **replacing the array reference** while `flushQueue` is iterating it. The in-flight loop then mutates an orphaned array and the just-dispatched mutation is re-dispatched on the next pass.

**BUG-05 (P2) · Media freshness is keyed on file size.** `media-sync.ts:18` and `downloadable-media-item.tsx:37` both use `String(item.sizeBytes)` as the cache version. A corrected PDF with the same byte length is **never** re-downloaded. `MediaItem` (`shared/src/types/index.ts:11-19`) has no `updatedAt` or `etag`; `OFFLINE.md:113-123` proposed adding one and it never landed.

**BUG-06 (P2)** posts created offline cannot be liked or commented on until they sync — `enqueuePostLike/Comment` require a real numeric id, so screens special-case it (`comunidad.tsx:69,89,117`) · **BUG-07 (P2)** no periodic retry: the only flush trigger is the `online` flag flipping, so a device that boots already-online with a pending queue never retries · **BUG-08 (P2)** **confirmed**: `expo-sharing` and `expo-intent-launcher` were in `package.json` but absent from `node_modules`, so `src/lib/open-file.ts` could not resolve · **BUG-09 (P2)** `useOfflineAsync` never expires the cache and cannot distinguish "offline with nothing cached" from a real failure, so screens can't choose the right message · **BUG-10 (P3)** `fileNameFor` calls `new URL(url)`, which throws on a relative URL; `media-sync.ts:20` swallows it, so a malformed URL makes a resource permanently un-cacheable with no diagnostic · **BUG-11 (P3)** re-uploaded media leaks its old cache entry forever (new id, new URL, no cleanup) · **BUG-12 (P3)** `totalDownloadedBytes()` sums the server-reported `sizeBytes` rather than bytes actually stored · **BUG-13 (P3)** `PUT /me` writes `email` with no format check, no uniqueness pre-check, and no verification, so a user can silently move their login identity and a collision returns a 500 (`ProfileController.java:30-43`) · **BUG-14 (P3)** there are no post or comment delete endpoints, so users cannot remove their own content and there is no moderation path · **BUG-15 (P3)** `JwtAuthenticationFilter.java:43` throws an NPE (→ 500) on a signature-valid token that lacks the `role` claim.

---

## 7. Corrections to earlier findings

Stated plainly, because an audit that hides its own errors is not trustworthy.

| Initially reported | Actually |
|---|---|
| `dist/` is committed to git | **Not committed** — it is in `.gitignore:34` and `git ls-files dist` returns nothing. The local folder was a stale 2026-06-29 artifact containing a dead 14.1 MB `demo.mp4`; the fresh export performed during this audit replaced it. |
| `Alert.alert` is missing on react-native-web | **Present but a no-op stub.** Worse, not better: nothing throws, so the failure is invisible. It is 7 files / 25 call sites, not "8+ files". |
| No HSTS and no `X-Content-Type-Options` on the deployed sites | **Both are present** — Cloudflare/Render add `strict-transport-security: max-age=315360000; includeSubdomains; preload` and `x-content-type-options: nosniff`. The real gaps are **CSP** and **`Referrer-Policy`** on both, plus `X-Frame-Options` on the mobile export only. SEC-12 is narrowed accordingly. |
| JS dependencies are current with nothing obviously vulnerable | **17 advisories at root, 3 high in `web/`.** See MAINT-06. |
| Render cold start is 30-60 s | **Exceeded 90 s** in this test. |
| CVE-2025-22228 was inferred from the parent POM | **Confirmed** by `./mvnw dependency:tree`: `spring-security-crypto:6.3.3`. |

---

## 8. PWA migration readiness

The full plan and its 42 tickets are in `docs/audit-backlog.json` (`area: pwa`), sequenced across 6 phases. Phase 0 adds no new work — it gates on the guardrail tickets above. The decisions that shape everything else:

**Consolidate into `web/` (Vite); freeze the React Native app rather than deleting it; ship Android as a Capacitor wrapper around the same PWA.** The measured case: the Expo export is **1,416,986 bytes in one unsplittable chunk** versus **400,130 bytes** for a Vite build that covers *more* screens (20 vs 13), and PWA-ifying the Expo export would not even reach one codebase, because the RN app has no admin CMS — `web/` would have to stay alive regardless.

**Offline fidelity does not favour either option.** Both ship a web page in a browser sandbox with the same Cache Storage / IndexedDB / Background Sync toolkit. `expo-file-system`'s web implementation is a `console.warn` stub, so either path must build the identical media layer. 7 of the 10 modules in `src/lib/` port at near-zero risk; only `offlineStorage.ts` and `open-file.ts` need real rewrites, and they need rewriting under either option.

**Three constraints that drive design, not just implementation:**

- **iOS Safari has no Background Sync and never will.** The outbox guarantee must be a foreground replay ladder — app start, `online`, `visibilitychange`, exponential backoff — with Background Sync as a bonus where available.
- **iOS evicts all origin storage after 7 days without interaction, for non-installed sites only.** Home-Screen-installed PWAs are exempt. "Install the app" is therefore a real onboarding requirement, and Safari ignores `navigator.storage.persist()` entirely.
- **API GET responses must not be cached by the service worker.** Every one is Bearer-scoped and Spring does not send `Vary: Authorization`, so a URL-keyed Workbox route would serve one teacher's profile to another on a shared classroom tablet. Cache-first reads stay in the page; only media (public, unauthenticated) is SW-routed — with `RangeRequestsPlugin`, without which cached `<video>` playback fails in Safari.

**One deployment landmine:** `web/firebase.json:18-21` applies `max-age=31536000,immutable` to `**/*.@(js|css|…)`. That glob would catch `/sw.js` and permanently strand users on an old service worker with no recovery path. An explicit `no-cache` rule for `/sw.js`, `/manifest.webmanifest`, and `/index.html` must precede it.

---

## 9. Suggested order of work

1. **Rotate `explorarte-team-2026`** in the Render dashboard. Nothing else matters until a public admin credential is dead.
2. **SEC-01, SEC-03, SEC-04, SEC-05** — the server-side auth holes. SEC-01 is a few lines and makes an existing feature real.
3. **MAINT-02, MAINT-03, MAINT-04** — CI, a scoped tsconfig, and ESLint. You are about to move ~700 lines of offline logic between codebases with zero tests; this is the safety net, and it is cheap.
4. **BUG-01, BUG-02** — both are user-facing breakage in the currently deployed web export.
5. **PWA Phase 0 → 5** as sequenced in the backlog, with the offline parity gate before anything is retired.

Full ticket detail, acceptance criteria, and dependencies: `docs/audit-backlog.json`.
