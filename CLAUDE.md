# WE TRACK — Claude Code Working Context

## Session Startup Protocol

Every Claude Code session must follow this exact sequence before writing any code:

1. Read `MASTER_PLAN.md` in full — this is the single canonical reference for all architecture, features, and build phases.
2. Read `IMPLEMENTATION_STATUS.md` — confirms current gate, known issues, and any uncommitted work from prior sessions.
3. Read `PLAYER_ENTITY_SCHEMA.md` — required before touching any player, stat, team, or org schema in Gate 7 or later.
4. If a `prompt.md` file exists in the repo root, read it — it contains the tasking document for this session.
5. Run `npm run build` before writing any code to confirm the baseline builds clean. The build must exit `0`. Chunk size warnings are acceptable — `jspdf` and Firebase are large bundles.
6. Do not ask clarifying questions that are answered by the above documents. Read first, then proceed.

---

## Project Identity

- **App name:** WE TRACK (also referred to as StatTracker in legacy files)
- **Owner:** Whitt's End LLC
- **Production URL:** trackstat.netlify.app
- **Stack:** React 18 + Vite, Firebase Firestore (offline-first), Firebase Authentication, Netlify CI/CD
- **Current phase and gate:** Phase 2, Gate 6 (Scorebook Game Clock) ✅ COMPLETE — pending live UI test. Next: Gate 7 (Player Profile System + Claim Codes).
- **Primary users today:** org admin + head coaches in NC travel basketball
- **Long-term vision:** multi-sport tournament organizer platform with multi-org support

---

## Branch and Commit Rules

- Active development happens on the `dev` branch.
- `main` is the stable/production branch (maps to the Netlify deployment) — only merge from `dev` when a gate is fully tested.
- Never commit directly to `main`.
- If asked to deploy or merge to production, confirm with the user first.
- Commit messages: imperative, present tense, concise summary line. Multi-change commits get a blank line + bullet body.
- Every commit must include the co-author trailer:
  ```
  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  ```
- Stage only files relevant to the change. Files **never** to stage under any circumstances:
  - `.env`
  - `.claude/`
  - `*.zip`
  - `*.docx`
  - `prompt.md`
  - `basketball-tracker.jsx`
  - Any Firebase service account key file (`*.json` in repo root)

---

## Data and Storage Architecture

### Event-sourced model

- The scorebook stores an **event log**, never running totals.
- All statistics are derived by replaying the event log.
- This enables full undo (remove any event, stats recalculate instantly), play-by-play feed, and future camera clock sync.
- Never store derived totals as the source of truth.

### Storage interface

- `loadDb()` and `persist()` in `src/utils/storage.js` are the **only** storage interface — all components call these, never Firestore directly.
- Both functions are async (Firestore-backed).
- The `db` object shape is fixed — any component that adds a new top-level key must also update the `defaultDb()` shape in `storage.js`.
- Required `db` shape:
  ```
  { games, tournaments, players, organizations, teams,
    scorebookGames, scheduledGames }
  ```

### Path routing

- **Personal path:** `users/{uid}/data/db` — used when the user has no org role.
- **Org path:** `orgs/{orgId}/data/db` — used when the user has an org role.
- Path is resolved by `getActivePath()` in `storage.js` on every `loadDb` call.
- `setActivePath()` is the escape hatch for deterministic routing after org creation or invite acceptance — always call this when writing a new role doc to prevent race conditions.
- Firebase config lives in `.env` (gitignored). Use `.env.example` to document required variables.

### Autosave

- **Dual-rate:** 300ms debounce for Manage/roster edits; **45 seconds** during live scorebook games (`game.status === 'live'`).
- `localStorage` is written on **every** change as the crash-safe backup — Firestore sync is for cross-device visibility, not crash recovery.
- ⚠️ **CRITICAL:** Never use a short debounce (under 30s) during live games. At the April 2026 tournament, 300ms autosave during games on unstable gym wifi exhausted Firestore's offline write queue. All 5 games were stranded in `localStorage` and required manual recovery via Firebase Admin SDK. The 45s throttle is non-negotiable during live games.

### Firestore offline persistence

- Enabled via `persistentLocalCache()` — the app works fully offline.
- The write queue has a finite size — high-frequency writes on unstable connections will exhaust it.
- If a live game shows "pending" writes that never resolve, the queue may be exhausted — the data is safe in `localStorage`, not lost.

---

## Authentication Model

### Anonymous mode

- Anonymous auth is **permanent** — never remove this path.
- Anonymous users get full solo functionality indefinitely.
- Transfer codes (6-char, 10-min TTL at `/transferCodes/{code}`) are the sync mechanism for anonymous users and remain in the codebase forever.

### Google OAuth

- Use `signInWithPopup` **only** — never `signInWithRedirect`.
- `signInWithRedirect` causes an OAuth redirect loop on Netlify (non-Firebase-hosted deployments). This was diagnosed and fixed in April 2026. Do not revert.
- Anonymous → Google linking uses Firebase native account linking — existing UID is preserved, no data migration needed.
- After sign-in, call `handleSignIn` which reloads `db` to ensure org path data appears immediately.

### Superadmin

- Implemented as a Firebase Auth **custom claim**: `superadmin: true`.
- **Never** stored in a Firestore document.
- Set manually via Firebase Admin SDK as a one-time operation.
- Checked in rules via:
  ```
  function isSuperadmin() {
    return request.auth.token.superadmin == true;
  }
  ```

---

## Player Entity Rules

- The **player entity is the primary entity** of the system — permanent, independent of any org or team.
- Players start as anonymous placeholders created by coaches (name, jersey, team assignment).
- A claim link (`claimCodes/{code}`) allows a parent or player to link their Google account to the player entity via coach approval.
- Once linked, the UID is permanently bound — stats, DMs, and calendar history follow the player across team and org transfers.
- **Never** treat org or team as the owner of player identity or stats.
- Stats live under the player entity:
  ```
  players/{playerId}/stats/{sport}/games/{gameId}
  ```
  Org and team are immutable metadata tags on each stat record, not the storage hierarchy.
- Verified vs. self-reported is permanent metadata (`verified: boolean`, `source: "scorebook" | "manual"`) — cannot be changed after finalization.
- See `PLAYER_ENTITY_SCHEMA.md` for the full schema — required reading before implementing any Gate 7+ feature.

---

## Role and Permission Model

- **Role hierarchy:** superadmin → owner → manager → headcoach → assistantcoach → staff → parent (scorekeeper is per-game, not standing).
- **Role storage path:** `users/{uid}/roles/{orgId}`
- **13 permission flags** stored explicitly on every member doc at creation (computed from `defaultPermissions(role)` in `roles.js`):
  `scorebook, roster, schedule, members, documents, tasks, compliance, reports, messaging, financials, equipment, seasonConfig, orgSettings`
- `billing` is **never** a flag — always derived from `role === 'owner'`.
- Any flag can be toggled by owner or head coach without changing the member's primary role (`updateMemberPermissions()`).
- `updateMemberRole` resets permissions to new role defaults on role change.
- Firestore rules use `permissions.scorebook` for `data/db` writes; other flags are enforced as each feature ships.
- Legacy member docs (pre-Gate 5b) fall back to role-name check in `hasScorebookPerm` — **do not remove this fallback**.

---

## Component Responsibilities

- **`HistoryView`** — READ ONLY. Never writes to `db`. Queries and displays game history. Sub-views: Games, Players, Teams.
- **`ReportsView`** — export triggers only. Never writes to `db`. Calls `pdfExport.js` functions directly. Scope selector + time range filter.
- **`ManageView`** — WRITE ONLY. People segment (Orgs/Teams/Players CRUD, `RosterModal`) and Schedule segment (`TournamentModal`, `GameModal`). No exports, no read-only views.
- **`ScorebookView`** — manages its own live game state independently. Tells `App` to hide chrome via `onLiveChange`. Autosave runs inside this component via the `useAutosave` hook.
- **`LiveScorebook`** — the active scorekeeping surface. All stat events are dispatched here. Pre-derives `playerStats[]` from the full event log and publishes to the Firestore live doc — never the truncated 50-event slice.
- **`LiveGameView` / `LiveGameBanner`** — READ ONLY. Consumes `playerStats[]` from the live Firestore doc via `onSnapshot`. Never re-derives stats.
- **`InviteAcceptView`** — handles invite token resolution and role writing on accept. Sets pending org path via `setPendingOrgPath` before redirect.
- **`pdfExport.js`** — pure functions, no side effects. Called by `ReportsView` and other trigger points. Never imports from `storage.js`.

### Files / directories — do not touch

| File / Directory | Reason |
|---|---|
| `src/utils/stats.js` | Stable utility — no changes needed |
| `src/utils/dates.js` | Stable utility — no changes needed |
| `src/utils/pdfExport.js` | Export functions are final; only the trigger UI changes |
| `src/components/tracker/` | Individual tracker module — separate code path, do not modify |
| `src/components/tournament/` | Legacy view kept intact |

---

## Visual Style and Layout Rules

All components must use the theme from `src/utils/constants.js`. No new colors.

### Color tokens

| Token | Value | Use |
|---|---|---|
| `T.bg` | `#080810` | Page background |
| `T.card` | `rgba(255,255,255,0.045)` | Card background |
| `T.border` | `rgba(255,255,255,0.08)` | Card/divider border |
| `T.orange` | `#F97316` | Primary accent, CTAs, active state |
| `T.green` | `#22C55E` | Positive stats, success, wins |
| `T.blue` | `#3B82F6` | Informational |
| `T.red` | `#EF4444` | Errors, fouls, danger, losses |
| `T.purple` | `#A855F7` | Special accents |
| Text primary | `#ffffff` | Default body text |
| Text secondary | `#888888` | Subdued copy |
| Text muted | `#444444` | Disabled / hint |

### Typography

- Body font: `DM Sans`
- Numbers, scores, jersey numbers: `DM Mono`
- Section labels: `10px, weight 700, letter-spacing 0.08em, uppercase, color #555`

### Sizing & spacing

- Card border-radius: `12px`
- Button/input border-radius: `8–10px`
- Filter pill border-radius: `8px` (per `pillBtn` helper in `constants.js`)
- Filter pills (active/inactive pattern):
  - **Active:** orange tint background + orange border + orange text
  - **Inactive:** transparent + muted border + muted text

### Layout rules

- **No `position: fixed` in components.** `BottomNav` is the only exception (it is already built).
- **Modal pattern:** Use a faux viewport overlay — wrapper `div` with `minHeight`, `display: flex`, `alignItems: center`, `background: rgba(0,0,0,0.85)`, containing a sheet that uses normal flow layout with `maxHeight` + `overflowY: auto`.
- Mobile-first. The scorebook must work in landscape on a phone.
- No horizontal scroll anywhere except intentional overflow containers (e.g., stat tables).

### Navigation (5 tabs)

| Tab | View key | Component | Purpose |
|---|---|---|---|
| Track | `tracker` | `TrackerView` | Individual player stat entry (hidden for org-linked users) |
| Scorebook | `scorebook` | `ScorebookView` | Live team game scoring |
| History | `history` | `HistoryView` | Read-only game log (Games/Players/Teams) |
| Reports | `reports` | `ReportsView` | All PDF/JSON exports (Player/Team/Game scope) |
| Manage | `manage` | `ManageView` | People + Schedule CRUD only — no exports |

---

## Known Issues and Deferred Work

- **`storage.js` multi-org routing:** `rolesSnap.docs[0].id` is non-deterministic for users with multiple org memberships — fix before any multi-org user exists in production.
- **Coach data scope** (History/Reports filtered to assigned `teamId`) not yet enforced in UI — deferred to Gate 7+.
- **No owner notification badge** for `pending_conflict` roles — owner must navigate to Manage → Team → Members to see the conflict banner. Notification UI is Gate 8.
- **`users/{uid}/profile` collection** defined in schema (§2.7) — nothing writes to it yet. Gate 7.
- **Firebase Storage rules helpers** (`isOrgCoach`, etc.) not yet in `firestore.rules` — Future, Phase 3.
- **`loadDb` migration flag** (`hasRunMigration_v3`) writes to `localStorage` only — will re-run if user clears browser storage. Minor, acceptable.

---

## PWA and Service Worker

This app installs as a PWA. The service worker aggressively caches assets, which means:

- After significant code changes, the old service worker may serve a stale build even after restarting `npm run dev`.
- If the app behaves unexpectedly after a major update, instruct the user to unregister the service worker:
  `DevTools → Application → Service Workers → Unregister`, then hard refresh.
- Never assume a blank screen or stale UI is a code bug until the service worker has been cleared.

---

## Planning Document Registry

| Document | Status | Purpose |
|---|---|---|
| `MASTER_PLAN.md` | ✅ Canonical | Single source of truth — architecture, data model, feature specs, build phases |
| `IMPLEMENTATION_STATUS.md` | ✅ Current | Gate-by-gate completion status, known issues |
| `CLAUDE.md` | ✅ Current | This file — Claude Code working context |
| `firestore.rules` | ✅ Current | Deployed security rules |
| `PLAYER_ENTITY_SCHEMA.md` | ✅ Canonical | Player-primary sport-agnostic schema — required reading before Gate 7 |
| `GATE7_TASKING.md` | ✅ Ready | Gate 7 + 7.5 combined tasking document — player profiles, claim codes, app shell restructure |
| `SUB_ORG_ARCHITECTURE.md` | ✅ Active stub | Sub-org feature — Phase A schema prep in Gate 7.5, Phase B in Gate 9 |
| `DUAL_SCOREBOOK_GAME_OWNERSHIP_STUB.md` | ✅ Active stub | Dual scorebook planning — full session required before implementation |
| `DIVISION_ELIGIBILITY_STUB.md` | ✅ Active stub | Division & eligibility rules — planning session required before implementation |

> All prior planning documents (`ARCHITECTURE.md`, `PHASE2_ARCHITECTURE.md`, `COMMUNICATION_PLAN.md`, `PLANNING_SUMMARY.md`, `STATTRACKER_PRD.md`, `MONETIZATION_AND_FEATURES_PLAN.md`, `MASTER_PLAN_UPDATE_NAV_COMMS.md`, `local_store.md`) have been permanently deleted. Their content is fully consolidated into `MASTER_PLAN.md`. Do not reference these files.
