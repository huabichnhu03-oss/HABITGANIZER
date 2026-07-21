# HabitPup — App Store & Play Store Submission Guide

This doc covers everything needed to ship the HabitPup mobile app to the
Apple App Store and Google Play Store from this repo.

---

## 1. One-time prerequisites

You (the developer/owner) must do these manually outside this repo before
any build can be submitted.

### Apple

1. **Enroll in the [Apple Developer Program](https://developer.apple.com/programs/)** (US$99/yr).
2. In **App Store Connect → My Apps → +**, register a new iOS app with:
   - Bundle ID: `com.habitpup.app` (must match `app.json` `ios.bundleIdentifier`).
   - SKU: any unique string (e.g. `habitpup-ios-001`).
   - Primary language: English.
3. Note your **Apple Team ID** (Membership page) and the **App Store Connect App ID**
   (the numeric ID in the app's URL).
4. Generate an **App Store Connect API Key** (Users and Access → Keys → App Store Connect API):
   - Role: Admin (or App Manager).
   - Download the `.p8` private key file (you only get this once).
   - Note the **Key ID** and **Issuer ID**.

### Google (Play Console)

1. Create a **[Google Play Console developer account](https://play.google.com/console/signup)** (one-time US$25) and finish account verification prompts.
2. **Create app** → set package name to **`com.habitpup.app`** (must match `app.json`
   `android.package`). The package name **cannot be changed later**. App name in the store can differ (e.g. “HabitPup”).
3. **Service account for `eas submit` / CI uploads:**
   - In [Google Cloud Console](https://console.cloud.google.com/) pick or create a project.
   - **IAM & Admin → Service accounts → Create**. Grant no default roles unless your org requires them.
   - **Keys → Add key → JSON** — download once; this file is **`play-service-account.json`** for `eas.json`.
   - In **Play Console → Users and permissions → Invite users**, you cannot paste a service email the same way; use **Setup → API access** (or **Users and permission** linking flow your console shows):
     Link the Cloud project, then **Grant Play Console access** to the service account with a role that includes **releases** (often labeled along the lines of **Release apps to testing tracks** / **Release to production**, or bundled as admin-style access depending on UI).
   - Save the JSON to `artifacts/habit-mobile/secrets/play-service-account.json` (never commit).

4. **Store presence (before production review):**
   - Add **privacy policy URL** (`https://<your-deployment>/privacy`) and **support** (`https://<your-deployment>/support`). Both routes are implemented on the Express API (`/privacy` static HTML, `/support` with `SUPPORT_CONTACT_EMAIL`).
   - Complete **App content**: Data safety, content rating (IARC), target audience declarations, ads declaration, etc., as guided by Play Console.

5. **New / personal developer accounts:** Google may require a **closed testing** period before you can publish to production. Confirm the checklist in **[Play Console help — testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)** and plan **internal → closed → production** timelines accordingly.

### Expo / EAS

1. Have an [Expo account](https://expo.dev) and run `pnpm exec eas login` once.
2. Run `pnpm exec eas init` from `artifacts/habit-mobile/` to link this app
   to an EAS project (writes `extra.eas.projectId` into `app.json`).

---

## 2. **Required**: configure your production API & web origin

The mobile app reads its API base URL and web origin from environment
variables at build time (see `app.config.ts` and `lib/config.ts`). There is
**no committed default** — you must set these before any production build,
or `eas build --profile production` will fail fast with a clear error.

Deploy the API server (and web app, if you also want a public web build) to
a stable, publicly reachable HTTPS URL — typically a Replit Deployment
(e.g. `https://<your-deployment>.replit.app`) or a custom domain.

Then register the URL with EAS once:

```bash
cd artifacts/habit-mobile

# The API URL the mobile app talks to (your deployed Express server)
pnpm exec eas secret:create --scope project --name EXPO_PUBLIC_API_URL \
  --value https://your-real-domain.example.com

# The web origin used by expo-router for deep linking and route resolution
pnpm exec eas secret:create --scope project --name EXPO_PUBLIC_WEB_ORIGIN \
  --value https://your-real-domain.example.com

# Clerk — must be the **live** publishable key for production store builds
pnpm exec eas secret:create --scope project --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY \
  --value pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> API / web origin typically point at the same HTTPS deployment. Verify
> `https://your-real-domain.example.com/api/healthz` returns 200 before
> kicking off a production build.

Once set, every EAS build automatically picks them up. No code changes
needed when the URL changes — just update the secret and rebuild.

---

## 3. Credentials: EAS vs local files

### EAS **project secrets** (injected at build time)

| Name | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Mobile → API (`/api/...`) |
| `EXPO_PUBLIC_WEB_ORIGIN` | Deep links / `expo-router` origin |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk in the built app (**`pk_live_…`** for production) |

List with `pnpm exec eas secret:list --scope project`.

### Local files for `eas submit` (never commit)

Place these at the paths from `eas.json`’s `submit` block (`secrets/` is gitignored).

| Secret / file | Used by | How to provide |
|---|---|---|
| `AuthKey.p8` (App Store Connect API key) | `eas submit --platform ios` | `artifacts/habit-mobile/secrets/AuthKey.p8` |
| `play-service-account.json` (Google Play service account JSON) | `eas submit --platform android` | `artifacts/habit-mobile/secrets/play-service-account.json` |

Also fill in the `REPLACE_WITH_*` placeholders inside `eas.json`'s
`submit.production.ios` section with your real Apple Team ID, ASC App ID,
ASC API Key ID, and Issuer ID.

---

## 4. Versioning convention

We use `appVersionSource: "remote"` in `eas.json`, which means EAS auto-increments
`buildNumber` (iOS) and `versionCode` (Android) on each production build.
You only need to manage the human-facing `version` in `app.json`:

- **Patch** (`1.0.0` → `1.0.1`) — bug fixes only.
- **Minor** (`1.0.x` → `1.1.0`) — new user-visible features, backward compatible.
- **Major** (`1.x.x` → `2.0.0`) — breaking UX or data model changes.

Bump `app.json`'s `expo.version` before each production build, commit, then run
`eas build`. EAS handles `buildNumber` / `versionCode` automatically.

---

## 5. Build commands

From `artifacts/habit-mobile/`:

```bash
# Sanity-check native config (no install required, runs ad hoc)
pnpm dlx expo-doctor@latest
pnpm exec expo prebuild --no-install --clean

# Internal dev/preview builds (good for testing on devices)
pnpm exec eas build --profile development --platform ios
pnpm exec eas build --profile development --platform android
pnpm exec eas build --profile preview     --platform android   # APK for sideloading

# Production store builds (requires EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WEB_ORIGIN
# secrets from step 2 — build will fail fast otherwise)
pnpm exec eas build --profile production --platform ios       # produces .ipa
pnpm exec eas build --profile production --platform android   # produces .aab
```

---

## 6. Submit commands

```bash
# After a successful production build:
pnpm exec eas submit --profile production --platform ios       # uploads to TestFlight / App Store Connect
pnpm exec eas submit --profile production --platform android   # uploads to Play Console internal track
```

For Android, the default `track` in `eas.json` is `internal` with `releaseStatus: draft`.

**After upload:** Play Console → **Testing** (or **Release**) → open the draft on the chosen track → **Review release** → start rollout to testers.

**Promotion path (typical):** internal testing → closed testing → (optional open testing) → production. Use **Publishing overview** if the console prompts for missing declarations (Data safety, content rating, etc.).

When you are ready to skip draft internal uploads, change `eas.json` → `submit.production.android` (e.g. `track`: `"production"`, adjust `releaseStatus`) — only after listings and declarations are green.

---

## 7. Store-listing assets you still need to provide

EAS handles the binary; the rest is manual in App Store Connect and Play Console.

### Both stores

- **App icon** — `assets/images/icon.png` plus `assets/images/adaptive-icon.png` for Android. Replace with final branded artwork before a wide production launch if the current assets are still placeholders.
- **Privacy policy URL** — required by both stores. Deploy the API so **`https://<your-domain>/privacy`** resolves (bundled HTML under `artifacts/api-server/public/legal/`).
- **Support URL** — **`https://<your-domain>/support`** (shows `mailto:` using `SUPPORT_CONTACT_EMAIL` on the API server; set in production env).
- **Short description / long description / keywords** — write copy that explains
  what HabitPup is (habit tracking + virtual pet companion).
- **Category** — suggest "Health & Fitness" (primary), "Lifestyle" (secondary).
- **Age rating** — fill out each store's questionnaire. HabitPup has no
  objectionable content, expect 4+ / Everyone.

### iOS (App Store Connect)

- Screenshots at minimum:
  - 6.9" iPhone (1290×2796) — required.
  - 6.5" iPhone (1242×2688 or 1284×2778) — required for older devices.
  - iPad screenshots — only if `supportsTablet: true` (currently `false`, so skip).
- App preview video (optional, 15–30s).
- "What's New" release notes.
- Encryption export compliance — **already declared `false`** via
  `ios.config.usesNonExemptEncryption` in `app.json`.

### Android (Play Console)

- Screenshots: 2–8 phone screenshots (min 320px, max 3840px on the long side, 16:9 or 9:16).
- Feature graphic: 1024×500 PNG/JPG.
- Short description (≤80 chars) and full description (≤4000 chars).
- **Data safety form** — declare what you collect and how it is used (must match reality):
  - **Account / auth:** identifiers such as email — collected and processed via **Clerk** (third-party auth); link Clerk’s policy where appropriate.
  - **User content / app activity:** habit names, schedules, completions, and companion / reward state stored in your backend database for the signed-in user.
  - **Device or app identifiers / diagnostics:** only if you enable optional analytics/crash SDKs (not required by this repo’s defaults).
  - **Notifications:** if users opt in, reminder delivery may involve FCM / platform notification services — declare per Play’s categories.
  - **Encryption:** data in transit over HTTPS between app and your API; describe at-rest handling for your chosen host/DB.
- Content rating questionnaire.

---

## 8. Pre-submit checklist

- [ ] `pnpm --filter @workspace/habit-mobile run typecheck` passes.
- [ ] `pnpm dlx expo-doctor@latest` reports no errors.
- [ ] `app.json` `version`, iOS `buildNumber`, Android `versionCode` look right.
- [ ] EAS secrets `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_ORIGIN`, and
      `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_live_…`) are set for production.
- [ ] `https://<domain>/api/healthz`, `/privacy`, and `/support` return 200 (support uses `SUPPORT_CONTACT_EMAIL` on the API).
- [ ] `com.habitpup.app` is registered in both App Store Connect and Play Console.
- [ ] EAS submit secrets (`AuthKey.p8`, `play-service-account.json`) are in place.
- [ ] Privacy policy and support URLs are live.
- [ ] Store-listing assets (screenshots, descriptions, icons) uploaded.
- [ ] Tested production build on a physical device via TestFlight / Play internal track.
