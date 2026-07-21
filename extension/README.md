# HabitFlow Browser Extension

A quick-popup Chrome/Edge extension to check off habits without leaving your tab. Talks to the same HabitFlow REST API used by the web and mobile apps.

## Install (unpacked)

1. Build/publish your HabitFlow app and copy its public URL (e.g. `https://habit-tracker.your-username.replit.app`).
2. Open `chrome://extensions` (or `edge://extensions`).
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked** and select this `extension/` folder.
5. Pin the HabitFlow icon, click it, and use the gear to paste your API URL.

## Files

- `manifest.json` — Chrome MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — the popup UI
- `icons/` — 16 / 48 / 128 px icons

## Notes

- Settings (your API URL) are saved with `chrome.storage.local`, so they persist across sessions.
- Network access is permitted for `https://*` and `http://localhost/*`.
- No tracking, no analytics — the popup only calls the URL you configure.
