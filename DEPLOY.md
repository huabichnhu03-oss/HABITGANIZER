# Web deploy — Netlify only

Habiganize **web** (`artifacts/habit-tracker`) is hosted on **Netlify**. Do not create or reconnect a Vercel Git integration for this repository.

| Piece | Host |
|-------|------|
| Web SPA | **Netlify** (`netlify.toml`) |
| API | Separate Node host (e.g. Render `habiganize-api.onrender.com`) |
| Mobile | Expo / EAS (not Netlify) |

## Stop Vercel auto-deploys (one-time, in dashboard)

Root `vercel.json` already sets `git.deploymentEnabled: false` so pushes should not create new Vercel deployments. To fully remove Vercel:

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → project **habitganizer** (or similar).
2. **Settings → Git → Disconnect** the GitHub repo (or delete the Vercel project).
3. Optional: on GitHub → repo **About** → clear homepage if it still points at `*.vercel.app`; use your Netlify / custom domain instead.

## Preview

- **Local:** `pnpm --filter @workspace/habit-tracker run dev` → `http://localhost:5173`
- **Netlify:** deploy previews from the Netlify ↔ GitHub site connection (not Vercel).
