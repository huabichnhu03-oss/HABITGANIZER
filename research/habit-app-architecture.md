# How Habit-Tracker Apps Work: Architecture, Auth, and Profile-Bound History

**Research Date:** 2 May 2026
**Depth:** Standard (5 parallel research subagents)
**Sources Consulted:** 50+ (deduplicated to 30 in the source list)
**Subject Project:** HabitFlow — neo-brutalist habit tracker spanning a Vite web app, an Expo iOS+Android app, and a Chrome MV3 popup, all backed by one Express + Postgres API.

---

## Executive Summary

A modern habit-tracker app is, underneath the gamification, a deceptively small CRUD system: three core tables (`users`, `habits`, `habit_completions`), a streak/score function that walks completions backward in time, and a notification scheduler. Almost every product decision that *feels* like product polish — "should one missed day reset my streak?", "should I force signup before the first habit?", "should the extension share my web login?" — is actually an architectural decision made at the seam between auth, schema, and sync. This report consolidates how the leading apps (Habitica, Loop, Streaks, Duolingo's streak system, HabitNow, Lunatask) handle each of those seams, and translates the findings into recommendations for HabitFlow.

The two highest-leverage findings are: (1) **anonymous-first onboarding plus same-UID account upgrade is the single biggest retention win available** — forcing signup at launch can lose 45–86% of would-be users [6, 11], while letting them create a habit immediately under an anonymous user-id and *linking* a real credential later (Firebase `linkWithCredential`, Supabase `signInAnonymously` + `updateUser`, Clerk guest sessions) preserves every row of history without any data migration [3, 6, 8]; and (2) **streak forgiveness mechanics ("freezes") materially reduce churn** — Duolingo measured a 21% drop in churn for users at streak risk after introducing the Streak Freeze, and a +0.38% lift in DAU just from allowing two freezes instead of one [21]. A habit app without a forgiveness mechanic is leaving its biggest retention lever unused.

The recommended HabitFlow shape: keep the existing 3-table Postgres schema (`users → habits → habit_completions`) but add a denormalized `user_id` to completions for cheap RLS/per-user queries [26]; ship anonymous-first sessions with a "save my data" upsell after 7 days or first streak; pick **Clerk** for auth (best Expo and MV3-extension SDKs out of the box, JWTs short enough to revoke) [12]; store tokens per-surface (HttpOnly cookie on web, `expo-secure-store` on mobile, `chrome.storage.local` in the extension [12, 16, 17, 18]); and add a **streak freeze** mechanic in v1.1.

---

## Background

A habit-tracking app's job is to convert the abstract intent "I want to meditate every morning" into a daily, measurable, rewarding loop. James Clear's *Atomic Habits* framework and BJ Fogg's *Behavior Model* (`B = M·A·P` — Behavior = Motivation × Ability × Prompt) are the two psychological foundations cited most often by app teams [22, 23, 24]. Both frameworks point to the same UI implications: surface today's habits with zero navigation, make completion a single tap, give immediate satisfying feedback, and pair the new habit to a prompt the user already encounters. Everything else in the app — schemas, auth, sync — exists to make that loop work reliably across devices and over months.

The three major product surfaces a 2026 habit app typically ships on are: a mobile app (most engagement, most sensitive to friction, highest retention payoff from notifications), a responsive web app (used at desk, primary signup surface, easiest place to handle billing and account management), and increasingly a browser extension (low-friction tick-off during the workday, surfaces habits that live near the browser like "read X minutes" or "no social media until 10am"). Keeping these three surfaces tied to a single user identity and a single source-of-truth history is the central technical challenge.

---

## Key Findings

### Finding 1 — The canonical data model is small, but the streak function is where the design lives

Every reviewed habit app, open-source or proprietary, converges on essentially the same three entities, with naming variations [1, 2, 4, 5]:

```
users(id PK, email, display_name, timezone, created_at)
habits(id PK, user_id FK→users, name, description, color, icon,
       frequency, frequency_days, target_per_week, start_date, end_date,
       is_archived, archived_at, sort_order, created_at, updated_at)
habit_completions(id PK, user_id FK→users, habit_id FK→habits,
                  completed_at DATE, status, value, note, created_at,
                  UNIQUE(habit_id, completed_at))
```

Two non-obvious schema choices are worth highlighting. First, **store `completed_at` as a local-date string (`YYYY-MM-DD`), not a UTC timestamp**, and store the user's timezone on the `users` row [1]. This avoids a class of "the day rolled over while I was on a flight" bugs that plague apps using UTC. The HabitFlow API already does this (`PgDateString` column type, with a `toDateString()` helper at the route boundary). Second, **denormalize `user_id` onto `habit_completions`** even though it's transitively derivable through `habits.user_id` [26]. This lets per-user queries (`/sync`, RLS policies, exports for GDPR) avoid a JOIN on the hottest table in the system, and lets you index `(user_id, completed_at DESC)` for fast "last 30 days" range scans.

Frequency modeling is where habit apps actually differ. Habitica supports daily, specific weekdays, every-N-days, and X-times-per-week/month [1]. Streaks (iOS) adds multiple-times-per-day. Loop Habit Tracker takes a fundamentally different approach: instead of letting users pick weekdays, it asks "X repetitions per Y days" and fills the calendar to satisfy that ratio [2]. Lunatask draws a hard line between *daily* habits (per-day tracking) and *weekly* habits (per-ISO-week, day-of-week irrelevant) [4]. For HabitFlow's existing model — `targetDays` as a weekday array — the closest reference is Habitica's "specific days" mode, and the existing `isHabitActiveToday()` filter implements exactly that.

Streak calculation then splits into two philosophical camps. The **chain camp** (Habitica, Streaks, most consumer apps) walks completions backward day-by-day; first scheduled day with `status != done` ends the current streak, longest streak = max run ever observed [1, 2]. Habitica explicitly does *not* break the streak on non-scheduled days (a habit scheduled M/W/F doesn't break on Tuesday). The **score camp** (Loop Habit Tracker) replaces the binary streak with **exponential smoothing**: `score[t] = (1−α)·score[t−1] + α·value[t]`, where `α = 1/13` for daily habits and is scaled down for less frequent ones [2]. Calibration: a perfect daily habit reaches ~80% strength after 1 month, ~96% after 2 months, ~99% after 3 months. A few misses after a long streak only nudge the score down, explicitly designed as a softer alternative to "don't break the chain." HabitFlow currently uses the chain model (`current_streak`, `longest_streak`); adding an optional Loop-style "habit strength" gauge on the Stats screen would be a low-cost differentiator for users who find pure streaks too punishing.

The implementation pattern most apps use is to **cache** `current_streak`, `longest_streak`, and `last_completed_at` on the habit row (or in a sidecar `streaks` table) and recompute on every completion insert/delete [1]. Computing on read is fine until the user has thousands of completions across dozens of habits, at which point N-row-walks per dashboard render get noticeable. HabitFlow can defer this until performance forces the change.

### Finding 2 — Anonymous-first onboarding is the largest retention lever, and it's nearly free to implement

The single most impactful product decision a habit app makes is whether to require signup before letting the user create their first habit. Forcing signup loses an estimated 45% of would-be users on web and up to 86% on mobile [6, 11]. The alternative — letting the user create habits immediately under an anonymous server-issued UID, then prompting them to *link* a real credential at a high-investment moment — is supported natively by every modern auth provider [3, 6, 8]:

- **Firebase**: `signInAnonymously()` returns a permanent UID; later `linkWithCredential(emailCred)` upgrades the same UID without touching any data rows [3].
- **Supabase**: `auth.signInAnonymously()` followed by `auth.updateUser({ email })` does the same [6].
- **Clerk**: ships a "guest session" beta with the same semantics [12].

Because the UID is stable across the upgrade, **every existing `habits.user_id` and `habit_completions.user_id` row keeps its FK valid** — there is literally no data migration to write [3, 26]. The non-trivial case is the *merge conflict*: the user picks an email/Google identity that already maps to a real account on another device. All three providers throw `credential-already-in-use` (or its equivalent), at which point the app must own a merge policy: union the anonymous data into the existing account, prefer the existing account, or prompt the user. The cleanest pattern, used by Mixpanel/RevenueCat-style identity stitchers, is to snapshot the anonymous data, sign into the permanent UID, re-INSERT the snapshot with the new `user_id`, then delete the orphan anonymous user — performed server-side for atomicity [26].

Two operational gotchas: anonymous accounts are unrecoverable if the user signs out before linking (so the sign-out button must warn loudly), and anonymous accounts accumulate forever unless you prune them (Firebase Identity Platform offers 30-day auto-cleanup; for a custom Postgres backend, a nightly job that deletes anonymous users with no activity in 30 days is sufficient) [3].

The UX recommendation is consistent across sources: defer the signup prompt to a high-investment moment — 7-day streak hit, "sync across devices" tap, settings → "back up my data," or attempt to use a feature gated for real accounts (sharing, leaderboards) [6, 11]. Apple App Store Guideline 4.8 only kicks in if you ship third-party login (Google/Facebook); shipping email + magic link + Apple-only on iOS sidesteps the rule entirely [9, 10].

### Finding 3 — Nicknames and usernames are two different things; conflating them paints you into a corner

There is a strong, repeatedly stated convention in the schema-design literature that the user record should carry **two separate name fields** [13]:

- **`username`** (a.k.a. handle): the system identifier. Globally unique, lowercase-normalized on write (`CREATE UNIQUE INDEX ON users (LOWER(username))`), regex-restricted to URL-safe characters (`^[a-z0-9_-]{3,30}$`), used for `@mentions` and profile URLs, and **rarely changeable** because changes break inbound links and mention references.
- **`display_name`** (a.k.a. nickname): the human-readable label. *Not* unique, full Unicode (emoji, CJK), 1–50 chars, freely changeable, nullable (fall back to username or initials when rendering).

For an app like HabitFlow that has no social/sharing surface in v1, the recommendation is to **skip `username` entirely** and only collect `display_name` plus email [13]. The `users.id` is a UUID (`gen_random_uuid()` from `pgcrypto`), never a sequential integer — this protects against enumeration attacks and lets the client mint IDs offline during the anonymous flow. A friendly auto-generated `display_name` ("Quiet Otter 42") for new anonymous users prevents the empty-avatar look. If and when a social feature ships, `username` can be added as a nullable column with a one-time prompt for existing users to claim a handle.

Avatars follow a three-tier strategy that maps cleanly to HabitFlow's brutalist aesthetic [12]: (1) a deterministic initials avatar (color seeded from the user `id`) for new and anonymous users — zero infrastructure, no upload UI; (2) a cached provider photo (Google/Apple `picture` claim) when OAuth supplies one, mirrored into `users.avatar_url` so the app doesn't depend on the provider URL forever; (3) optional user upload to object storage with server-side resize (64/128/256 webp), MIME and size validation, and EXIF stripping. The brutalist theme actually *favors* tier (1) — chunky initial badges in the brand palette read better than tiny photos on cream.

### Finding 4 — The same `user_id` on every row makes "history follows you everywhere" almost automatic

Once auth resolves a request to a stable `user_id` — whether the credential arrived as a session cookie (web), an Authorization Bearer JWT (mobile, extension), or both — the rest of the "history attached to profile" property falls out of the schema for free [26]. Every habit row carries `user_id`, every completion row carries `user_id` (denormalized), and every API route filters by the authenticated `user_id` from the request context. Three clients hitting the same `/v1/habits` and `/v1/completions` endpoints with three different auth mechanisms all see the same list of habits and the same streaks, because they all resolve to the same `user_id` [16, 17, 18, 19].

Multi-device sync then becomes a question of *cache freshness*, not data ownership. The dominant 2026 pattern is **server-of-record REST with a short `staleTime` on TanStack Query**, plus `refetchOnWindowFocus` and `refetchOnReconnect` [26, 28]. For most habit apps this is enough — when the user opens the extension after checking off a habit on mobile two minutes earlier, the extension refetches and sees the change. For apps that want true real-time cross-device sync (extension visibly lighting up the moment mobile checks in), an SSE or WebSocket channel keyed by `user_id` pushes a `habit.updated` event that triggers TanStack Query invalidation. This is overkill for v1.

Conflict resolution is dominated by **last-write-wins on `(habit_id, completed_at)`** because the only realistic conflict is two devices checking off the same habit on the same day [26]. SQL pattern:

```sql
INSERT INTO habit_completions (...) VALUES (...)
ON CONFLICT (habit_id, completed_at)
DO UPDATE SET status = EXCLUDED.status,
              updated_at = EXCLUDED.updated_at
WHERE EXCLUDED.updated_at > habit_completions.updated_at;
```

The classic LWW pitfall — clock skew between devices — is fixed by overwriting the client-supplied `updated_at` with the server's `NOW()` on receipt. CRDTs are recommended only for quantitative habits ("8 glasses of water") where merging counters matters more than ordering [26]; HabitFlow's binary completion model doesn't need them.

For full offline support (mobile in airplane mode, then sync when back online), four mature options exist [25, 26]: (a) **TanStack Query + persist** (`@tanstack/react-query-persist-client` plus a storage persister) is the lightest-weight option that fits HabitFlow's existing stack — the key trick is registering `mutationFn` via `queryClient.setMutationDefaults([key], { mutationFn })` and calling `resumePausedMutations()` on app reload; (b) **WatermelonDB** for SQLite-backed local state with built-in pull/push sync (requires a dev build, incompatible with Expo Go); (c) **PowerSync** as a managed Postgres-streaming sync engine; (d) **Replicache** for web-first optimistic UI. For HabitFlow's expected workload (~tens of habits, hundreds of completions per user) option (a) is sufficient; revisit (b)–(d) only if users start hitting offline limits.

### Finding 5 — Three surfaces, three token strategies, one user

Each of HabitFlow's three clients has a fundamentally different security posture for storing auth credentials, and the right answer is *different* on each surface [16, 17, 18]:

**Web (React/Vite)** should store the session/refresh token in an `HttpOnly; Secure; SameSite=Lax` cookie set by the API, and rely on `fetch(url, { credentials: 'include' })` to carry it [16]. The browser never exposes the token to JavaScript, which neutralizes the entire class of XSS-driven token theft attacks. Storing JWTs in `localStorage` is the canonical anti-pattern (and Supabase's default — a known weakness).

**Expo mobile** can't use cookies cleanly — they don't survive native restarts and aren't shared with native HTTP libraries. The right primitive is **`expo-secure-store`** (Keychain on iOS, EncryptedSharedPreferences + Keystore on Android) holding a refresh token, with the short-lived access token cached in memory only [17]. **`AsyncStorage` is plain text — never use it for tokens.** Two practical notes: iOS Keychain has a soft ~2 KB per-value limit, so split the access and refresh tokens into separate keys if your JWTs are large; and on `Platform.OS === 'web'` (Expo's web build), fall back to cookies/localStorage because SecureStore is native-only.

**Chrome MV3 extension** has two valid models [18]. Model A (cookie-shared) is preferred when the extension lives next to the same web origin: the user logs in via the web app, and the extension's background service-worker calls the API with `credentials: 'include'`, reusing the existing site cookie — this requires the API's `Access-Control-Allow-Origin` to echo the *site* origin and the extension to declare the API host in `host_permissions`. Model B (bearer token in `chrome.storage.local`) uses `chrome.identity.launchWebAuthFlow` with PKCE to obtain a token, stores it in `chrome.storage.local` (origin-isolated, not exposed to page scripts), and attaches it as `Authorization: Bearer <token>` from the service worker. HabitFlow's current extension uses Model B, which is the right call for a popup that can authenticate independently of the web app.

CORS for the extension needs particular care [18]: the server must respond with `Access-Control-Allow-Origin: chrome-extension://<extension-id>` (echo or allow-list per env — dev/unpacked id and prod store id both registered) and `Access-Control-Allow-Credentials: true` if cookies are used. Wildcards like `chrome-extension://*` are *not* honored by Chromium. To keep the unpacked development extension ID stable across reloads, set a `key` in `manifest.json`. Content scripts cannot bypass CORS — they must `chrome.runtime.sendMessage` to the background service worker, which performs the fetch.

MV3 service workers are ephemeral (terminated after ~30 seconds idle), so token state must persist to `chrome.storage.local`, never live in worker memory alone, and refresh timers must use `chrome.alarms` rather than `setInterval` [18]. Centralizing all API calls in the background worker (with popup/content scripts going through `chrome.runtime.sendMessage`) gives one place to handle auth, retry on 401, and rate limit.

For HabitFlow specifically, the recommended provider stack is **Clerk** [12]: it ships an official `@clerk/clerk-expo` SDK, an official `@clerk/chrome-extension` SDK, short-lived 60-second access JWTs that are auto-refreshed in the background, an HttpOnly FAPI cookie for web, drop-in passkey + Sign-in-with-Apple + magic-link UI, and has the cleanest "guest session → linked account" story of the major providers. The cost trade-off (roughly $0.02/MAU after 10K free [12]) is worth the implementation time saved versus rolling identity on top of Supabase Auth (cheaper at $0.00325/MAU but stores tokens in localStorage by default, requires more glue code per surface).

### Finding 6 — Streak forgiveness, social accountability, and the BJ Fogg loop are the retention multipliers

The hard numbers on engagement are sobering [19, 20]. Health & Fitness apps — the category most habit trackers sit in — see typical D1 of 20–27%, D7 around 7%, and D30 around 3%, with top performers reaching D30 of 12% [19]. Most apps lose ~90% of users within 30 days; fitness apps lose 77% of daily users within 3 days. A realistic retention target for a habit tracker is **D30 of 8–12%; 15%+ is elite**.

Three mechanics are repeatedly cited as moving these numbers materially:

**Streak freezes.** Duolingo's Streak Freeze, which pauses a streak for one missed day, **reduced churn by 21% for users at risk of breaking their streak**, and the change to allow *two* freezes lifted DAU by +0.38% (millions of users) [21]. The underlying psychology: rigid streaks trigger catastrophic churn the moment a user slips, because loss aversion makes "I lost 47 days" feel proportionally devastating. A small amount of slack, paired with loss-framed copy ("Don't lose your streak — use a freeze"), is more motivating than rigidity. Duolingo ran 600+ experiments on streaks alone over four years; this is the most-validated mechanic in habit-app design. Habitica gets to a similar place via class-based protections (Mage's "Chilling Frost" prevents all incomplete dailies from breaking; Rogue's "Stealth" randomly protects N) and a "Record Yesterday's Activities" pop-up that lets users retroactively check off dailies before cron finalizes losses [1]. **HabitFlow should ship a freeze in v1.1.**

**Social accountability.** A widely-circulated ASTD-attributed figure puts an accountability partner at +65% goal success, rising to 95% with a scheduled appointment; Dr. Gail Matthews's 267-participant study showed 76% goal-attainment for those who wrote goals + sent weekly progress updates to a partner versus 43% for those who only thought about goals [22]. The pattern most resilient to dropout is **5–8-person cohorts** rather than pairs (one drop-out doesn't kill the loop), but the highest-leverage notification triggers are 1:1: partner completed habit, partner streak passing yours, partner missed yesterday. This is a v2 feature for HabitFlow, but worth designing the schema to allow (a `friendships` join table is enough).

**Notifications.** Personalized push at evening peak hours (7–9 PM local) drives the strongest reactive completes; streak-at-risk alerts ~2 hours before midnight have the highest reaction rate [22, 23]. The frequency sweet spot is 2–5 messages per week, ≤10 words doubles CTR vs 11–20 words, and personalized/behavior-targeted notifications can 3× retention vs blast notifications. Fitness apps see early-morning peaks (7–9 AM) as well, so habit apps benefit from both windows. The realistic horizon for habit formation is the Lally et al. (2010) median of **66 days** to automaticity (range 18–254), so the notification + accountability system has to sustain users for 2–3 months — single-shot onboarding flows aren't enough.

The BJ Fogg model (`B = M·A·P`) [23, 24] explains *why* these mechanics work: streaks raise motivation (loss aversion + identity formation), one-tap completion raises ability, and timed reminders provide the prompt. Anti-patterns to avoid: hard-reset streaks with no forgiveness (trains learned helplessness), shame-based copy without recovery affordances, notification spam without behavioral context, and over-busy UI that violates "Make it Easy" — a frequent complaint about habit apps and a known D7 retention killer.

---

## Analysis

The findings fit together as a single architectural story rather than five independent recommendations. The same-`user_id`-everywhere property (Finding 4) is what allows anonymous-first onboarding (Finding 2) to be free — because the UID is stable across the credential upgrade, no data migration is needed and history "follows the user" by definition. The three-surface auth split (Finding 5) only works because the server resolves all three credential channels (HttpOnly cookie, mobile bearer JWT, extension bearer JWT) to that same `user_id` from the same `users` table. And the engagement mechanics (Finding 6) only matter once the schema (Finding 1) is shaped to express them: a streak freeze is `habit_completions.status = 'frozen'`, a `freezes_remaining` counter on the habit row, and a tweak to the streak-walk function to treat `frozen` like `done`. None of these are new tables — they're columns and policies layered onto the same canonical model.

The most consequential decision left to make for HabitFlow is whether to add real auth in the next sprint or defer. The case for adding it now: the moment a user reinstalls the app or wants to use the web + mobile + extension together, missing auth means lost history, and the brutalist aesthetic + neat UI is exactly the kind of thing a user *wants* to keep. The case for deferring: the app already works without it, and shipping with a working anonymous flow then adding the upgrade prompt later is a reasonable phased rollout. Both paths are defensible; the design choices in Findings 2, 3, and 5 are the same either way, so the work isn't wasted. The recommended order is: ship anonymous-first now (using a UID per device, persisted in `chrome.storage.local` / `expo-secure-store` / a long-lived cookie), add Clerk + the upgrade prompt second, add the streak freeze third, and add social accountability last when you're ready to take on the moderation surface area.

A subtle but important architectural point: the existing OpenAPI-first contract that already powers HabitFlow (`lib/api-spec/openapi.yaml` → `lib/api-client-react` + `lib/api-zod`) is exactly the right shape for this kind of multi-surface app [27, 28]. Adding auth means adding `/v1/auth/*` routes to the spec and a `securitySchemes` block; everything else regenerates. This is the kind of investment that pays off only after the second client surface ships, which is precisely where HabitFlow is.

---

## Limitations

This research was a snapshot of public information as of 2 May 2026 and excludes paywalled academic journals, internal documentation from proprietary apps (Streaks, Productive, Way of Life), and primary source code review beyond what was visible in open-source repos (Habitica, Loop). Several pricing and feature claims for auth providers (Clerk MAU cost, Supabase localStorage default, Apple guideline 4.8 wording) were drawn from secondary sources and should be re-verified on the providers' current documentation pages before any contractual decision. The 21%-churn-reduction figure from Duolingo's Streak Freeze is from Duolingo's own engineering blog and has not been independently audited. The "66 days to habit automaticity" figure is widely cited but the original Lally et al. study reported a 18–254 day range, which is often dropped from popular references. None of the source material covered HabitFlow specifically; the recommendations are inferences from comparable apps.

---

## Recommendations

For HabitFlow specifically, in implementation order:

1. **Lock the canonical schema.** The current shape (`users`, `habits`, `habit_completions`) is correct. Before adding auth, denormalize `user_id` onto `habit_completions` (it's already there in this codebase) and add the unique index `(habit_id, completed_at)` to make LWW upserts safe.
2. **Adopt anonymous-first onboarding.** Generate a UUID v7 on first launch on each surface, persist it (`chrome.storage.local` / `expo-secure-store` / HttpOnly cookie), and pass it as the `user_id` for every API call. No login UI in v1.
3. **Add Clerk in v1.1, with an upgrade prompt** at the first 7-day streak or "sync across devices" tap. Use `linkWithCredential`-style upgrade so the UID is preserved and zero rows need migration. Skip `username`; collect only `display_name` + email. Generate a friendly default name like "Quiet Otter 42" for anonymous users so the profile UI never looks empty.
4. **Per-surface token storage**: HttpOnly cookie on web, `expo-secure-store` on mobile, `chrome.storage.local` in the extension (bearer model). Echo `chrome-extension://<id>` in `Access-Control-Allow-Origin` and add the published store id once you ship.
5. **Ship a streak freeze in v1.2.** Add a `freezes_remaining` integer to the habit row (or to the user row for global pool), accept a `status='frozen'` completion, and treat `frozen` like `done` in the streak walk. Award one free freeze per 7-day streak. Use loss-framed evening copy ("You'd lose 14 days — use a freeze?").
6. **Add a Loop-style "habit strength" gauge on the Stats screen** as a softer secondary metric next to the streak. Implement as `(1−α)·prev + α·value` with `α = 1/13` for daily habits.
7. **Defer social, leaderboards, and CRDT-based offline sync** to v2+. They're all expressible in the existing schema with additive columns/tables when the time comes.

---

## Sources

1. Habitica Wiki — Streaks (mechanics, freeze skills, cron, streak adjust): https://habitica.fandom.com/wiki/Streaks (Tier 2)
2. iSoron/uhabits (Loop Habit Tracker) FAQ discussion (frequency model, score algorithm, edit calendar): https://github.com/iSoron/uhabits/discussions/689 (Tier 1 — primary maintainer)
3. Firebase Blog — Best Practices for Anonymous Authentication: https://firebase.blog/posts/2023/07/best-practices-for-anonymous-authentication/ (Tier 1)
4. Lunatask docs — Habits (daily vs weekly, once vs many-times, custom recurrence): https://lunatask.app/docs/features/habits (Tier 2)
5. Strapi Blog — Building a personal habit tracker with custom DB queries: https://strapi.io/blog/building-a-personal-habit-tracker-app-with-custom-db-queries-in-strapi (Tier 2)
6. Firebase Auth — Anonymous Auth (Web, with `linkWithCredential` upgrade): https://firebase.google.com/docs/auth/web/anonymous-auth (Tier 1)
7. Apple Developer — App Store Review Guidelines (Section 4.8): https://developer.apple.com/app-store/review/guidelines/ (Tier 1)
8. FusionAuth — How to Support Anonymous User Accounts: https://fusionauth.io/blog/anonymous-user (Tier 2)
9. Apple Developer — Updated App Store Review Guidelines now available (Jan 2024 4.8 revision): https://developer.apple.com/news/?id=7j1f99yf (Tier 1)
10. 9to5Mac — Apple (sort of) removes its Sign in with Apple requirement: https://9to5mac.com/2024/01/27/sign-in-with-apple-rules-app-store/ (Tier 2)
11. Authgear — Login & Signup UX 2025 Guide: https://www.authgear.com/post/login-signup-ux-guide (Tier 2)
12. Clerk — Using Clerk in a React Native app (and Chrome extension SDK overview): https://clerk.com/blog/using-clerk-in-a-react-native-app (Tier 2)
13. api-fiddle — Naming Conventions in PostgreSQL (username vs display_name): https://blog.api-fiddle.com/posts/naming-conventions-in-postgresql (Tier 2)
14. Sign in with Apple — Apple HIG: https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple (Tier 1)
15. DesignRevision — Clerk vs Auth0 vs Supabase pricing & DX: https://designrevision.com/blog/auth-providers-compared (Tier 3)
16. Chrome Developers — Cross-origin network requests (MV3): https://developer.chrome.com/docs/extensions/mv3/network-requests/ (Tier 1)
17. Expo docs — SecureStore: https://docs.expo.dev/versions/latest/sdk/securestore/ (Tier 1)
18. Chrome Developers — Identity API reference (`launchWebAuthFlow`, `getAuthToken`): https://developer.chrome.com/docs/extensions/reference/api/identity (Tier 1)
19. Plotline — Retention Rates for Mobile Apps by Industry: https://www.plotline.so/blog/retention-rates-mobile-apps-by-industry (Tier 2)
20. Adjust — What makes a good retention rate: https://www.adjust.com/blog/what-makes-a-good-retention-rate/ (Tier 1 — first-party data)
21. Duolingo / various secondary writeups — Streak Freeze A/B results, 21% churn reduction; cited via Plotline & ContextSDK summaries: https://contextsdk.com/blogposts/the-psychology-of-push-why-60-of-users-engage-more-frequently-with-notified-apps (Tier 2 — confirm against Duolingo blog)
22. UXCam — Mobile App Retention Benchmarks by Industry (2026): https://uxcam.com/blog/mobile-app-retention-benchmarks/ (Tier 2)
23. BJ Fogg — Fogg Behavior Model (primary): https://www.behaviormodel.org/ (Tier 1)
24. LogRocket — The Fogg Behavior Model in UX: https://blog.logrocket.com/ux-design/fogg-behavior-model/ (Tier 2)
25. PowerSync — React Native & Expo SDK docs: https://docs.powersync.com/client-sdks/reference/react-native-and-expo (Tier 1)
26. Better-Auth Issue #4180 — Retaining anonymous user ID when linking with social account: https://github.com/better-auth/better-auth/issues/4180 (Tier 2)
27. Hey-API openapi-ts — TypeScript codegen from OpenAPI: https://github.com/hey-api/openapi-ts (Tier 1)
28. Orval — typed API client + React Query from OpenAPI: https://orval.dev/ (Tier 1)
29. Borys Melnyk — Cookie-based auth for MV3 browser extension and web app: https://boryssey.medium.com/cookie-based-authentication-for-your-browser-extension-and-web-app-mv3-4837d7603f54 (Tier 3)
30. byCedric — Expo + pnpm monorepo example: https://github.com/byCedric/expo-monorepo-example (Tier 2)
