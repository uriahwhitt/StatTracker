# WE TRACK — Claude Code Instructions

## Branch Workflow

- **`main`** is production. It is always deployable and maps to the Netlify deployment.
- **`dev`** is where all new work happens.
- Never commit directly to `main` during active development.
- When a feature is stable and tested, merge `dev` → `main`, then push both.

```
dev  →  (test)  →  main  →  Netlify
```

If asked to commit or push without a branch specified, default to `dev`.
If asked to deploy or merge to production, confirm with the user first.

---

## Before Writing Any Code

1. Read `ARCHITECTURE.md` — it is the authoritative reference for all data models, nav structure, and component responsibilities.
2. Read the file(s) you are about to change. Never modify code you haven't read.
3. If a `prompt.md` exists in the project root, treat it as the current session's task list.

---

## Files — Do Not Touch

| File / Directory | Reason |
|---|---|
| `src/utils/stats.js` | Stable utility — no changes needed |
| `src/utils/dates.js` | Stable utility — no changes needed |
| `src/utils/pdfExport.js` | Export functions are final; only the trigger UI changes |
| `src/components/tracker/` | Individual tracker module — separate code path, do not modify |
| `src/components/tournament/` | Legacy view kept intact |

---

## Data & Storage Rules

- All app data lives in a single `db` object. Shape defined in `ARCHITECTURE.md §3`.
- `loadDb()` and `persist(db)` are the only storage interface. Both are async (Firestore).
- Storage backend: Firebase Firestore with offline persistence. Config via `.env` (never commit `.env`).
- Firestore path: `users/{uid}/data/db` (anonymous auth, one document per device).
- `.env` is gitignored. Use `.env.example` to document required variables.
- The `db` object shape must always include: `games, tournaments, players, organizations, teams, scorebookGames, scheduledGames`.

---

## Visual Style — Dark Theme

All components must use the theme from `src/utils/constants.js`. No new colors.

| Token | Value | Use |
|---|---|---|
| `T.bg` | `#0a0a0f` | Page background |
| `T.card` | `rgba(255,255,255,0.04)` | Card background |
| `T.border` | `rgba(255,255,255,0.08)` | Card/divider border |
| `T.orange` | `#f97316` | Primary accent, CTAs, active state |
| `T.green` | `#22c55e` | Positive stats, success, wins |
| `T.blue` | `#3b82f6` | Informational |
| `T.red` | `#ef4444` | Errors, fouls, danger, losses |
| Text primary | `#ffffff` | |
| Text secondary | `#888888` | |
| Text muted | `#444444` | |

**Typography:**
- Body font: `DM Sans`
- Numbers, scores, jersey numbers: `DM Mono`
- Section labels: `10px, weight 700, letter-spacing 0.08em, uppercase, color #555`

**Sizing:**
- Card border-radius: `12px`
- Button/input border-radius: `8–10px`
- Filter pill border-radius: `20px`

**Filter pills (active/inactive pattern):**
- Active: orange tint background + orange border + orange text
- Inactive: transparent + muted border + muted text

---

## Layout Rules

- **No `position: fixed` in components.** BottomNav is the only exception (it is already built).
- **Modal pattern:** Use a faux viewport overlay — a wrapper `div` with `position: fixed; inset: 0` containing a bottom-anchored sheet. The sheet itself uses normal flow layout with `maxHeight` + `overflowY: auto`.
- Mobile-first. The scorebook must work in landscape on a phone.
- No horizontal scroll anywhere except intentional overflow containers (e.g., stat tables).

---

## Navigation (5 tabs)

| Tab | View key | Component | Purpose |
|---|---|---|---|
| Track | `tracker` | `TrackerView` | Individual player stat entry |
| Scorebook | `scorebook` | `ScorebookView` | Live team game scoring |
| History | `history` | `HistoryView` | Read-only game log (Games/Players/Teams) |
| Reports | `reports` | `ReportsView` | All PDF/JSON exports (Player/Team/Game scope) |
| Manage | `manage` | `ManageView` | People + Schedule CRUD only — no exports |

---

## Component Responsibilities

- **HistoryView** — read-only. Never writes to `db`.
- **ReportsView** — export triggers only. Never writes to `db`. Calls functions from `pdfExport.js` directly.
- **ManageView** — write-only CRUD. No export buttons, no read-only views.
- **ScorebookView** — manages its own live game state. Tells App to hide chrome via `onLiveChange`.

---

## Commit Conventions

- Commit messages: imperative, present tense, concise summary line.
- Include a blank line + bullet body for multi-change commits.
- Always add the co-author trailer:
  ```
  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  ```
- Stage only files relevant to the change. Do not stage `.env`, `.claude/`, `*.zip`, `*.docx`, `prompt.md`, or `basketball-tracker.jsx`.

---

## Build Verification

Before declaring any task complete, run:
```bash
npm run build
```
The build must exit with code 0 (warnings about chunk size are acceptable — jspdf and firebase are large).

---

## PWA / Service Worker

This app installs as a PWA. The service worker aggressively caches assets, which means:

- After significant code changes, the old service worker may serve a stale build even after restarting `npm run dev`.
- If the app behaves unexpectedly after a major update, instruct the user to unregister the service worker:
  `DevTools → Application → Service Workers → Unregister`, then hard refresh.
- Never assume a blank screen or stale UI is a code bug until the service worker has been cleared.
