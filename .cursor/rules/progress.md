# HabitPup — context sync (`progress.md`)

Read this file at the start of a **new chat** before doing major work.

## Workspace location

- **Canonical repo path (from 2026-05-28)**: `H:\habiganize-source` (Lexar `H:` drive).
- **All future work** — edits, terminals, installs, and agent sessions — should use this folder, not `C:\Users\Admin\Downloads\habiganize-source`.
- Open in Cursor: **File → Open Folder** → `H:\habiganize-source`.

## Current Status

- **Monorepo (pnpm workspaces)**: `artifacts/*` apps + shared `lib/*`. Install requires **pnpm**; root `preinstall` expects POSIX `sh` (use **Git Bash** on Windows if install fails).
- **Web (`@workspace/habit-tracker`)**: Vite + React + Clerk + TanStack Query + Wouter + Tailwind v4. Root **`envDir`** loads `.env`. **Canonical local ports**: **`PORT=3001`** (API only), **`VITE_DEV_PORT=5173`** (Vite — must differ from **`PORT`**), **`API_URL=http://localhost:3001`** in root `.env` so the **`/api` proxy** never targets the wrong origin (fixes “couldn’t load habits” / port mismatch symptoms). **`vite.config.ts`** also **falls back proxy to port 3001** if **`PORT`** mistakenly equals the web dev port (e.g. stale shell **`export PORT=5173`**). **`strictPort: true`**: if **5173 is already in use**, Vite exits — stop the other process or set **`VITE_DEV_PORT`** to a free port. **`Instructions.md`** previously suggested **`export PORT=5173`** before Vite; that **must not be used** — it overrides **`PORT`** and broke proxy routing (**fixed in repo**).
- **API (`@workspace/api-server`)**: Express 5 + Clerk + Drizzle/pg; mounts **`/api`**, optional static SPA when `habit-tracker/dist/public` exists. **`cross-env`** on `dev` / `dev:local` scripts for Windows. Local **`dev`** / **`dev:local`** runs Node with **`--env-file=../../.env`** so **`PORT`**, **`DATABASE_URL`**, and Clerk keys from the repo root `.env` load without manual exports (**`start`** unchanged for deploy). Production bundle: **`artifacts/api-server/dist/index.mjs`**.
- **Database (`@workspace/db`)**: Drizzle + PostgreSQL. **`pnpm --filter @workspace/db run push`** loads repo-root `.env` (finds workspace via `pnpm-workspace.yaml`).
- **`pnpm run typecheck`**: Currently **fails** on `@workspace/api-server` (project-reference / implicit-`any` issues). **`pnpm --filter`** builds for habit-tracker and api-server **succeed**.
- **Mobile (`@workspace/habit-mobile`)**: Expo 54; EAS profiles in `eas.json`; store checklist in `STORE_SUBMISSION.md` (see **Mobile deploy** below).
- **Android Health Connect (WIP — pick up tomorrow)**: Wired **read** sync from **Health Connect** into existing health APIs (steps, active kcal, sleep, HR). **Stand-ups** stay manual (not modeled in HC). Dependencies: **`react-native-health-connect`**, **`expo-health-connect`**, **`expo-build-properties`** (`minSdkVersion` 26). **UI**: Android-only **“Sync from Health Connect”** on **`app/(tabs)/health.tsx`** (`testID="health-sync-phone"`). **`pnpm install`** on bare Windows may need **`--ignore-scripts`** if root **`preinstall`** fails (missing **`sh`**). **`android/` is gitignored** — EAS/local prebuild regenerates natives.

## Tech Stack

- **Package manager**: pnpm (`pnpm-workspace.yaml`, catalogs, `minimumReleaseAge`)
- **Web**: Vite 7, React 19 (catalog-pinned where required), Clerk (`@clerk/react`), `@tanstack/react-query`, `wouter`, Tailwind `@tailwindcss/vite`, Radix-heavy UI under `artifacts/habit-tracker/src/components/ui`
- **API**: Node, Express 5, `@clerk/express`, `drizzle-orm`, `pg`, `pino`, `esbuild` bundle (`build.mjs`)
- **DB**: Drizzle Kit push, Postgres (e.g. Neon)
- **API client**: Generated Orval hooks in `@workspace/api-client-react` (`custom-fetch`, relative **`/api/...`** paths in browser)
- **Mobile (Android health)**: `react-native-health-connect` + **`expo-health-connect`** config plugin (manifest intents); local plugin patches **MainActivity** (see Pending).

## Critical Files

| Area | Files |
|------|--------|
| Root env template | [.env.example](.env.example) (`PORT`, `VITE_DEV_PORT`, `API_URL` documented for local web + API) |
| Workspace layout | [pnpm-workspace.yaml](pnpm-workspace.yaml), [package.json](package.json) |
| Web Vite env + proxy | [artifacts/habit-tracker/vite.config.ts](artifacts/habit-tracker/vite.config.ts) (`loadEnv`, `VITE_DEV_PORT`, `API_URL` / `PORT` for proxy target) |
| Clerk (web SPA) | [artifacts/habit-tracker/src/App.tsx](artifacts/habit-tracker/src/App.tsx) (`VITE_CLERK_PUBLISHABLE_KEY`, `ClerkApiSessionTokenBridge`, optional `VITE_CLERK_PROXY_URL`) |
| API entry + static SPA | [artifacts/api-server/src/index.ts](artifacts/api-server/src/index.ts), [artifacts/api-server/src/app.ts](artifacts/api-server/src/app.ts) |
| Clerk proxy (production) | [artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts](artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts) (`/api/__clerk`) |
| Auth scope / DB wallet | [artifacts/api-server/src/middlewares/user-scope.ts](artifacts/api-server/src/middlewares/user-scope.ts) |
| Drizzle push + repo `.env` | [lib/db/drizzle.config.ts](lib/db/drizzle.config.ts) |
| DB schema | [lib/db/src/schema/](lib/db/src/schema/) |
| Fetch layer + generated API | [lib/api-client-react/src/custom-fetch.ts](lib/api-client-react/src/custom-fetch.ts), [lib/api-client-react/src/generated/api.ts](lib/api-client-react/src/generated/api.ts) |
| Mobile env example | [artifacts/habit-mobile/.env.example](artifacts/habit-mobile/.env.example) |
| Android Health Connect | [artifacts/habit-mobile/app.json](artifacts/habit-mobile/app.json) (plugins + `android.permission.health.READ_*`), [artifacts/habit-mobile/plugins/withHealthConnectMainActivity.js](artifacts/habit-mobile/plugins/withHealthConnectMainActivity.js), [artifacts/habit-mobile/lib/healthConnectPhoneSync.android.ts](artifacts/habit-mobile/lib/healthConnectPhoneSync.android.ts), [artifacts/habit-mobile/lib/healthConnectPhoneSync.ts](artifacts/habit-mobile/lib/healthConnectPhoneSync.ts) (iOS/Web stub), [artifacts/habit-mobile/app/(tabs)/health.tsx](artifacts/habit-mobile/app/(tabs)/health.tsx) |

## Local dev checklist (web + API)

1. Copy `.env.example` → `.env`; set **`DATABASE_URL`**, Clerk keys (**`CLERK_*`**, **`VITE_CLERK_PUBLISHABLE_KEY`** match).
2. Set **`PORT=3001`** (API listen), **`VITE_DEV_PORT=5173`** (Vite), **`API_URL=http://localhost:3001`** (proxy target — **recommended**, not optional for reliable local **`/api`**).
3. **Do not** `export PORT=5173` in the terminal before Vite; use **`VITE_DEV_PORT`** for the web port.
4. Terminal A: **`pnpm --filter @workspace/api-server run dev:local`**
5. Terminal B: **`pnpm --filter @workspace/habit-tracker run dev`** → open **`http://localhost:5173`** (or whatever Vite prints). **SPA in dev is Vite**, not **`http://localhost:3001`** unless the built **`habit-tracker/dist/public`** is present and served by the API.

## Recent progress (sessions)

- **2026-05-28** — **Moved monorepo to `H:\habiganize-source`** (full robocopy from Downloads). **From now on, treat `H:\habiganize-source` as the only workspace**; the old `C:\Users\Admin\Downloads\habiganize-source` copy can be removed after verification.
- **2026-05-15** — **Web (`habit-tracker`) landing + theme**: Refined signed-out **`WelcomePage`** in [`App.tsx`](artifacts/habit-tracker/src/App.tsx) (gradient background, soft glow, gradient header, theme-aware shadows). Global palette + brutal utilities in [`index.css`](artifacts/habit-tracker/src/index.css) now use **`hsl(var(--foreground))`** for offset shadows/borders (was hardcoded black). [`layout.tsx`](artifacts/habit-tracker/src/components/layout.tsx) sidebar/mobile nav shadows aligned. [`clerk-appearance.ts`](artifacts/habit-tracker/src/lib/clerk-appearance.ts) colors matched to the SPA. **Follow-up tweak (same theme pass)**: Restored **original golden accent** (`--accent: 48 92% 56%`, `--accent-foreground: near black`). Replaced purple-brown ink with **cocoa brown** text/borders and **warm cream** page background; **destructive** → terracotta (`8 72% 48%`); Clerk neutrals/danger hexes updated to match (`#3a2f26`, `#faf6f0`, `#c75038`, etc.).
- **2026-05-09**: Aligned root **`.env`** with **`PORT=3001`**, **`VITE_DEV_PORT=5173`**, **`API_URL=http://localhost:3001`**; preserved **`DATABASE_URL`** / Clerk secrets. Repo updates: **`vite.config.ts`** proxy guard when **`PORT`** == web port; **`api-server`** **`dev`** / **`dev:local`** load **`../../.env`** via **`--env-file`**; **`.env.example`** + **`Instructions.md`** clarified to avoid **`PORT`** / Vite collisions; **`strictPort`** / port-in-use called out above.
- **2026-05-10**: **Android Health Connect** — deps + **`app.json`** plugins/perms/sync UI/sync module (aggregate today UTC-aligned with backend **`todayStr`**). **Blocked for next agent**: **`withHealthConnectMainActivity.js`** did **not** leave **`HealthConnectPermissionDelegate.setPermissionDelegate(this)`** in generated **`MainActivity.kt`** after **`expo prebuild --clean`** — must fix plugin (Expo 54 **`withMainActivity`** / **`modResults`** shape or injection anchor after **`super.onCreate(...)`**) and re-verify prebuild; then device test **`requestPermission`** + sync. **`pnpm exec tsc -p artifacts/habit-mobile/tsconfig.json`** still reports existing errors in **`app/(tabs)/pups.tsx`** (not introduced by HC).
- **2026-05-13**: Implemented **no-cost friends + leaderboard backend** (keep everything in your own Postgres + Express; no extra social/leaderboard vendor). Added DB schema in **`lib/db/src/schema/social.ts`** (`user_social_profiles`, `friend_requests`, `friendships`), added API routes in **`artifacts/api-server/src/routes/social.ts`** (friend code profile + update, send/accept/decline/cancel requests, list friends, leaderboard by `coins` or completion counts with `scope=friends|global`), registered the router in **`artifacts/api-server/src/routes/index.ts`**, updated **`lib/api-spec/openapi.yaml`**, and regenerated client types via **`pnpm --filter @workspace/api-spec run codegen`**.
- **2026-06-01**: **Typecheck + build fixes**: Built lib `.d.ts` files (`tsc --build --force`), fixed `pups.tsx` (TanStack Query v5 `queryKey` type), `calendar.tsx` (ref cast), `spinner.tsx` (`forwardRef`). All shippable packages pass typecheck. **Social DB migrations**: Drizzle push created social tables. **API verification**: All social endpoints verified (proper auth protection). API server + web frontend both build successfully.

## Pending Tasks

1. **Android Health Connect — MainActivity**: Ensure custom plugin **`artifacts/habit-mobile/plugins/withHealthConnectMainActivity.js`** runs and injects **`HealthConnectPermissionDelegate.setPermissionDelegate(this)`** immediately after **`super.onCreate(...)`** in **`MainActivity.kt`**; run **`pnpm exec expo prebuild --platform android --clean`** and confirm; then EAS/dev build + on-device sync.
2. ~~**Typecheck hygiene**~~: ✅ **Done (2026-06-01)** — Built lib `.d.ts` files, fixed `pups.tsx`, `calendar.tsx`, `spinner.tsx` type errors. Root `pnpm run typecheck` passes for all shippable packages (api-server, habit-tracker, habit-mobile, scripts). Only `mockup-sandbox` fails (React types mismatch — non-critical).
3. ~~**Mobile typecheck**~~: ✅ **Passes** (2026-06-01).
4. **Production deploy (web)**: Vercel (web) + separate Node host (API) — set env vars, rewrites **`/api/*` → API origin**, Clerk allowed origins / `VITE_CLERK_PROXY_URL` as needed.
5. **Operational**: Prefer **`pnpm --filter @workspace/api-server run dev:local`** for API during web dev without full rebuild loops; root `.env` must stay out of commits.
6. ~~**Social DB migrations**~~: ✅ **Done (2026-06-01)** — Drizzle push created `user_social_profiles`, `friend_requests`, `friendships` tables.
7. ~~**API verification**~~: ✅ **Done (2026-06-01)** — All social endpoints return proper 401 (auth-protected). Endpoints verified: `/api/friends/*`, `/api/leaderboard`. Smoke-test with real Clerk user still needed.
8. ~~**UI wiring (web)**~~: ✅ **Done (2026-06-01)** — Created `friends.tsx` and `leaderboard.tsx` pages, added routes in `App.tsx`, added nav items in `layout.tsx`. Typecheck + build pass.
9. ~~**UI wiring (mobile)**~~: ✅ **Done (2026-06-01)** — Created `friends.tsx` and `leaderboard.tsx` tab screens, added to `_layout.tsx`, updated `usePrefetchOnFocus.ts`. Typecheck passes.
10. **End-to-end testing**: ✅ **Endpoint verification done (2026-06-01)** — All social endpoints return proper 401 without auth. Full authenticated flow still needs testing with real Clerk session.
11. **Backend security audit**: ✅ **Done (2026-06-01)** — Found and fixed 28 vulnerabilities (2 Critical, 4 High, 16 Medium, 6 Low). Key fixes: CORS lockdown, rate limiting, race condition transactions, helmet, Zod validation, global error handler. Typecheck + build pass.

## Mobile deploy — progress and remaining work

**In place**

- Expo app under `artifacts/habit-mobile` with **`eas.json`** (development / preview / **production** store profiles).
- **`STORE_SUBMISSION.md`**: Expanded **Google Play Console** checklist (service account, testing policy link, Data safety / Clerk, promotion path), EAS secrets incl. `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- **`app.config.ts` / `app.json`**: bundle IDs (`com.habitpup.app`), Expo 54.
- Clerk + API wiring: **`setAuthTokenGetter`** (via **`useLayoutEffect`** to avoid unauthenticated first fetch), **`setBaseUrl(API_URL)`** in `app/_layout.tsx`.
- **Privacy / support URLs for store listings:** Express serves **`/privacy`** (static HTML) and **`/support`** (`SUPPORT_CONTACT_EMAIL`); Vite dev proxies those paths to the API.
- **Health Connect**: Read permissions declared in **`app.json`**; Google Play **[health apps declaration](https://developer.android.com/health-and-fitness/guides/health-connect/plan/export-export)** / policy still required before wide Play release (timeline per Google).

**To do before store release**

1. **Expo / EAS**: `eas login`; from `artifacts/habit-mobile` run **`eas init`** / link project if not linked (`extra.eas.projectId` in `app.json`).
2. **Mobile env**: Local **`artifacts/habit-mobile/.env`** for dev; production uses EAS project secrets per `STORE_SUBMISSION.md`.
3. **`eas.json` → `submit.production`**: Replace placeholders (`REPLACE_WITH_APPLE_ID_EMAIL`, App Store Connect IDs); place **`secrets/play-service-account.json`** for Play upload.
4. **Apple / Google**: Developer accounts, Play Data safety / ratings, screenshots, listing copy; use live **`https://…/privacy`** and **`/support`** URLs.
5. **Build**: `eas build --profile production` for Android (and iOS if shipping); **`eas submit --platform android`** after builds.
6. **IAP / subscriptions** (if product requires): not assumed done — confirm with product plan.
