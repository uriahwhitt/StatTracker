# StatTracker Pro — Product Requirements Document
**Version:** 1.1 — Refined after Q&A Session
**Date:** March 16, 2026
**Status:** Approved — Ready for Development (Phase A: File Restructure)  
**Platform:** PWA (React) — Android/iOS/Desktop  
**Backend:** Firebase (Auth + Firestore) — Phase 2  
**Beta Tester:** Parent volunteer tracking 3 players simultaneously  

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [User Personas](#3-user-personas)
4. [System Architecture](#4-system-architecture)
5. [Scorebook Module — Detailed Requirements](#5-scorebook-module--detailed-requirements)
6. [Statistics Reference](#6-statistics-reference)
7. [Undo System](#7-undo-system)
8. [Future Roadmap](#8-future-roadmap)
9. [Beta Test Plan](#9-beta-test-plan)
10. [Open Questions — RESOLVED](#10-open-questions--resolved)
11. [Refined Specification — Q&A Session](#11-refined-specification--qa-session-2026-03-16)
12. [Appendix A — Event Type Reference](#appendix-a--event-type-reference)

---

## 1. Executive Summary

StatTracker Pro is a mobile-first Progressive Web App (PWA) designed to modernize basketball scorekeeping and individual player stat tracking for youth and amateur leagues. The application replaces paper scorebooks with a faster, more accurate, and analytically rich digital alternative — purpose-built for the sideline environment.

The app has two primary modules sharing a common data layer:

- **Individual Stat Tracker** — currently built and deployed at `trackstat.netlify.app`. Tracks per-player stats for a single player across games and tournaments with historical reporting. Multi-player support added in recent Claude Code development session.
- **Scorebook Module** *(this document)* — a new module enabling real-time game scorekeeping for all players on the floor simultaneously, designed for tablet use in landscape orientation.

The initial beta test will be conducted by a single parent tracking three players (all on the same team) during live games. This real-world constraint directly shapes UI design priorities: the interface must allow rapid switching between players, display all five on-court players simultaneously, and require no more than **two taps per stat entry event**.

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. Replace paper scorebooks with a tablet-optimized digital equivalent that is **faster, not slower**, than pencil-and-paper.
2. Track all statistics that would appear in an official NFHS/FIBA youth basketball scorebook.
3. Support one or two scorekeepers operating simultaneously on the same game record.
4. Make substitution management fast — full lineup swaps in under 5 seconds.
5. Surface game-influencing stats (personal fouls, team fouls, score, timeouts) at all times without any navigation.
6. Generate post-game box scores, season summaries, and tournament reports automatically from live-entered data.
7. Allow parents/spectators to view a live read-only feed of the game score and stats from their own phones.
8. Design the architecture to support a future **camera-assisted clock sync** feature without requiring a rebuild.

### 2.2 Non-Goals (this version)

- Camera integration or automatic clock synchronization *(planned, architecture-ready, not built)*
- Opponent player-level stat tracking *(opponent team score, fouls, and timeouts only)*
- Referee or official game certification *(not an official league scorebook replacement)*
- Play diagram or video clip attachment
- Shot chart / court location tracking
- Multi-team or league management portal

---

## 3. User Personas

| Persona | Device | Primary Use | Key Need |
|---|---|---|---|
| **Scorekeeper** (Primary) | Tablet — Landscape | Live stat entry during game | 2-tap max per event, always-visible fouls/score |
| **Clock Keeper** (Secondary) | Same tablet or second phone | Manage quarter clock, timeouts, subs | Quick timeout/sub UI, opponent score entry |
| **Parent / Spectator** | Phone — Portrait | Read-only live score + stats | Simple live view, no account required |
| **Coach** | Phone or tablet | Post-game review, player trends | Box score, shooting %, foul summary |
| **Beta Tester** | Tablet | Track 3 specific players simultaneously | Fast switching between her 3 sons on court |

---

## 4. System Architecture

### 4.1 Module Overview

The application is structured as three co-existing modules within the same React PWA:

| Module | Description | Status |
|---|---|---|
| **Individual Tracker** | Per-player stat entry. Games saved by date/time, tagged to tournaments. Historical reporting. | ✅ Built |
| **Scorebook** | Full-game live scorekeeping for all players. Real-time box score, substitutions, clock management. | 🔲 This Document |
| **Spectator View** | Read-only live score and stats feed for parents/fans via shared URL. | 🔲 Phase 2 (Firebase) |

### 4.2 Data Architecture — Event Log Model

The scorebook module uses an **event-sourced data model**. Rather than storing running totals, every game action is recorded as a discrete timestamped event. All statistics are derived by replaying the event log.

**Why this matters:**
- **Full undo capability** — remove any event, stats recalculate instantly
- **Play-by-play feed** — event log rendered in reverse chronological order
- **Future clock sync** — event timestamps can be retroactively corrected when camera sync is implemented
- **Any stat report** is computable from the same raw data

**Core event schema:**

```json
{
  "id":          "evt_1748293847",
  "gameId":      "game_20250612_varsity",
  "timestamp":   "2025-06-12T19:24:07Z",
  "gameTime":    "14:32",
  "quarter":     2,
  "type":        "2pt_made",
  "playerId":    "player_11",
  "assistId":    "player_5",
  "teamId":      "home",
  "clockSynced": false
}
```

> **`clockSynced`** — always stored as `false` until camera sync is implemented. When camera sync is active (Phase 3), this is set to `true` and `gameTime` is overwritten with the verified scoreboard clock value. **No schema changes required when camera sync is added.**

### 4.3 Storage Strategy

| Phase | Storage | Notes |
|---|---|---|
| **Phase 1 (Current)** | `localStorage` — JSON event log per game | No backend. Data local to device. Export/import via JSON for backup. |
| **Phase 2 (Firebase)** | Firestore — real-time sync | Enables live spectator view, multi-device scorekeeping, cloud backup, user accounts. |
| **Phase 3 (Camera Sync)** | No storage changes needed | `clockSynced` flag and `gameTime` field already present on every event from day one. |

### 4.4 Existing Codebase Context

The Individual Tracker module is already built with:
- React PWA, deployed to `trackstat.netlify.app`
- `localStorage` with structured JSON
- Multi-player support added in recent development
- Tournament tracking and per-game reporting
- Installable to Android home screen (service worker + manifest)

The Scorebook module should be added as a new route/view within the same app, sharing the existing data layer, component library, color system, and navigation structure.

---

## 5. Scorebook Module — Detailed Requirements

### 5.1 Pre-Game Setup

Before the scorebook screen launches, the user completes a quick setup flow:

1. **Game details:** date (auto-filled), opponent team name, location (optional), tournament association (optional — links to existing tournament records from the Individual Tracker).
2. **Game format:** number of periods (2 halves or 4 quarters), period length in minutes (configurable: 6, 8, 10, 12 min), overtime duration, fouls-per-disqualification (default: 5).
3. **Home team roster:** jersey number + name per player. Min 5, max 15. Roster persists across games — pre-populated from last game, editable.
4. **Starting lineup:** tap 5 players from roster. These populate the on-court view.
5. **Opponent name:** confirmed here. No opponent roster entry required.

> **Target time:** Returning team setup < 60 seconds. First-time setup < 3 minutes.

### 5.2 Scorebook Screen Layout — Landscape Tablet

The scorebook screen is designed **exclusively for landscape tablet orientation**. The layout is **fixed and does not scroll**. Everything critical is visible simultaneously with no navigation.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ZONE A — GAME HEADER (always visible, pinned top)                       │
│  Q2  14:32  ▶   HOME 38 — 31 AWAY   TOs: ●●○   Team Fouls: 7   UNDO   │
├─────────────────────────────────────────────────────────────────────────┤
│ ZONE B — PLAYER ROWS × 5 (one row per on-court player)                  │
│  [SUB] #11 Smith   2F  14pts │ 2PT  3PT  FT+  FT- │ OR  DR  AST  STL  BLK  TOV  PF │
│  [SUB] #23 Jones   1F   8pts │ 2PT  3PT  FT+  FT- │ OR  DR  AST  STL  BLK  TOV  PF │
│  [SUB] #4  Davis   0F   4pts │ 2PT  3PT  FT+  FT- │ OR  DR  AST  STL  BLK  TOV  PF │
│  [SUB] #8  Wilson  3F   2pts │ 2PT  3PT  FT+  FT- │ OR  DR  AST  STL  BLK  TOV  PF │
│  [SUB] #5  Brown   0F   6pts │ 2PT  3PT  FT+  FT- │ OR  DR  AST  STL  BLK  TOV  PF │
├─────────────────────────────────────────────────────────────────────────┤
│ ZONE C — OPPONENT STRIP (always visible, pinned bottom)                 │
│  OPPONENT  31pts   +1  +2  +3   FOUL   TOs: ●●○   Team Fouls: 8        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

#### Zone A — Game Header Bar

Pinned to the top. Contains all game-state information a scorekeeper needs at a glance:

- Current quarter/period and game clock (manual countdown timer with start ▶ / stop ■ )
- Home score and away score — large, high-contrast numerals
- Home timeouts remaining — filled/empty dot indicators (e.g. `●●○` = 1 remaining of 3)
- Home team total fouls — amber at bonus threshold, red at double-bonus
- **FULL SUB** button — triggers full lineup replacement modal
- **UNDO LAST** button — always visible, always accessible (see Section 7)
- Quarter advance — tap to close current period and start next

---

#### Zone B — Player Rows

Five full-width rows, one per on-court player. Each row has two logical sections:

**Left anchor (always visible):**
- `SUB` button
- Jersey number + player name
- Personal foul count — color coded: white (0–2), amber (3–4), red (5 = foul out)
- Current points this game

**Stat buttons — Row 1 (Scoring, orange):**
`2PT Made` `3PT Made` `FT Made` `FT Miss`

- `2PT Made` and `3PT Made` auto-increment the corresponding attempt count
- `FT Miss` increments FTA only (no made)
- `2PT Miss` / `3PT Miss` are available via long-press or a secondary tap on the made button (TBD — see Open Questions)

**Stat buttons — Row 2 (Secondary, green/red):**
`Off Reb` `Def Reb` `Assist` `Steal` `Block` `Turnover` `Foul`

- Every button is a single tap — no confirmation, no modal, no delay
- All buttons minimum **44×44pt** touch target
- Tapping player name/number opens full individual stat line in a slide-up panel

> **Design rule:** Zero horizontal scrolling on a standard 10-inch tablet in landscape. All 11 stat buttons must fit within a single player row without overflow.

---

#### Zone C — Opponent Strip

A slim single row pinned to the bottom:

- Opponent team name + running score
- Quick score buttons: `+1` (free throw), `+2` (field goal), `+3` (three pointer)
- Opponent foul button — increments opponent team fouls
- Opponent timeouts remaining indicator

No opponent player-level tracking. Intentionally minimal to maximize Zone B real estate.

---

### 5.3 Substitution Flow

#### Single Substitution
1. Tap `SUB` on the departing player's row
2. Bench roster modal slides up — players not on court shown as large jersey number buttons
3. Tap the incoming player
4. Row updates immediately. Sub event logged with current game clock time.

**Target: 2 taps, under 3 seconds.**

#### Full Lineup Substitution (Mass Sub)
1. Tap `FULL SUB` in the header
2. Full-screen modal shows entire roster as large jersey number tiles
3. Tap exactly 5 players — selected tiles highlight orange
4. Tap `CONFIRM` — all 5 on-court players replaced simultaneously. Five sub events logged.

**Target: under 8 seconds.**

> **Beta test focus:** The substitution flow is a primary feedback area. Three of the five on-court players will often be the beta tester's sons. Fast visual identification is critical — consider highlighting "watched players" in a distinct color.

---

### 5.4 Clock Management

The app includes a **manual game clock**. It is intentionally not connected to the gymnasium scoreboard — this is a known limitation with a planned solution (see Section 8.2).

- Countdown timer from configurable period length
- Large start/stop button in header — tap to toggle
- Quarter advance is manual — scorekeeper taps when buzzer sounds
- Every event records the current app clock time in `gameTime`
- Overtime periods: configurable at setup or added dynamically mid-game
- Half-time reset: app prompts to reset team fouls at half when applicable

> **Known limitation:** Manual clock drift is expected. The app clock and the gymnasium scoreboard clock will diverge over time due to referee stoppages and human reaction delay. Camera sync (Phase 3) resolves this. Until then, `clockSynced: false` on all events.

---

### 5.5 Timeout Management

- Home timeouts displayed as dot indicators in header (`●` = available, `○` = used)
- Tap a dot to mark used; tap again to restore if incorrectly marked
- Default allocation configurable at game setup (NFHS default: 3 full + 2 thirty-second)
- Opponent timeouts tracked in Zone C strip
- Timeout events logged with quarter and clock time

---

### 5.6 End of Game

When the final buzzer is tapped:

1. App presents final box score for review
2. Scorekeeper can make any final corrections via the event log
3. Game is saved to the existing data store with the same schema as Individual Tracker games
4. Box score is available in the Games history tab immediately
5. If the game was tagged to a tournament, tournament totals update automatically

---

## 6. Statistics Reference

### 6.1 Player-Level Statistics (Home Team)

| Stat | Abbr | Entry | Derived From | Notes |
|---|---|---|---|---|
| 2-Point FG Made | FGM2 | Button tap | Direct | Auto-increments FGA2 |
| 2-Point FG Attempted | FGA2 | Button tap | Direct | Miss-only tap |
| 3-Point FG Made | 3PM | Button tap | Direct | Auto-increments 3PA |
| 3-Point FG Attempted | 3PA | Button tap | Direct | Miss-only tap |
| Free Throw Made | FTM | Button tap | Direct | Auto-increments FTA |
| Free Throw Attempted | FTA | Button tap | Direct | Miss-only tap |
| Total Points | PTS | Calculated | `2×FGM2 + 3×3PM + FTM` | Always current |
| Field Goal % | FG% | Calculated | `(FGM2+3PM) / (FGA2+3PA)` | Player detail panel |
| 3-Point % | 3P% | Calculated | `3PM / 3PA` | Player detail panel |
| Free Throw % | FT% | Calculated | `FTM / FTA` | Player detail panel |
| Offensive Rebound | OREB | Button tap | Direct | |
| Defensive Rebound | DREB | Button tap | Direct | |
| Total Rebounds | REB | Calculated | `OREB + DREB` | |
| Assist | AST | Button tap | Direct | |
| Steal | STL | Button tap | Direct | |
| Block | BLK | Button tap | Direct | |
| Turnover | TOV | Button tap | Direct | |
| Personal Foul | PF | Button tap | Direct | Color-coded at 3, foul-out at 5 |
| Technical Foul | TF | Button tap | Direct | Overflow menu — rare |
| Minutes Played | MIN | Calculated | Time on court per sub log | Phase 2 — requires reliable clock |
| Plus / Minus | +/- | Calculated | Score delta while on court | Phase 2 |

---

### 6.2 Team-Level Statistics (Home Team)

| Stat | Description | Display Location |
|---|---|---|
| Team Score | Running total of all player points | Header — always visible |
| Team Fouls | Total personal fouls this half/quarter | Header — always visible, color-coded at bonus |
| Timeouts Remaining | Unused timeouts | Header — dot indicators |
| Score by Quarter | Points per quarter/half | Post-game summary |
| Team FG% | Aggregate field goal percentage | Post-game summary |
| Team Rebounds | Sum of all player rebounds | Post-game summary |
| Team Assists | Sum of all player assists | Post-game summary |
| Team Turnovers | Sum of all player turnovers | Post-game summary |

---

### 6.3 Opponent Statistics

Intentionally minimal — team level only, no player roster:

| Stat | Entry |
|---|---|
| Team Score | `+1` / `+2` / `+3` buttons in Zone C |
| Team Fouls | Foul button in Zone C |
| Timeouts Used | Timeout dots in Zone C |
| Score by Quarter | Derived from score events per quarter |

---

### 6.4 Foul Thresholds & Bonus Rules

Configurable at game setup. **Defaults follow NFHS high school rules.**

| Rule | NFHS (Default) | NBA | FIBA | NCAA |
|---|---|---|---|---|
| Fouls to disqualify | 5 | 6 | 5 | 5 |
| Team fouls → bonus (1-and-1) | 7 per half | N/A | N/A | 7 per half |
| Team fouls → double bonus | 10 per half | N/A | N/A | 10 per half |
| Team fouls → automatic 2 FTs | N/A | 5 per quarter | 4 per quarter | N/A |
| Quarter length | 8 min | 12 min | 10 min | 20 min halves |

The app displays a visual bonus indicator in the header when the threshold is crossed. The active rule set is configurable per game.

---

## 7. Undo System

The undo system is one of the most important UX features. In a live game, misclicks happen constantly. The mechanism must be **instantaneous and always accessible**.

### Requirements

- Persistent `UNDO LAST` button in Zone A header — visible at all times, no navigation required
- Tapping UNDO removes the most recent event from the event log — all stats recalculate instantly
- **No confirmation dialog** — speed is the priority
- Brief toast notification confirms the undo: *"Undid: #11 — 2PT Made"*
- Undo history depth: minimum last 10 events, ideally unlimited within a game session
- **Event Log panel** — accessible via a secondary button or swipe, shows the full chronological event list with individual delete capability for correcting errors beyond the most recent
- Deleted events are **soft-deleted** (flagged, not removed) to preserve audit trail and support future review

---

## 8. Future Roadmap

### 8.1 Phase 2 — Firebase Backend

- User authentication via **Google Sign-In** (Google Workspace compatible — single account ties to existing business)
- Firestore database replaces `localStorage` — all game data cloud-persisted, backed up automatically
- **Real-time spectator view:** parents open `stats.whittsend.org` and see a live read-only score + box score updating in real time (Firestore real-time listeners)
- **Multi-device scorekeeping:** two tablets can operate on the same game simultaneously
- Season and tournament data synced across all devices
- Export to PDF box score — shareable post-game
- All existing `localStorage` data migrated to Firestore on first login

### 8.2 Phase 3 — Camera-Assisted Clock Synchronization

> This is a planned architectural feature, not yet built. The data model is designed from day one to support it with no schema changes.

**Concept:** A device camera (phone or tablet mounted courtside) is aimed at the gymnasium scoreboard. A computer vision process reads the scoreboard clock in real time and returns the verified game time. This is the same approach used by professional broadcast companies to sync on-air graphics with live game clocks.

**How it integrates with the existing data model:**

- Every event already stores `gameTime` (app clock) and `clockSynced: false`
- When camera sync is active, `gameTime` is overwritten with the camera-verified value and `clockSynced` is set to `true`
- When camera sync is unavailable, `gameTime` falls back to the manual app clock — behavior is identical to Phase 1
- **No database migrations, no breaking changes**

**Implementation considerations (future):**
- Camera feed processed locally on-device or via a lightweight cloud function
- OCR / computer vision reads the scoreboard clock digits
- Sync runs as a background process — does not block stat entry
- Configurable tolerance threshold for clock correction (e.g., only correct if drift > 5 seconds)

### 8.3 Phase 4 — Play Store & Public Release

- TWA (Trusted Web Activity) wrapper via Google Bubblewrap for Play Store submission
- Player name field + multi-player household support for broader adoption
- Optional coach portal — view all players on a team from a single account
- Tournament bracket integration — link games to a tournament draw
- Export to MaxPreps or similar stat aggregators (research required)

---

## 9. Beta Test Plan

### 9.1 Beta Tester Profile

| Field | Detail |
|---|---|
| Tester | Parent volunteer, non-developer |
| Players tracked | 3 sons on the same team — often on court simultaneously |
| Device | Tablet (landscape) + personal phone (portrait for verification) |
| Experience | Familiar with paper scorebook; no app scorekeeping experience |
| Goal | Track per-player stats for all 3 sons through a complete game |

### 9.2 Success Criteria

1. Tester completes game setup (roster + starting lineup) in under 3 minutes
2. Tester can locate and tap any of her 3 sons' stat buttons within 2 seconds mid-play
3. Single substitution executed in under 5 seconds without losing focus on the game
4. Fewer than 5 undo corrections per game *(measure of UI clarity and button accuracy)*
5. Post-game box score for all 3 players matches the tester's paper backup
6. Tester rates the experience as "faster or equivalent to paper" after 2 games

### 9.3 Feedback Collection

- Post-game debrief — 10 minutes, structured around the success criteria above
- Error log — every undo, every moment of hesitation, every missed tap noted
- Wish list — anything she wanted the app to do that it didn't
- Comparison against paper backup or official scorebook if available from the table

### 9.4 Suggested Beta Test Sequence

| Session | Goal |
|---|---|
| Session 1 | Setup only — build roster, practice substitution flow, no live game |
| Session 2 | First live game — observer mode, tester tracks on paper simultaneously |
| Session 3 | First solo digital game — paper as backup only |
| Session 4+ | Full adoption — no paper, app as primary record |

---

## 10. Open Questions — RESOLVED

All high and medium priority questions were resolved in the Q&A session on 2026-03-16.

| # | Question | Resolution |
|---|---|---|
| 1 | **Age/grade level?** | High School & AAU. Game format configurable (quarters OR halves, variable period length). |
| 2 | **Landscape lock?** | No hard lock. Design for landscape tablet/phone, but allow portrait fallback. |
| 3 | **Running score strip?** | Deferred. Numeric display sufficient for MVP. |
| 4 | **Minutes played?** | Deferred to Phase 3 (requires reliable clock). MVP tracks activation status only. |
| 5 | **Jersey number conflicts?** | Allowed — players can have temp jersey numbers per game. Warn but don't block. |
| 6 | **Technical fouls?** | Overflow menu — too rare for a primary button. |
| 7 | **Charge/block differentiation?** | Single turnover button sufficient for now. |
| 8 | **Beta test tablet?** | No specific tablet yet. Design for 2 rows of buttons per player with vertical scroll. Must work on phone in landscape for initial testing. |
| 9 | **Highlight watched players?** | Deferred — not needed for MVP since beta tester tracks full team. |
| 10 | **Miss button UX?** | No miss buttons. Single "+" per shot type (made only). Corrections via UNDO LAST or event log panel. |

---

## 11. Refined Specification — Q&A Session (2026-03-16)

This section captures all decisions made during the collaborative refinement session. These supersede any conflicting details in earlier sections.

### 11.1 Data Hierarchy

```
Organization (e.g., "EC All-Stars")
  └── Team (e.g., "10th Grade Boys", "16U Select")
        └── Player (e.g., "Marcus Johnson")
              └── Jersey Number (permanent per team, temp override per game)
```

- A player can belong to multiple teams (even across organizations)
- Jersey numbers are assigned per team (a player may be #11 on one team, #4 on another)
- Temporary jersey number overrides are available per game (roster conflicts when playing up/down)
- Player stats are tied to games and teams — queryable by full career history OR filtered by team

### 11.2 Roster Management

**Permanent Rosters:**
- Stored per team in the database
- Managed in the Manage tab (Organization → Team → Players CRUD)

**Temporary (Game) Rosters:**
- When starting a scorebook game, select a team → permanent roster loads
- "Edit Roster" allows add/drop for this game without changing the permanent roster
- A secondary "last used" roster is stored per team — selectable for tournament weekends where the same adjusted roster is used across multiple games

### 11.3 Pre-Game Setup Flow

1. Tap "New Game" (from Scorebook tab or Games tab)
2. Select Organization
3. Select Team → loads permanent roster (or last-used roster option)
4. Optional: "Edit Roster" → add/drop players, adjust jersey numbers for this game
5. Select game format: quarters vs halves, period length
6. Enter opponent name
7. Tag to tournament (encouraged — helps organization)
8. Date (auto-filled today, editable)
9. Select starting 5 from the game roster
10. Launch → Scorebook screen

**Pre-creation:** Games can be created ahead of time with rosters preloaded, then launched into the live scorebook when the game starts. This reduces admin time at tip-off.

### 11.4 Scorebook Screen Layout

**Header (always visible):**
- Period indicator (Q1/Q2/H1/H2) with advance button
- Home score — Away score (large, high-contrast)
- Team fouls indicator (color-coded at bonus thresholds)
- Timeouts remaining (dot indicators)
- UNDO LAST button
- GROUP SUB button

**Active Player Rows (5 rows, vertical scroll if needed):**

Each player row contains:
- Left anchor: `[SUB]` button | Jersey # | Player Name | Personal Fouls (color-coded) | Points
- Row 1 (Scoring — orange): `2PT` `3PT` `FT`
- Row 2 (Secondary): `OREB` `DREB` `AST` `STL` `BLK` `TOV` `FOUL`
- Overflow menu: Technical Foul

**Assist Flow:**
After any scoring event (2PT/3PT/FT), the UI briefly enters "assist mode":
- All stat buttons grey out
- AST button highlights on the other 4 active players
- `X` dismiss button available
- 2-second auto-dismiss timer — if nothing tapped, UI returns to normal
- Scorekeeper is guided toward attributing assists without adding friction

**Opponent Strip (pinned bottom):**
- Opponent name + running score
- `+1` `+2` `+3` score buttons
- `FOUL` button (personal) + `TECH` button
- Timeouts remaining

### 11.5 Substitution

**Individual Sub:**
- Tap `[SUB]` on the departing player's row
- Modal shows bench players as large jersey number + name tiles
- Tap incoming player → immediate swap
- Target: 2 taps, under 3 seconds

**Group Sub:**
- Tap `GROUP SUB` in header
- Full roster view: all players shown, active 5 highlighted
- Tap to toggle on/off, 5-player maximum enforced
- Confirm → all changes applied simultaneously
- Target: under 8 seconds

### 11.6 Undo & Correction System

**Quick Undo:**
- `UNDO LAST` button always visible in header
- Removes most recent event, all stats recalculate instantly
- No confirmation — brief toast notification only

**Event Log Panel:**
- Accessible via button/swipe — shows full chronological event list
- Individual delete capability for any event (not just the most recent)
- For correcting errors discovered multiple plays later
- Soft-delete (flagged, not removed) for audit trail

### 11.7 Clock Management (Deferred — MVP)

**MVP:** Manual period tracking only. Tap to advance quarter/half.

**Future addition:** Countdown timer in header with:
- Start/stop button
- Edit button to manually sync with gymnasium scoreboard during stoppages
- All events tagged with period number (and later, game clock time)

### 11.8 Autosave

Continuous autosave of current game state to localStorage. Protects against:
- App crash or force-close
- Accidental navigation away
- Device battery death

On next app launch, detect in-progress game and offer to resume.

### 11.9 End-of-Game Flow

1. Tap "End Game" → confirmation prompt
2. Final box score displayed for review
3. Option to make corrections via event log
4. "Finalize" → generates individual game records:
   - **Activated players with stats** → full game record in Individual Tracker format
   - **Activated players with zero stats** → game record showing floor time, no contribution
   - **Never-activated players** → no record generated
5. Game appears in history for all participating players
6. Tournament totals update if game was tagged

### 11.10 Navigation Structure

```
[ Track | Scorebook | Games | Reports | Manage ]
```

| Tab | Contents |
|---|---|
| **Track** | Existing individual stat tracker (unchanged) |
| **Scorebook** | New game setup + live scorekeeping |
| **Games** | Unified game history (individual + scorebook). Tournament management (CRUD + filtering) folded in here |
| **Reports** | Unified reporting — filterable by player, team, tournament, date range |
| **Manage** | Organizations, Teams, Rosters (permanent), Players, Export/Import |

### 11.11 File Architecture

```
src/
├── App.jsx                    (routing, layout shell, bottom nav)
├── components/
│   ├── common/                (ShotCard, CountCard, StatSummary, etc.)
│   ├── tracker/               (individual stat tracker views)
│   ├── scorebook/             (GameSetup, Scoreboard, PlayerRow, SubstitutionModal, EventLog, BoxScore)
│   ├── roster/                (org/team/player management)
│   └── shared/                (history, tournaments, reports)
├── hooks/                     (useLocalStorage, useGameClock, etc.)
├── utils/                     (stat calculations, formatters, constants)
├── data/
│   └── schema.js              (data models, defaults, validation)
└── main.jsx
```

### 11.12 Build Order

| Phase | Scope | Outcome |
|---|---|---|
| **Phase A** | File restructure | Split App.jsx into component tree. Zero feature changes. Verify app works identically. |
| **Phase B** | Roster management | Org/Team/Player CRUD in Manage tab. Extend player model with jersey numbers. Backward compatible migration. |
| **Phase C** | Scorebook MVP | Pre-game setup → live scoring (5 active, stat buttons, assist flow, undo, event log) → end game → generate individual records. Autosave. |

---

## Appendix A — Event Type Reference

Complete list of all supported event types in the scorebook event log. All events include `id`, `gameId`, `timestamp`, `gameTime`, `quarter`, `teamId`, and `clockSynced`.

| Event Type | Category | Player Required | Notes |
|---|---|---|---|
| `2pt_made` | Scoring | Yes | Increments FGM2, FGA2, PTS +2 |
| `2pt_missed` | Scoring | Yes | Increments FGA2 only |
| `3pt_made` | Scoring | Yes | Increments 3PM, 3PA, PTS +3 |
| `3pt_missed` | Scoring | Yes | Increments 3PA only |
| `ft_made` | Scoring | Yes | Increments FTM, FTA, PTS +1 |
| `ft_missed` | Scoring | Yes | Increments FTA only |
| `oreb` | Rebounding | Yes | Offensive rebound |
| `dreb` | Rebounding | Yes | Defensive rebound |
| `assist` | Playmaking | Yes | Optionally linked to a scoring event |
| `steal` | Defense | Yes | |
| `block` | Defense | Yes | |
| `turnover` | Misc | Yes | |
| `personal_foul` | Foul | Yes | Increments PF and team fouls |
| `technical_foul` | Foul | Yes | Increments team fouls ×2 |
| `substitution_in` | Game Mgmt | Yes | Always paired with `substitution_out` |
| `substitution_out` | Game Mgmt | Yes | Always paired with `substitution_in` |
| `timeout_home` | Game Mgmt | No | Decrements home timeouts remaining |
| `timeout_away` | Game Mgmt | No | Decrements away timeouts remaining |
| `quarter_start` | Game Mgmt | No | Records game clock reset, period number |
| `quarter_end` | Game Mgmt | No | Records end-of-period score snapshot |
| `opp_score_1` | Opponent | No | +1 to opponent score (free throw) |
| `opp_score_2` | Opponent | No | +2 to opponent score (field goal) |
| `opp_score_3` | Opponent | No | +3 to opponent score (three pointer) |
| `opp_foul` | Opponent | No | Increments opponent team fouls |

---

## Appendix B — Color System Reference

Maintain consistency with the existing app's established color language:

| Color | Hex | Usage |
|---|---|---|
| Orange | `#F97316` | Scoring stats, primary actions, highlights |
| Green | `#22C55E` | Positive secondary stats (reb, ast, stl, blk) |
| Blue | `#3B82F6` | Opponent strip, informational |
| Purple | `#A855F7` | 3-point specific elements |
| Red | `#EF4444` | Negative stats (TOV), foul warnings, danger actions |
| Amber | `#F59E0B` | Foul warnings (3–4 fouls), bonus threshold indicator |
| Background | `#080810` | App background |
| Card | `rgba(255,255,255,0.045)` | Stat cards and player rows |
| Border | `rgba(255,255,255,0.08)` | Card borders |

---

*StatTracker Pro — PRD v1.0 — whittsend.org*
