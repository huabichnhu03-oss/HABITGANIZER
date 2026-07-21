# HabitPup mobile (Expo) — handoff notes

Read this when picking up **Play Store / EAS** or **habit-mobile** work again.

## Where things live

| What | Path |
|------|------|
| Expo app | `artifacts/habit-mobile/` |
| EAS profiles + submit | `artifacts/habit-mobile/eas.json` |
| Store runbook (Apple + Google, secrets, checklists) | `artifacts/habit-mobile/STORE_SUBMISSION.md` |
| Production env guard (fails build if API/web origin missing) | `artifacts/habit-mobile/app.config.ts` |
| Android package / versioning | `artifacts/habit-mobile/app.json` |

## Google Play (high level)

- Production Android build is an **AAB** via `eas build --profile production --platform android`.
- `eas submit --profile production --platform android` uses `secrets/play-service-account.json` (gitignored) and defaults to **internal** track + **draft** in `eas.json`.
- **Package name must match Play app:** `com.habitpup.app` (see `app.json` → `android.package`).

## Implemented in repo (previous session)

- **Privacy + support URLs for store listings:** Express serves `GET /privacy` (static HTML) and `GET /support` (HTML with `mailto:` from env). Files: `artifacts/api-server/src/app.ts`, `artifacts/api-server/public/legal/privacy.html`. Set **`SUPPORT_CONTACT_EMAIL`** on the API (also in root `.env.example`).
- **Web dev:** Vite proxies `/privacy` and `/support` to the API — `artifacts/habit-tracker/vite.config.ts`.
- **Web:** Legal footer links on welcome + sign-in/up — `artifacts/habit-tracker/src/App.tsx`.
- **Mobile auth screen:** Opens same URLs via `Linking` using **`API_URL`** (legal pages live on API origin), not only Vite — `artifacts/habit-mobile/components/AuthScreen.tsx`.
- **Task #41 mitigation:** Clerk bearer token wired with **`useLayoutEffect`** so the first React Query fetch is less likely to run before `Authorization` is set — `artifacts/habit-mobile/app/_layout.tsx` and **`ClerkApiSessionTokenBridge`** in `artifacts/habit-tracker/src/App.tsx`.
- **`STORE_SUBMISSION.md`:** Expanded Google Console steps (service account, testing-policy link), EAS secrets including **`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`**, Data safety wording for **Clerk** (not “Replit Auth”), promotion notes.
- **TypeScript:** Removed `tsconfig.json` **project references** entry pointing at `@workspace/api-client-react` composite build — avoids needing a pre-built `dist` for workspace typecheck; `pnpm --filter @workspace/habit-mobile run typecheck` should run standalone.

## Still manual / verify next time

1. **Expo:** `pnpm exec eas login` from `artifacts/habit-mobile`; **`eas init`** until `extra.eas.projectId` exists in `app.json` if missing.
2. **EAS project secrets:** `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_ORIGIN`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (**`pk_live_…`** for production). Commands are in `STORE_SUBMISSION.md`.
3. **Play upload key:** GCP service account JSON → `artifacts/habit-mobile/secrets/play-service-account.json`; grant Play Console API access per runbook.
4. **Run locally before a store build:** `pnpm dlx expo-doctor@latest` and `pnpm exec expo prebuild --no-install --clean` (from habit-mobile). Last **expo-doctor** pass flagged **version skew**: `expo-notifications` and `@react-native-community/datetimepicker` did not match Expo SDK 54 expectations; **`pnpm exec expo install expo-notifications @react-native-community/datetimepicker`** from habit-mobile was started to align versions but **may not have finished** — re-run and commit lockfile updates if needed.
5. **`eas build` / `eas submit`:** Require logged-in Expo account + network; not run to completion in that session.

## Quick commands (from `artifacts/habit-mobile`)

```powershell
pnpm --filter @workspace/habit-mobile run typecheck
pnpm dlx expo-doctor@latest
pnpm exec eas build --profile production --platform android
pnpm exec eas submit --profile production --platform android
```

## Related Cursor rule

Broad monorepo status (web/API/mobile): `.cursor/rules/progress.md`.
