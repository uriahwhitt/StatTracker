# 🏀 StatTracker – Basketball Game Logger

A mobile-first PWA to track your son's basketball game stats.
Works offline. Installable directly from Chrome on Android.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run locally (also accessible on your phone via local network)
npm run dev
```

Open the URL shown in your terminal on your Android phone in Chrome.

---

## Deploy & Install on Android (free, ~5 minutes)

### Option A: Netlify (easiest)
1. `npm run build` — creates the `dist/` folder
2. Go to [netlify.com](https://netlify.com) → drag & drop the `dist/` folder
3. Your app gets a free URL like `https://your-app.netlify.app`
4. Open that URL in Chrome on your Android phone
5. Tap the **"Add to Home Screen"** banner (or Menu → Add to Home Screen)
6. Done — it's now an app icon on your home screen ✓

### Option B: Vercel
```bash
npm install -g vercel
npm run build
vercel deploy dist/
```

---

## Features

- **Track tab**: Tap +/− for all stats in real time
  - **2PT / 3PT / FT**: Separate MADE and MISS buttons
    - `MADE +` → increments made AND attempts together
    - `MISS +` → increments attempts only (missed shot)
    - Undo buttons correctly reverse each action
  - Live FG% / 3P% / FT% shown during tracking
- **Games tab**: Full history, tap any game for the box score
- **Tournaments tab**: Create named tournaments, tag games to them,
  view per-game averages (PPG/RPG/APG/FG%) across all tournament games

## Stats Tracked
| Category | Stats |
|----------|-------|
| Scoring  | 2PT made/att, 3PT made/att, FT made/att |
| Boards   | Off Reb, Def Reb |
| Playmaking | Assists |
| Defense  | Steals, Blocks |
| Misc     | Turnovers, Fouls |

## Data Storage
All data is stored locally in your browser's `localStorage`.
Data persists across sessions and app restarts.
To back up: open browser DevTools → Application → Local Storage → copy the `bball_tracker_v2` value.

---

## Project Structure
```
bball-tracker/
├── src/
│   ├── App.jsx        ← Main app (all components)
│   └── main.jsx       ← Entry point + SW registration
├── public/
│   ├── manifest.json  ← PWA manifest
│   ├── sw.js          ← Service worker (offline support)
│   └── icons/         ← App icons (192 + 512px)
├── index.html         ← HTML shell with PWA meta tags
├── vite.config.js
└── package.json
```
