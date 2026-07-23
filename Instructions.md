# HabitPup — Full Independence Guide

This document covers everything needed to develop, deploy, and publish HabitPup
entirely outside of Replit. After following these instructions you will not need
Replit for any part of your workflow.

---

## What you are working with

HabitPup is a **pnpm monorepo** with three shippable products:

| Product | Location | Stack |
|---|---|---|
| API + Web App | `artifacts/api-server` + `artifacts/habit-tracker` | Express + PostgreSQL + React + Vite |
| iOS App | `artifacts/habit-mobile` | React Native + Expo SDK 54 |
| Android App | `artifacts/habit-mobile` | React Native + Expo SDK 54 |

Shared libraries live in `lib/`. The API server serves the web app's static files
in production, so they are deployed together.

---

## Part 0 — Set up your local machine

### 0.0 — One-command setup (recommended)

After cloning the repo and installing Node.js + pnpm (steps 0.1–0.3 below), you can run a
single script that handles everything else automatically:

```bash
bash scripts/setup.sh
```

The script will:

1. Copy `.env.example` → `.env` (root) if it does not already exist
2. Copy `artifacts/habit-mobile/.env.example` → `artifacts/habit-mobile/.env` if it does not already exist
3. Run `pnpm install` to install all workspace dependencies
4. Prompt you to enter your `DATABASE_URL` and push the database schema

After the script finishes, open both `.env` files and replace any remaining placeholder
values (Clerk keys, session secret, etc.) before starting the servers.

If you prefer to set things up manually, follow steps 0.4–0.6 below instead.

---

### 0.1 — Install Node.js

Install Node.js v20 or later. Use [nvm](https://github.com/nvm-sh/nvm) (Mac/Linux)
or [nvm-windows](https://github.com/coreybutler/nvm-windows) to manage versions.

```bash
nvm install 20
nvm use 20
node --version   # should print v20.x.x or higher
```

### 0.2 — Install pnpm

```bash
npm install -g pnpm@latest
pnpm --version   # should print 9.x or higher
```

### 0.3 — Clone the repository from GitHub

First push your code to GitHub (see Part 2), then clone it:

```bash
git clone https://github.com/YOUR_USERNAME/habitpup.git
cd habitpup
```

### 0.4 — Install all dependencies

```bash
pnpm install
```

This installs every package for every workspace in one command.

### 0.5 — Set up local environment variables

Create a `.env` file at the root of the project (it is already gitignored):

```bash
cp .env.example .env
```

Edit `.env` with your real values:

```env
# PostgreSQL — get a free database from https://neon.tech
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/habitpup?sslmode=require

# Clerk — from https://clerk.com → your app → API Keys
# Use the TEST/DEVELOPMENT keys for local work, LIVE keys for production
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx

# Ports for local dev (you can change these)
PORT=3001
```

> For the mobile app, create a separate `.env` file inside `artifacts/habit-mobile/`:
>
> ```env
> EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx
> EXPO_PUBLIC_API_URL=http://localhost:3001
> EXPO_PUBLIC_WEB_ORIGIN=http://localhost:3001
> ```

### 0.6 — Run database migrations

```bash
DATABASE_URL="your-connection-string" pnpm --filter @workspace/db run push
```

This applies the Drizzle schema to your PostgreSQL database. Run it once on a fresh
database, and again whenever the schema changes.

---

## Part 1 — Run the project locally (no Replit)

You need three terminal tabs running simultaneously.

### Terminal 1 — API server

```bash
# From the project root
export DATABASE_URL="your-neon-connection-string"
export CLERK_PUBLISHABLE_KEY="pk_test_xxx"
export CLERK_SECRET_KEY="sk_test_xxx"
export NODE_ENV=development
export PORT=3001

pnpm --filter @workspace/api-server run dev
```

The API is now running at `http://localhost:3001/api/`.
Check: `curl http://localhost:3001/api/healthz` → should return 200.

### Terminal 2 — Web frontend

```bash
# From the project root (use your root `.env` for DATABASE_URL / Clerk keys / ports.)
# Put `VITE_DEV_PORT=5173` there for the web app; keep `PORT=3001` for the API —
# never `export PORT=5173` in this terminal: `PORT` is what Vite reads for `/api`
# proxy routing unless `API_URL` is set.

pnpm --filter @workspace/habit-tracker run dev
```

The web app is now running at `http://localhost:5173` (or the next free port). If startup fails with **“Port 5173 is already in use”**, stop the other process using that port, or set **`VITE_DEV_PORT`** in root `.env` to another port (for example **`5174`**) and open that URL instead.

It proxies `/api/*` calls through the Vite dev server to the API (`API_URL` in `.env`, or `http://127.0.0.1:${PORT}` with `PORT` defaulting to `3001`).

### Terminal 3 — Mobile app (Expo)

```bash
cd artifacts/habit-mobile

# Make sure your .env file is in place (see Part 0, step 0.5)
pnpm run dev:local
```

Expo will print a QR code. Scan it with the **Expo Go** app on your phone, or press
`i` for iOS simulator / `a` for Android emulator.

---

## Part 2 — Push the code to GitHub

1. Create a new **private** repository on GitHub at [github.com/new](https://github.com/new).
   Name it `habitpup`.
2. From the project root:

```bash
git remote add origin https://github.com/YOUR_USERNAME/habitpup.git
git push -u origin main
```

> **Security:** The `artifacts/habit-mobile/secrets/` directory is gitignored.
> Never commit `.p8` files or service account JSON keys to any repository.

All future changes: `git add . && git commit -m "your message" && git push`.

---

## Part 3 — Deploy for FREE (recommended path)

**Goal: $0/month.** Do **not** use Railway for free long-term (trial only, then pay).
Skip Vercel/Netlify for now — they only host the frontend and still need a free API host.

| Piece | Free service | Notes |
|---|---|---|
| Database | [Neon](https://neon.tech) | Free forever Postgres |
| Auth | [Clerk](https://clerk.com) | Free tier |
| API + Web app | [Render](https://render.com) Free Web Service | One URL for both; sleeps after ~15 min idle |

**Tradeoff:** After ~15 minutes with no traffic, Render sleeps. The next visit can take
~30–60 seconds to wake up. Fine for personal / demo use; not ideal for a busy product.

---

### FREE path — Neon + Render (do this)

#### Step 0 — Push code to GitHub

You need a GitHub repo (private is fine). From the project root:

```bash
git init
git add .
git commit -m "chore: initial commit"
# Create an empty repo on GitHub named habiganize (or habitpup), then:
git remote add origin https://github.com/YOUR_USERNAME/habiganize.git
git branch -M main
git push -u origin main
```

#### Step 1 — Free Postgres (Neon)

1. Go to [neon.tech](https://neon.tech) → sign up → create project `habiganize`.
2. Copy the connection string (looks like
   `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`).
3. From your machine, push the schema once:

```bash
DATABASE_URL="paste-your-neon-url-here" pnpm --filter @workspace/db run push
```

#### Step 2 — Free Clerk keys (production)

1. Go to [clerk.com](https://clerk.com) → your app → **API Keys**.
2. Switch to **Production** and copy:
   - Publishable key (`pk_live_…`)
   - Secret key (`sk_live_…`)
3. After Render gives you a URL, come back and add that domain under Clerk
   **Domains / Allowed origins**.

#### Step 3 — Deploy on Render (API + website together)

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**.
2. Connect the GitHub repo you pushed in Step 0.
3. Settings:

| Setting | Value |
|---|---|
| Root Directory | `artifacts/api-server` |
| Runtime | Node |
| Instance type | **Free** |
| Build Command | `cd ../.. && corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/habit-tracker run build && pnpm --filter @workspace/api-server run build` |
| Start Command | `node --enable-source-maps ./dist/index.mjs` |

4. Environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string from Step 1 |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_…` |
| `CLERK_SECRET_KEY` | `sk_live_…` |
| `SUPPORT_CONTACT_EMAIL` | Your email for `/support` |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |

5. Deploy. You get a URL like `https://habiganize.onrender.com`.
6. Wait for the first build (~5–10 min). Then open:
   - `https://habiganize.onrender.com/api/healthz` → should be OK
   - `https://habiganize.onrender.com/` → the web app

#### Step 4 — Finish Clerk

1. Clerk dashboard → add `https://YOUR-APP.onrender.com` to allowed domains/origins.
2. Sign up → create a habit → complete it once to confirm end-to-end.

#### Step 5 — Mobile (later)

When you build the Expo app, set EAS secrets to your **Render** URL (not Railway):

```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value https://YOUR-APP.onrender.com
eas secret:create --scope project --name EXPO_PUBLIC_WEB_ORIGIN --value https://YOUR-APP.onrender.com
```

---

### Paid options (skip unless you want always-on without sleep)

- **Railway** (~$5/mo Hobby after trial) — always-on API.
- Netlify/Vercel alone cannot run this Express API for free.

---

### Configure Clerk for your production domain

1. Go to your Clerk dashboard → **Domains**.
2. Add your production domain (e.g. `habiganize.onrender.com`).
3. Add it to **Allowed origins**.
4. Use **live** keys (not test/dev keys) in all production environment variables.

---

### What is preserved after deployment

Everything — no features, design, animations, or admin functions are lost:

- All React components, pages, and routing
- All Tailwind CSS v4 styles and neo-brutalist design system
- All Framer Motion animations
- All Radix UI components
- Clerk authentication (sign-up, sign-in, sessions)
- All API routes: habits, completions, rewards, dashboard, shop, collection
- PostgreSQL data persistence (Drizzle ORM)
- Per-user wallet scoping (admin function)
- Browser extension (update the API URL it calls to your Render URL)

---

## Part 4 — Build and Submit the Mobile App

Builds happen in Expo's cloud via **EAS (Expo Application Services)**.
You do not need Xcode or Android Studio installed.

### Prerequisites

| Account | Cost | Link |
|---|---|---|
| Expo | Free | [expo.dev](https://expo.dev) |
| Apple Developer Program | US$99/year | [developer.apple.com/programs](https://developer.apple.com/programs/) |
| Google Play Console | One-time US$25 | [play.google.com/console](https://play.google.com/console) |

Your API server from Part 3 (Render free URL) must be live before building.

---

### Step 1: Install EAS CLI and log in

```bash
npm install -g eas-cli
eas login
```

### Step 2: Link the app to an EAS project

```bash
cd artifacts/habit-mobile
eas init   # run once — writes projectId into app.json
```

### Step 3: Fill in the placeholders in eas.json

Open `artifacts/habit-mobile/eas.json` and replace every `REPLACE_WITH_*`:

| Placeholder | What to put | Where to find it |
|---|---|---|
| `REPLACE_WITH_APPLE_ID_EMAIL` | Your Apple ID email | The email you use to log in to App Store Connect |
| `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` | Numeric app ID | App Store Connect → your app → the number in the URL |
| `REPLACE_WITH_APPLE_TEAM_ID` | Team ID string | [developer.apple.com/account](https://developer.apple.com/account) → Membership |
| `REPLACE_WITH_ASC_API_KEY_ID` | Key ID | App Store Connect → Users and Access → Keys → App Store Connect API |
| `REPLACE_WITH_ASC_API_KEY_ISSUER_ID` | Issuer ID | Same page as Key ID |

### Step 4: Place the secret key files

These are gitignored — place them manually:

```
artifacts/habit-mobile/secrets/AuthKey.p8                 ← Download from App Store Connect (one-time)
artifacts/habit-mobile/secrets/play-service-account.json  ← Download from Google Cloud Console
```

**Google Play setup:**
1. In Google Cloud Console, create a service account → download its JSON key.
2. In Play Console → Setup → API access, link the service account.
3. Grant it "Release manager" permissions.

### Step 5: Register EAS secrets (production build config)

```bash
cd artifacts/habit-mobile

eas secret:create --scope project --name EXPO_PUBLIC_API_URL \
  --value https://YOUR-APP.onrender.com

eas secret:create --scope project --name EXPO_PUBLIC_WEB_ORIGIN \
  --value https://YOUR-APP.onrender.com

eas secret:create --scope project --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY \
  --value pk_live_your_clerk_publishable_key_here
```

Verify the API is live:

```bash
curl https://YOUR-APP.onrender.com/api/healthz
# Expected: HTTP 200
```

### Step 6: Register the app in both stores

**Apple App Store Connect:**
1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com).
2. My Apps → **+** → New App.
3. Bundle ID: `com.habitpup.app` · SKU: `habitpup-ios-001` · Name: **HabitPup**.

**Google Play Console:**
1. Go to [play.google.com/console](https://play.google.com/console).
2. Create app → Package name: `com.habitpup.app` (this cannot be changed later) · Name: **HabitPup**.

### Step 7: Bump the version and build

In `artifacts/habit-mobile/app.json`, update `expo.version` (e.g. `"1.0.0"`), then:

```bash
cd artifacts/habit-mobile

# Run sanity checks first
pnpm dlx expo-doctor@latest
pnpm exec expo prebuild --no-install --clean

# Build for both stores (~10–20 min each, runs in Expo cloud)
eas build --profile production --platform ios
eas build --profile production --platform android
```

Monitor builds at [expo.dev](https://expo.dev).

### Step 8: Submit to the stores

```bash
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

- **iOS** → binary goes to TestFlight. Test it, then promote to App Store review in App Store Connect.
- **Android** → binary goes to Play Console internal track as a draft. Promote through internal → closed → open → production testing.

### Step 9: Upload store listing assets

These must be uploaded manually in App Store Connect and Play Console:

| Asset | Required by | Spec |
|---|---|---|
| App icon 1024×1024 | Both | Already in `assets/images/icon.png` |
| iPhone 6.9" screenshots | Apple | 1290×2796 px — required |
| iPhone 6.5" screenshots | Apple | 1242×2688 px — required |
| Feature graphic | Google | 1024×500 px PNG/JPG |
| Phone screenshots | Google | 2–8 images, 16:9 or 9:16 ratio |
| Short description | Google | ≤80 chars, e.g. "Build habits. Grow your virtual pet." |
| Full description | Both | ≤4000 chars |
| Privacy policy URL | Both | Host at `https://yourdomain.com/privacy` (Task #35) |
| Support URL | Both | A contact page or email link |
| Keywords | Apple | ≤100 chars, e.g. "habits,tracker,pet,goals,routine" |
| Category | Both | Primary: Health & Fitness · Secondary: Lifestyle |
| Age rating | Both | Fill each store's questionnaire — expect 4+ / Everyone |
| Data safety form | Google | Declare: account info (email), habit data, pet state — encrypted in transit, not shared with third parties |

### Versioning convention

EAS auto-increments build numbers. You only manage the human-readable version in `app.json`:

- **Patch** `1.0.0 → 1.0.1` — bug fixes only
- **Minor** `1.0.x → 1.1.0` — new features
- **Major** `1.x.x → 2.0.0` — breaking changes

---

## Part 5 — Environment Variables Master Reference

### API Server (Render — free path)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string from Neon |
| `CLERK_PUBLISHABLE_KEY` | Clerk live publishable key (`pk_live_…`) |
| `CLERK_SECRET_KEY` | Clerk live secret key (`sk_live_…`) |
| `NODE_ENV` | Set to `production` |
| `PORT` | `10000` (Render sets this; keep matching) |
| `SUPPORT_CONTACT_EMAIL` | Email shown on `/support` |

### Mobile App (EAS Secrets)

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Your Render deployment URL |
| `EXPO_PUBLIC_WEB_ORIGIN` | Same as API URL |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk live publishable key |

### Local development only (never commit these)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `CLERK_PUBLISHABLE_KEY` | Clerk **test** publishable key |
| `CLERK_SECRET_KEY` | Clerk **test** secret key |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk **test** publishable key |
| `PORT` | `3001` (API), `5173` (web) |

---

## Part 6 — Pre-Launch Checklist

### Web + API
- [ ] Neon database provisioned and `pnpm --filter @workspace/db run push` has been run
- [ ] `https://your-app.onrender.com/api/healthz` returns 200
- [ ] Clerk **live** keys are used (not test keys) in all production env vars
- [ ] Clerk production domain added and allowed origins configured
- [ ] Sign-up → sign-in → create habit → complete habit → rewards flow tested end-to-end

### Mobile App
- [ ] All `REPLACE_WITH_*` placeholders in `eas.json` filled in
- [ ] `secrets/AuthKey.p8` and `secrets/play-service-account.json` are in place
- [ ] EAS secrets `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_ORIGIN`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` set
- [ ] `app.json` `expo.version` bumped before the production build
- [ ] `com.habitpup.app` registered in both App Store Connect and Play Console
- [ ] `pnpm dlx expo-doctor@latest` reports no errors
- [ ] Privacy policy and support URLs are live (required for both stores)
- [ ] Store listing screenshots, descriptions, and icons uploaded
- [ ] Tested on physical device via TestFlight (iOS) and Play internal track (Android)

---

## Part 7 — Issues to Fix Before Launch

Resolve these tracked issues before publishing:

| Priority | Issue | Impact |
|---|---|---|
| Critical | **Task #41** — Habits not showing after sign-in (auth token race) | **Mitigated:** mobile + web now register Clerk `getToken` in `useLayoutEffect` before child queries run (`habit-mobile/app/_layout.tsx`, `habit-tracker/App.tsx`). Re-test on device. |
| High | **Task #34** — Replace placeholder app icon and splash screen | Confirm `artifacts/habit-mobile/assets/images/icon.png` and `adaptive-icon.png` meet store branding; swap before wide launch if still generic. |
| High | **Task #35** — Add privacy policy and support page | **Done in repo:** API serves `/privacy` and `/support` (`artifacts/api-server/src/app.ts`, `public/legal/`). Set `SUPPORT_CONTACT_EMAIL` in production. |
| Medium | **Task #39** — Remove email verification step | Users may get stuck at sign-up |
| Low | **Task #40** — Clean up unused old auth files | No user impact |

---

## Part 8 — Relevant Files

| File | Purpose |
|---|---|
| `artifacts/habit-tracker/vite.config.ts` | Vite build config — base path, output dir, Replit plugin guard |
| `artifacts/habit-tracker/src/App.tsx` | React app entry — Clerk provider, routing |
| `artifacts/api-server/src/index.ts` | Express entry — serves static files + API in production |
| `artifacts/api-server/build.mjs` | esbuild bundle script for the API |
| `artifacts/api-server/package.json` | Build (`node ./build.mjs`) and start commands |
| `artifacts/habit-mobile/app.json` | Expo config — bundle IDs, version, plugins |
| `artifacts/habit-mobile/app.config.ts` | Dynamic Expo config — injects env vars, fails fast if missing |
| `artifacts/habit-mobile/eas.json` | EAS build profiles and store submit config |
| `artifacts/habit-mobile/package.json` | `dev` (Replit), `dev:local` (local machine) scripts |
| `artifacts/habit-mobile/STORE_SUBMISSION.md` | Original store submission guide |
| `lib/db/src/schema/` | Drizzle ORM schema — all database tables |
| `lib/db/package.json` | `push` script — runs `drizzle-kit push` |
| `lib/api-spec/openapi.yaml` | OpenAPI spec — source of truth for all API contracts |
| `lib/api-client-react/` | Generated TanStack Query hooks (web + mobile) |
| `lib/api-zod/` | Generated Zod schemas (API server validation) |
| `pnpm-workspace.yaml` | Monorepo workspace config and dependency catalog |
