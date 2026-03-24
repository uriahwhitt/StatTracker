# StatTracker — Architecture & Design Document

**Phase B/C Implementation Guide — March 2026**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Decisions (Locked)](#2-architecture-decisions-locked)
3. [Data Model](#3-data-model)
4. [Navigation Structure](#4-navigation-structure)
5. [Manage Tab — UI Design](#5-manage-tab--ui-design)
6. [Scorebook UI Fixes](#6-scorebook-ui-fixes)
7. [History Tab](#7-history-tab)
8. [Reports Tab](#8-reports-tab)
9. [Firebase Phase 1.5 — Storage Migration](#9-firebase-phase-15--storage-migration)
10. [Implementation Order](#10-implementation-order)
11. [Future Expansion Notes](#11-future-expansion-notes)
12. [File Change Summary](#12-file-change-summary)

---

## 1. Project Overview

StatTracker is a mobile-first basketball stat tracking PWA built with React + Vite, deployed to `trackstat.netlify.app`. Designed initially for solo use by a single organization, with Phase 2 expanding to multi-user, multi-role, and multi-org support.

| | |
|---|---|
| **Stack** | React 18 + Vite, localStorage (Phase 1), Firebase Firestore (Phase 1.5) |
| **Deployment** | Netlify (trackstat.netlify.app), installable PWA on Android |
| **Phase complete** | Phase A — file restructure and component tree |
| **Next phases** | Phase B — Manage tab CRUD / Phase C — Scorebook MVP |
| **Primary user** | Solo developer / org admin tracking multiple teams |
| **Future vision** | Tournament organizer platform with multi-org support |

---

> ⚠️ **Phase 2 Notice**
> This document covers Phase 1 / Phase 1.5 architecture. Phase 2 extends and in some places supersedes it. Before implementing any auth, role, player profile, or sync logic, read `PHASE2_ARCHITECTURE.md` first. Where the two documents conflict, `PHASE2_ARCHITECTURE.md` is authoritative.
>
> Sections affected by Phase 2:
> - §2 locked decisions (Clock row, Player scope row)
> - §11.5 Role-Based Access Model (fully superseded)
> - §9 Firebase Phase 1.5 (extended — Phase 2 adds new top-level collections alongside the existing path)

---

## 2. Architecture Decisions (Locked)

The following decisions are final and must not be revisited during Phase B/C implementation.

| Decision | Detail |
|---|---|
| **Data model** | Event-sourced (event log, not running totals). Enables full undo, play-by-play, future clock sync. |
| **Storage Phase 1** | localStorage via `storage.js` (`loadDb` / `persist` interface). Fully abstracted — swap internals only. |
| **Storage Phase 1.5** | Firebase Firestore with offline persistence enabled. Single-file swap in `storage.js`. Anonymous auth for per-device namespacing. No login screen required. |
| **Sync strategy** | Firestore offline cache handles games-without-internet. Auto-syncs on reconnect. Replaces JSON export for device sync. |
| **Data hierarchy** | Organization → Team → Player (org-scoped). Jersey numbers live on team roster, overridable per game. |
| **No miss buttons** | Made-only stat entry. Corrections via undo / event log delete. |
| **Assist flow** | 2-second auto-dismiss after scoring event. |
| **Clock** | Deferred for Phase 1 MVP. Implemented in Phase 2 as a configurable countdown clock. See PHASE2_ARCHITECTURE.md §7. |
| **Autosave** | Continuous write to storage on every game state change (300ms debounce). |
| **Player scope** | Players are org-scoped within the local db schema. In Phase 2, players also exist as top-level Firestore entities independent of any org. See PHASE2_ARCHITECTURE.md §3. The local db shape is unchanged. |
| **Tournament scope** | Tournaments are global (not org-owned). Any team from any org can be linked. |
| **IDs** | All IDs are strings (UUID-style). Compatible with both localStorage keys and Firebase document IDs. No migration needed on Phase 1.5 upgrade. |

---

## 3. Data Model

All data lives in a single `db` object. The localStorage key is `bball_tracker_v2`. The Firestore equivalent will be a single document per anonymous user ID. The shape of `db` is identical in both storage backends.

### 3.1 Complete `db` Schema

```js
db = {
  tournaments:     Tournament[],
  organizations:   Organization[],
  players:         Player[],
  teams:           Team[],
  scheduledGames:  ScheduledGame[],   // NEW
  scorebookGames:  ScorebookGame[],
  games:           IndividualGame[],
}
```

#### `tournaments[]`
```js
{
  id:               string,
  name:             string,
  location:         string,
  startDate:        string,           // YYYY-MM-DD
  endDate:          string,           // YYYY-MM-DD
  notes:            string,
  createdByOrgId:   string | null,    // nullable now, becomes operator ID in multi-tenant future
}
```
> Global — not org-owned. `createdByOrgId` is nullable today.

#### `organizations[]`
```js
{
  id:   string,
  name: string,
}
```

#### `players[]`
```js
{
  id:        string,
  orgId:     string,    // NEW — org-scoped. Migration required for existing records.
  name:      string,    // editable
  createdAt: string,
}
```
> No jersey number here — lives on team roster entry.

#### `teams[]`
```js
{
  id:         string,
  orgId:      string,
  name:       string,
  roster:     [{ playerId: string, jerseyNumber: string }],
  tempRoster: [{ playerId: string, jerseyNumber: string }] | null,
}
```
> `tempRoster` is the last-used game lineup snapshot, overwritten each game.

#### `scheduledGames[]` — NEW
```js
{
  id:            string,
  orgId:         string,
  homeTeamId:    string,
  awayTeamId:    string | null,   // opponent team if also in system, else null
  opponent:      string,          // opponent display name (always present)
  gameDate:      string,          // YYYY-MM-DD
  location:      string,
  tournamentId:  string | null,
  status:        "scheduled" | "live" | "final",
  phase:         "pool" | "bracket" | null,
  bracketName:   string | null,   // free text: "Gold", "Silver", "Championship", etc.
  round:         string | null,   // free text: "Round 1", "Semifinal", "Final", etc.
}
```

#### `scorebookGames[]`
```js
{
  id:               string,
  scheduledGameId:  string | null,   // NEW — links to placeholder when loaded from schedule
  teamId:           string,
  orgId:            string,
  opponent:         string,
  gameDate:         string,
  tournamentId:     string | null,
  phase:            "pool" | "bracket" | null,   // NEW
  bracketName:      string | null,               // NEW
  round:            string | null,               // NEW
  roster:           [{ playerId, jerseyNumber, name }],  // point-in-time snapshot
  events:           Event[],
  format:           GameFormat,
  status:           "live" | "finalized",
  createdAt:        string,
  finalizedAt:      string | null,
  generatedGameIds: string[],
}
```

#### `games[]` — Individual Tracker
```js
{
  id:             string,
  playerId:       string,
  teamId:         string | null,    // NEW (nullable for backward compat)
  tournamentId:   string | null,
  gameDate:       string,
  opponent:       string,
  stats:          Stats,
  points:         number,
  source:         "manual" | "scorebook",
  scorebookGameId: string | null,
  phase:          "pool" | "bracket" | null,   // NEW
  bracketName:    string | null,               // NEW
  round:          string | null,               // NEW
}
```

---

### 3.2 `game.format` Schema

Stored on each `scorebookGame`. All new fields are backward-compatible — old fields are kept as deprecated fallbacks.

| Field | Default | Description |
|---|---|---|
| `periodType` | `"half"` | `"half"` \| `"quarter"` |
| `periods` | `2` | Auto-set from periodType: half=2, quarter=4 |
| `doubleBonusFoulLimit` | `10` | **NEW. Primary bonus threshold. Always present.** Triggers DBL BONUS badge (red) in header. |
| `singleBonusEnabled` | `false` | **NEW. Legacy toggle — off by default.** Only enable for leagues using one-and-one. |
| `singleBonusFoulLimit` | `null` | **NEW.** Only set when `singleBonusEnabled` is true. Triggers BONUS badge (orange). |
| `foulResetPeriod` | `"half"` | **NEW.** `"half"` \| `"quarter"`. Controls when team foul count resets to 0. |
| `foulsToDisqualify` | `5` | Player foul-out threshold. Existing field, now surfaced in GameSetup UI. |
| `timeoutsPerHalf` | `4` | **NEW.** Replaces `homeTimeouts`/`awayTimeouts`. Resets each half for both teams. |
| `homeTimeouts` | — | **Deprecated.** Replaced by `timeoutsPerHalf`. Keep for backward compat reads. |
| `awayTimeouts` | — | **Deprecated.** Replaced by `timeoutsPerHalf`. Keep for backward compat reads. |
| `bonusThreshold` | — | **Deprecated.** Replaced by `doubleBonusFoulLimit`. Keep for backward compat reads. |

---

### 3.3 Data Migration

Run once on first app load after update. Wrap in a `hasRunMigration_v3` localStorage flag.

- **`players[]`**: any player missing `orgId` gets assigned to the first organization's ID, or a newly created default org `{ id: "default_org", name: "My Organization" }` if no orgs exist.
- **`games[]`**: add `teamId: null`, `phase: null`, `bracketName: null`, `round: null` to any record missing these fields.
- **`scorebookGames[]`**: add `scheduledGameId: null`, `phase: null`, `bracketName: null`, `round: null`. Migrate `game.format`: if `bonusThreshold` exists and `doubleBonusFoulLimit` does not, set `doubleBonusFoulLimit = bonusThreshold`.
- **`storage.js`**: add `scheduledGames: []` to the `loadDb()` return shape.
- All existing data is preserved. Migration is purely additive.

---

## 4. Navigation Structure

5-tab bottom nav. Same count as current, different assignment.

| Tab | Was | Now |
|---|---|---|
| **Track** | Track | Unchanged. Individual player stat input. Personal tracker for parents. |
| **Scorebook** | Scorebook | Gains: load-from-scheduled-game flow, jersey override in GameSetup, updated format step. |
| **History** | Games | **READ-ONLY.** Game log grouped by tournament. Filterable by tournament/team/player. Summary stats bar updates with filter. Sub-views: Games / Players / Teams. |
| **Reports** | Reports | **ALL exports live here.** PDF and JSON exports removed from Manage tab. Scope selector: Player / Team / Game. Time range: Season / Tournament / Date range. |
| **Manage** | Manage | **WRITE-ONLY.** People segment (Orgs/Teams/Players CRUD) and Schedule segment (Tournaments/Games CRUD). No exports, no read views. |

---

## 5. Manage Tab — UI Design

### 5.1 People Segment

Top-level segment toggle: **People | Schedule**. People is the default.

- Organizations listed as compact cards (orange-tinted) showing name, team count, player count.
- Tap org card → expands inline to reveal its teams as sub-rows (no page navigation).
- Tap team row chevron → **RosterModal** slides up with full roster CRUD.
  - Roster modal: all players on that team with jersey number.
  - Each row: player name (editable inline), jersey number (editable inline), remove button.
  - Add player to roster from org pool via select dropdown.
- **All Players** section below orgs — filter pills: All / [team names] / Unassigned.
- Each player row: initials avatar (purple tint), name, team assignment or "Unassigned" badge (orange).
- **"+ Add player to org"** creates a player in the org pool without team assignment.
- Unassigned players are valid — they exist in the org pool until assigned to a roster.

### 5.2 Schedule Segment

- Tournaments listed as cards (teal-tinted): name, location, date range, status badge.
  - Status derived from dates: `endDate < today` → **Done**, `startDate <= today <= endDate` → **Active**, else **Upcoming**.
- Tap tournament card → expands inline showing its scheduled games.
- Each game row: status dot (grey=scheduled, green=final), date, opponent, phase badge (Pool=purple, bracket name+round=amber).
- Tap game row → **GameModal** for edit.
- **"+ Tournament"** button → TournamentModal.
- **"+ Scheduled Game"** → GameModal in create mode.
- **Exhibition / Unlinked** section: catch-all for games with no `tournamentId`.
  - Editing a Final game allows changing `tournamentId` — this enables retroactive tournament linking.

#### TournamentModal fields
`name` (required), `location`, `startDate`, `endDate`, `notes` (textarea)

#### GameModal fields
`team` (select), `opponent` (text), `date`, `tournament` (optional select), `phase` (None / Pool / Bracket toggle), `bracketName` (text, shown when phase=bracket), `round` (text, shown when phase=bracket), `status` (Scheduled / Live / Final)

> When editing an existing **finalized** scorebook game (retroactive linking): only show `tournamentId`, `phase`, `bracketName`, `round`, `status`. Do not allow changing team or opponent.

---

## 6. Scorebook UI Fixes

### 6.1 Pull-to-Refresh Prevention

- Add `overscroll-behavior: none` and `touch-action: pan-y` to `LiveScorebook` outer container div.
- Add `body { overscroll-behavior: none; }` to `public/index.html`.
- Verify `manifest.json` has `"display": "standalone"`.

### 6.2 Opponent Strip Redesign

The `OpponentStrip` is simplified to a **pure input bar**. All redundant stats removed since the header shows them.

- Extract `FB` (FlashButton) from `PlayerRow` into `src/components/common/FlashButton.jsx`.
- Buttons: `+2`, `+3`, `+1`, `Foul`, `Tech`, `T/O` — all use FlashButton.
- Each button shows floating popup on press: `+2` (green), `+3` (green), `+1` (green), `+PF` (amber), `+TF` (red), `T/O` (blue). Fades after 600ms.
- **Remove** opponent score display — already in GameHeader.
- **Remove** opp fouls / TO stats row — already in GameHeader stats row.
- Keep opponent name label above buttons.

### 6.3 GameHeader Stats Row

Four-column layout with subtle divider between home and opponent sides.

```
[ Home fouls ] [ Home TO left ] | [ Opp fouls ] [ Opp TO left ]
[ badge slot ]                  | [ badge slot ]
```

**Bonus badge logic** (badge appears in a reserved fixed-height slot — layout never shifts):

```js
if (fouls >= format.doubleBonusFoulLimit)
  → "DBL BONUS" badge (red), foul number turns red

else if (format.singleBonusEnabled && fouls >= format.singleBonusFoulLimit)
  → "BONUS" badge (orange)

else
  → empty badge slot (invisible placeholder, same height)
```

- Timeout column shows **remaining** timeouts (not used). Resets each half.
- Both foul and timeout counts are **period-aware** — filtered by current half group, not cumulative game total.

### 6.4 Period Selector

Replace advance-only period button with tappable inline selector.

- Period indicator in header: tappable pill showing current period (`H1`, `H2` / `Q1`–`Q4`).
- Tapping expands an **inline panel** below the score row within `GameHeader` (not a modal).
- Expanded panel shows all periods as pills:
  - `visited` — muted style (grey)
  - `current` — orange highlighted
  - `future` — dark/disabled
- Tap any period pill → fires `period_change` event, collapses selector.
- Tap period pill or outside → collapses without changing period.
- `period_change` event type added to `scorebookEngine.js`.
- `getCurrentPeriod` reads the latest `period_change` OR `period_start` event by timestamp.
- Navigating backward does **not** re-reset foul counts — counts are always derived from events filtered by period group.

### 6.5 Foul and Timeout Derivation Fix

Update `scorebookEngine.js`:

```js
// deriveTeamStats signature
deriveTeamStats(events, format, displayPeriod)

// foulGroup computation
const halfSize = Math.floor(format.periods / 2);
const foulGroup = format.foulResetPeriod === "quarter"
  ? displayPeriod
  : (displayPeriod <= halfSize ? 1 : 2);

// Count only fouls where event.period is in same foulGroup
```

```js
// deriveTimeouts signature
deriveTimeouts(events, format, displayPeriod)

// Same half-group logic
// homeRemaining = format.timeoutsPerHalf - count of timeout_home in current half group
// Backward compat: if timeoutsPerHalf undefined, fall back to format.homeTimeouts
// Backward compat: if doubleBonusFoulLimit undefined, fall back to format.bonusThreshold
```

### 6.6 Event Log Period Labels

`EventLogPanel` — display change only (no engine changes needed, `e.period` already correct).

- Show period label (`H1`/`H2` or `Q1`–`Q4`) prominently on every row.
- Left-aligned, fixed-width (~28px), monospace, orange (`T.orange`).
- Helps identify which half a foul belongs to — critical for after-game corrections.

### 6.7 GameSetup Format Step Updates

Step 2 — Game Format gains new fields, removes old `bonusThreshold`/`homeTimeouts`:

**Foul rules section:**

| Field | Control | Default | Notes |
|---|---|---|---|
| `doubleBonusFoulLimit` | Stepper (1–30) | `10` | Primary threshold. Always present. |
| `foulResetPeriod` | Toggle: Half \| Quarter | `"half"` | When team fouls reset to 0. |
| `singleBonusEnabled` | Toggle switch | `false` | Legacy leagues only. Off by default. |
| `singleBonusFoulLimit` | Stepper (1–30) | `7` | Only shown/active when `singleBonusEnabled` is true. Dimmed otherwise. |
| `foulsToDisqualify` | Stepper | `5` | Existing field, surfaced here. |

**Timeouts section:**

| Field | Control | Default | Notes |
|---|---|---|---|
| `timeoutsPerHalf` | Stepper (0–10) | `4` | Replaces `homeTimeouts`/`awayTimeouts`. |

> The `singleBonusFoulLimit` stepper row is visually dimmed (`opacity: 0.4`, non-interactive) when `singleBonusEnabled` is false.

---

## 7. History Tab

Read-only. Replaces the Games tab. Three sub-views: **Games / Players / Teams**.

### 7.1 Games Sub-view

- Filter pills: **All** | [tournament names] | **Exhibition** — dynamically from `db.tournaments`.
- Summary stat bar: Games count, Win-Loss record, PPG — all update reactively with filter.
- Games grouped by tournament. Exhibition / Unlinked at bottom.
- Each game card: status dot, date, opponent, phase badge, final score (green=win, red=loss).
- Tap game → read-only detail modal: box score, event log, phase/bracket info.
- Detail modal has **Export** button → navigates to Reports with that game pre-selected.

### 7.2 Players Sub-view

- Filter by team.
- Per player: name, team, GP, PPG, RPG, APG, FG%.
- Tap player → detail modal with game-by-game log.

### 7.3 Teams Sub-view

- One card per team: name, record, PPG, opp PPG.
- Tap team → detail with roster stats table.

---

## 8. Reports Tab

All PDF and JSON exports live here. Removed from Manage tab entirely.

- **Scope selector**: Player | Team | Game — drives what selectors appear below.
- **Time range filter**: Season | Tournament | Date range.
- Available exports by scope:
  - **Player**: Individual stat sheet PDF (recruiting-ready), JSON export.
  - **Team**: Team season report PDF, box score PDF, player profiles (all players) PDF, JSON export.
  - **Game**: Single game box score PDF.
- All existing `pdfExport.js` functions remain intact — only the trigger UI moves.

---

## 9. Firebase Phase 1.5 — Storage Migration

Replace localStorage with Firestore. **`storage.js` is the only file that changes.** All React components, hooks, and utilities remain identical.

### 9.1 Setup

```bash
npm install firebase
```

- Create a free Firebase project.
- Enable Firestore (Native mode).
- Enable Anonymous Authentication.
- Add Firebase config to `.env`:
  ```
  VITE_FIREBASE_API_KEY=
  VITE_FIREBASE_AUTH_DOMAIN=
  VITE_FIREBASE_PROJECT_ID=
  VITE_FIREBASE_APP_ID=
  ```
- Add `.env.example` documenting these variables.

### 9.2 `storage.js` Replacement

```
Firestore path: users/{uid}/data/db
```

- Sign in anonymously on init (`signInAnonymously`). Store `uid` in module scope.
- Enable offline persistence: `initializeFirestore(app, { localCache: persistentLocalCache() })`
- **`loadDb()`**: reads from Firestore with `getDoc`. On first load, if Firestore is empty but localStorage has data → write localStorage data to Firestore (one-time device migration).
- **`persist(db)`**: writes to Firestore with `setDoc` (full replace). Also writes to localStorage as offline cache.
- Function signatures are **identical** to current `storage.js`. No other files change.

### 9.3 Multi-device Sync

- Same anonymous UID is tied to the browser/device. Different devices = different UIDs by default.
- **Transfer code flow** (replaces JSON export for device sync):
  - Device A: generate a short 6-character code that maps to the UID (store in a `transferCodes/{code}` Firestore collection, TTL 10 minutes).
  - Device B: enter code → reads the UID from `transferCodes/{code}` → adopts that UID → Firestore data syncs automatically.
- Keep JSON export in Reports tab as a backup — do not remove.

---

## 10. Implementation Order

Work through these items sequentially. Complete and verify each before starting the next.

| # | Task | Detail |
|---|---|---|
| **1** | Scorebook fixes | Pull-to-refresh, FlashButton extraction, OpponentStrip redesign, period selector, foul/timeout derivation, event log period labels. Fixes all issues from live game test. |
| **2** | GameSetup format step | New foul/timeout/reset fields in Step 2. Stores to `game.format` as documented in §3.2. |
| **3** | Data migration | One-time migration on load. Additive only. Create default org if needed. |
| **4** | Firebase Phase 1.5 | Replace `storage.js`. Anonymous auth, offline persistence, transfer code for device sync. **Do not implement until items 1–3 are confirmed working.** |
| **5** | Manage tab shell | People \| Schedule segment toggle. Shell with placeholder sections. |
| **6** | People — Orgs + Players | Org CRUD, player pool CRUD, All Players list with team filter, Unassigned badge. |
| **7** | People — Team Roster modal | Team CRUD, RosterModal with player add/remove/jersey edit. Jersey override per game in GameSetup. |
| **8** | Schedule — Tournament CRUD | Create/edit/delete tournaments. **Restores the lost tournament creation feature immediately.** |
| **9** | Schedule — Scheduled Games CRUD | Create/edit games with phase/bracket fields. Edit existing scorebook games to backfill `tournamentId`. |
| **10** | GameSetup loads from schedule | Pre-load opponent/date/tournament from `scheduledGame`. Mark `scheduledGame.status = "live"` on start, `"final"` on finalize. |
| **11** | Navigation restructure | Rename Games → History tab. Move PDF exports from Manage to Reports. Build History sub-views. |
| **12** | Reports tab | Scope selector, time range filter, all export functions wired to new UI. |

---

## 11. Future Expansion Notes

### 11.1 Multi-org / Tournament Organizer Mode

- `tournament.createdByOrgId` is already nullable. When a tournament operator creates an event, their `orgId` populates this field — it becomes the permission boundary.
- **Roles** (admin, coach, score table, parent) are deferred. This is a Firebase Auth + Firestore security rules problem, not a schema problem. Do not model in localStorage phase.
- `scheduledGame` has `homeTeamId` and `awayTeamId`. Tournament operators will set both when building brackets.

### 11.2 Official Score Table Mode

- `scorebookGame` currently tracks one team's stats. Official mode requires both teams.
- Schema change when needed: add `awayTeamId` and `awayRoster[]` to `scorebookGame`. `OpponentStrip` becomes a full `PlayerRow` set for the away team.
- The current `OpponentStrip` counter architecture does not block this.

### 11.3 Parent / Individual Tracker

- Track tab remains as the parent-facing tool. Known use case: parent tracking 3 sons simultaneously.
- Individual tracker may diverge from scorebook workflow as scorebook matures. Keep as separate code paths.

### 11.4 Recruiting Profile Reports

- `pdfExport.js` player profile export is the foundation.
- Future: game-by-game trend charts, tournament-only stat filters, comparison to team averages.
- The `phase` and `bracketName` fields on individual games enable tournament-only stat isolation today.

### 11.5 Role-Based Access Model — SUPERSEDED

The role model defined here has been superseded by PHASE2_ARCHITECTURE.md §1. The authoritative role definitions, storage paths, and permission table are in that document.

The role values defined here (admin, coach, parent, scoretable) are replaced by: owner, headcoach, assistantcoach, parent, scorekeeper. Do not implement the old role values.

The statement that "transfer codes go away entirely when OAuth is live" is also superseded. Transfer codes are permanent. See PHASE2_ARCHITECTURE.md §2.1.

---

## 12. File Change Summary

| File | Action | Changes |
|---|---|---|
| `src/utils/storage.js` | MODIFY (Phase 1.5) | Replace localStorage internals with Firestore. Keep `loadDb`/`persist` interface identical. Add `scheduledGames: []` to default shape now. |
| `src/utils/scorebookEngine.js` | MODIFY | `deriveTeamStats` and `deriveTimeouts` accept `displayPeriod` param. Add period-group filtering. Add `period_change` event type. Update `getCurrentPeriod`. |
| `src/utils/constants.js` | MODIFY | Add `game.format` field defaults. |
| `src/components/common/FlashButton.jsx` | CREATE | Extracted `FB` component from `PlayerRow`. Reusable flash button with popup label. |
| `src/components/scorebook/OpponentStrip.jsx` | MODIFY | Use `FlashButton`. Remove score display. Remove stats row. |
| `src/components/scorebook/GameHeader.jsx` | MODIFY | Inline period selector (expand/collapse). 4-column stats row with bonus badge logic. |
| `src/components/scorebook/LiveScorebook.jsx` | MODIFY | Add `overscroll-behavior: none`. Pass `currentPeriod` to derive functions. Replace `advancePeriod` with `setPeriod(n)`. |
| `src/components/scorebook/EventLogPanel.jsx` | MODIFY | Show period label prominently on every row. |
| `src/components/scorebook/GameSetup.jsx` | MODIFY | Step 2: new foul/timeout/reset fields. Replace old `bonusThreshold`/`homeTimeouts` fields. |
| `src/components/manage/ManageView.jsx` | REWRITE | People \| Schedule segment toggle. Delegates to `PeopleView` and `ScheduleView`. |
| `src/components/manage/PeopleView.jsx` | CREATE | Org list, inline team expand, All Players list with filter. |
| `src/components/manage/ScheduleView.jsx` | CREATE | Tournament cards with inline game list. Full CRUD. |
| `src/components/manage/RosterModal.jsx` | CREATE | Modal sheet for team roster CRUD. |
| `src/components/manage/TournamentModal.jsx` | CREATE | Create/edit tournament modal. |
| `src/components/manage/GameModal.jsx` | CREATE | Create/edit scheduled game with phase/bracket fields. |
| `src/components/history/HistoryView.jsx` | REWRITE | Games/Players/Teams sub-views, tournament filter pills, summary bar. |
| `src/components/reports/ReportsView.jsx` | MODIFY | Add scope selector. Wire all `pdfExport` functions here. |
| `src/components/layout/BottomNav.jsx` | MODIFY | Rename Games tab to History. |
| `public/index.html` | MODIFY | Add `overscroll-behavior: none` to body. |
| `public/manifest.json` | VERIFY | Confirm `"display": "standalone"`. |
| `src/App.jsx` | MODIFY | Add migration function. Add `scheduledGames` to db shape. |

### Files — Do Not Touch

| File | Reason |
|---|---|
| `src/utils/stats.js` | No changes needed |
| `src/utils/dates.js` | No changes needed |
| `src/utils/pdfExport.js` | Functions stay, only trigger UI moves to Reports tab |
| `src/components/tracker/` | Entire directory unchanged |
| `src/components/tournament/` | Renamed to History later, not in this pass |

---

## Visual Style Reference

All new components must match the existing dark theme from `constants.js`.

```js
// Colors
T.bg      = "#0a0a0f"                    // page background
T.card    = "rgba(255,255,255,0.04)"     // card background
T.border  = "rgba(255,255,255,0.08)"     // card border
T.orange  = "#f97316"                    // primary accent, CTAs, jersey numbers
T.green   = "#22c55e"                    // positive stats, success
T.blue    = "#3b82f6"                    // informational
T.red     = "#ef4444"                    // errors, fouls, danger
// Text
// primary: #ffffff  secondary: #888888  muted: #444444
// Border radius: 12px cards, 8–10px buttons/inputs, 20px pills
// Fonts: DM Sans (body), DM Mono (numbers, scores, jersey numbers)
// Section labels: 10px, weight 700, letter-spacing 0.08em, uppercase, color #555
```

> **Modal pattern**: Do not use `position: fixed`. Use a faux viewport: wrapper div with `minHeight`, `flex`, `alignItems: center`, `background: rgba(0,0,0,0.85)` to simulate overlay while contributing layout height.
