# WE-TRACK — Gate 7 Tasking Document
**Gate 7 + Gate 7.5 Combined — Player Profile System, Account Linking & App Shell Restructure**
**Whitt's End LLC | April 2026**

---

> ⚠️ **REQUIRED READING BEFORE WRITING ANY CODE**
> Read `MASTER_PLAN.md`, `PLAYER_ENTITY_SCHEMA.md`, `SUB_ORG_ARCHITECTURE.md`, and `CLAUDE.md` in full before touching any files. The player entity schema in `PLAYER_ENTITY_SCHEMA.md` supersedes all prior player/stats definitions. Every schema decision in this gate must conform to that document.

> **GATE POSITION:** Phase 2. Prerequisite: Gate 6 (Game Clock) ✅ complete. This document covers both Gate 7 (Player Profile System) and Gate 7.5 (App Shell Restructure) as a single combined implementation. All work on the `dev` branch. Merge to `main` only after all test conditions in §7 pass.

---

## Table of Contents

1. [Architecture Decisions (Locked)](#1-architecture-decisions-locked)
2. [New Collections & Schema](#2-new-collections--schema)
3. [Phase A — Player Profile System](#3-phase-a--player-profile-system-gate-7-core)
4. [Phase B — App Shell Restructure](#4-phase-b--app-shell-restructure-gate-75)
5. [Migration Script — Historical Game Backfill](#5-migration-script--historical-game-backfill)
6. [Implementation Sequence](#6-implementation-sequence)
7. [Test Conditions](#7-test-conditions)
8. [Known Issues & Deferred Work](#8-known-issues--deferred-work)
9. [Files Expected to Change](#9-files-expected-to-change)

---

## 1. Architecture Decisions (Locked)

### 1.1 Game Data Consolidation — `games[]` Deprecated

The current system maintains three game representations in `orgs/{orgId}/data/db`:

| Collection | Role | Fate |
|---|---|---|
| `scheduledGames[]` | Pre-game scheduling stub | Retained permanently |
| `scorebookGames[]` | Full event log + official game record | Retained permanently under team for dispute resolution |
| `games[]` | Derived per-player stat aggregates | **Deprecated as of Gate 7** |

`games[]` was a query workaround that no longer has a role. Its function is replaced by:
- `players/{playerId}/stats/basketball/games/{gameId}` — permanent player stat records written at finalization
- `scorebookGames/{gameId}` events array — canonical source for play-by-play and box score reconstruction

**Historical game viewing post-Gate 7 works through two clean paths:**
- **Box score / stat view** → query all `players/{playerId}/stats/basketball/games/` where `gameId == X`, collect, render box score
- **Play-by-play** → load `scorebookGames/{gameId}`, read events array filtered for `deleted: false`

> **ACTION REQUIRED:** After Gate 7 ships: (1) Stop writing new records to `games[]`. (2) History/Reports continue reading `games[]` for the 5 legacy records until the backfill script runs. (3) Backfill script migrates legacy `games[]` records into `players/{playerId}/stats/`. (4) After backfill confirmed, update History/Reports read path to prefer player stat collections. Do NOT delete `games[]` yet — defer to a future cleanup gate.

---

### 1.2 Player IDs Are Stable — No Remapping Needed

Confirmed from production data: existing player records use stable prefixed string IDs (e.g. `player_1775140493444`). These are used as-is as the `/players/{playerId}` document ID in the new top-level collection. The scorebook event log already references these IDs correctly. The seeding script reuses them with no remapping.

---

### 1.3 Stat Key Mapping (`scorebookEngine.js` → Schema)

The scorebook engine stores attempts as made + missed combined (the `a` suffix = **attempts**, not misses). Misses are always derived. The schema stores made and missed as separate fields. The finalization writer and migration script must apply this transformation.

Confirmed in `src/utils/scorebookEngine.js:36-41`:
```js
case "2pt_made":   stats.pts2++;  stats.pts2a++;  break;
case "2pt_missed":                stats.pts2a++;  break;
// etc. — pts2a = total attempts (made + missed)
```

| `scorebookEngine` field | Schema key | Transform |
|---|---|---|
| `pts2` | `2pt_made` | direct |
| `pts2a - pts2` | `2pt_missed` | derive: attempted − made |
| `pts3` | `3pt_made` | direct |
| `pts3a - pts3` | `3pt_missed` | derive: attempted − made |
| `ft` | `ft_made` | direct |
| `fta - ft` | `ft_missed` | derive: attempted − made |
| `oreb` | `oreb` | direct |
| `dreb` | `dreb` | direct |
| `ast` | `assist` | direct |
| `stl` | `steal` | direct |
| `blk` | `block` | direct |
| `tov` | `turnover` | direct |
| `foul` | `personal_foul` | direct |
| `(pts2 × 2) + (pts3 × 3) + ft` | `_points` | computed at write time |
| `pts2 + pts3` | `_fgm` | computed at write time |
| `pts2a + pts3a` | `_fga` | computed at write time |

---

### 1.4 Season Derivation

`scorebookGames` do not currently carry a `season` field. Gate 7 derives season automatically from `gameDate` using school-year logic:

```js
function deriveSeason(gameDate) {
  const date = new Date(gameDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed
  return month >= 8
    ? `${year}-${year + 1}`
    : `${year - 1}-${year}`;
}
// Example: "2026-03-21" → "2025-2026"
```

Apply this at both finalization write time and in the migration script. No changes to GameSetup UI required for Gate 7.

---

### 1.5 System Notifications

System notifications to coaches and org owners (pending claim approvals, role conflicts, etc.) live in a dedicated org-scoped collection. This keeps them structurally separate from user chat while positioning them to drive FCM push in Gate 8 without schema changes.

```js
/orgs/{orgId}/notifications/{notificationId} = {
  id:          string,
  type:        "claim_pending" | "role_conflict" | "document_expired",
  targetId:    string,     // playerId, uid, etc.
  targetName:  string,     // "Marcus Johnson"
  teamId:      string | null,
  createdAt:   timestamp,
  resolvedAt:  timestamp | null,
  resolvedBy:  string | null,
}
```

In Gate 7 (pre-7.5), Manage tab gets a Notifications section listing pending items. In Gate 7.5, this moves to the sidebar. In Gate 8, same documents drive FCM push.

---

### 1.6 Claim Link Base URL

Use `https://we-track.netlify.app/claim/{code}` for all generated claim links in Gate 7. When a custom domain is configured, this is the only string that needs to change.

---

### 1.7 Player Profile — Additional Required Fields (Division Eligibility Groundwork)

Three fields are added to the player profile schema now to support the future division eligibility engine (`DIVISION_ELIGIBILITY_STUB.md`). Collecting them at player creation avoids a backfill later. All are self-reported at creation; none require verification to be stored.

These fields are **required in the player creation form** (Manage → Roster → Add Player) alongside name and jersey number:

```js
// Added to /players/{playerId}/profile
gender:      "male" | "female" | null,   // needed for gender-gated divisions
dateOfBirth: string | null,              // "YYYY-MM-DD" — required for age-based eligibility
gradYear:    string | null,              // "2031" — required for grade-based eligibility
gpa:         number | null,              // e.g. 3.85 — collected now, used in future eligibility rules
```

**Notes:**
- `dateOfBirth` and `gradYear` are already in `PLAYER_ENTITY_SCHEMA.md` as nullable — promote them to required in the creation form UI
- `gender` and `gpa` are **new fields not currently in the schema** — add them to `PLAYER_ENTITY_SCHEMA.md §6` as part of this gate
- All four default to `null` on existing seeded player records — the seeding script does not need to populate them
- `gpa` is a decimal number (double, not int64) — store as a float, display to 2 decimal places in UI
- No validation rules on GPA range — accept whatever the coach or parent enters

---

## 2. New Collections & Schema

> **Canonical reference:** `PLAYER_ENTITY_SCHEMA.md` §6, §7, §9, §15 are the authoritative schema definitions. The tables below are summaries only. Read the full document before implementing.

### 2.1 Top-Level Collections to Create

| Collection Path | Purpose | Gate |
|---|---|---|
| `/sportTemplates/{sport}` | Superadmin-defined stat definitions and format defaults | Gate 7 |
| `/players/{playerId}/profile` | Permanent player entity — see `PLAYER_ENTITY_SCHEMA.md §6` | Gate 7 |
| `/players/{playerId}/memberships/{id}` | Temporal team/org relationship records | Gate 7 |
| `/players/{playerId}/stats/{sport}/games/{gameId}` | Permanent per-game stat records | Gate 7 |
| `/players/{playerId}/documents/{docType}` | Doc metadata only — files in Firebase Storage | Gate 7 (stub) |
| `/coaches/{coachId}/profile` | Coach entity stub — no UI in Gate 7 | Gate 7 |
| `/coaches/{coachId}/memberships/{id}` | Coach team/org memberships — written on invite acceptance | Gate 7 |
| `/claimCodes/{code}` | Account linking invitation codes — 7-day TTL | Gate 7 |
| `/orgs/{orgId}/notifications/{id}` | System notifications for coaches and owners | Gate 7 |
| `/orgs/{orgId}/subOrgs/{subOrgId}` | Sub-org collection schema prep — Phase A, no UI | Gate 7.5 |

---

### 2.2 `linkedAccounts` Schema (on player profile doc)

Lives on the player profile document for security rule access. First approved account is the primary; subsequent accounts can be added by the primary account without coach re-approval.

```js
// Stored as array on /players/{playerId}/profile
linkedAccounts: [
  {
    uid:          string,
    relationship: "self" | "parent" | "guardian" | "family",
    isPrimary:    boolean,     // true for first coach-approved account only
    addedAt:      timestamp,
    approvedAt:   timestamp,
    approvedBy:   string,      // coach uid (primary) or primaryUid (secondaries)
  }
]
```

**Primary vs Secondary linking:** Coach approval is required only for the FIRST linked account. Once a primary account is approved, that user can invite additional family members (secondary links) through a self-serve flow in the "My Child" sidebar section. Secondary links are written to `linkedAccounts[]` with `approvedBy: primaryUid` — no coach action required.

---

### 2.3 `claimCodes` Schema

```js
/claimCodes/{code} = {
  playerId:      string,
  orgId:         string,
  teamId:        string,
  createdByUid:  string,
  createdAt:     timestamp,
  expiresAt:     timestamp,    // 7-day TTL
  usedAt:        timestamp | null,
  usedByUid:     string | null,
  relationship:  "self" | "parent" | "guardian" | null,
  isPrimary:     boolean,      // false = secondary link (no coach approval needed)
  status:        "pending" | "pending_approval" | "approved" | "denied" | "expired",
  approvedAt:    timestamp | null,
  approvedByUid: string | null,
}
```

---

## 3. Phase A — Player Profile System (Gate 7 Core)

### 3.1 Sport Template Bootstrap

> ⚠️ **MANUAL SUPERADMIN OPERATION — NOT APPLICATION CODE.** Must be completed before testing Gate 7 finalization. Create `/sportTemplates/basketball` in the Firestore console.

```js
// /sportTemplates/basketball
{
  sport:       "basketball",
  displayName: "Basketball",
  createdAt:   <timestamp>,
  createdByUid: <superadmin uid>,
  statDefinitions: [
    { key: "2pt_made",       label: "2PT Made",   category: "scoring"    },
    { key: "2pt_missed",     label: "2PT Miss",   category: "scoring"    },
    { key: "3pt_made",       label: "3PT Made",   category: "scoring"    },
    { key: "3pt_missed",     label: "3PT Miss",   category: "scoring"    },
    { key: "ft_made",        label: "FT Made",    category: "scoring"    },
    { key: "ft_missed",      label: "FT Miss",    category: "scoring"    },
    { key: "oreb",           label: "OREB",       category: "rebounding" },
    { key: "dreb",           label: "DREB",       category: "rebounding" },
    { key: "assist",         label: "AST",        category: "playmaking" },
    { key: "steal",          label: "STL",        category: "defense"    },
    { key: "block",          label: "BLK",        category: "defense"    },
    { key: "turnover",       label: "TOV",        category: "misc"       },
    { key: "personal_foul",  label: "PF",         category: "fouls"      },
    { key: "technical_foul", label: "TF",         category: "fouls"      },
  ],
  formatDefaults: {
    periodType:          "half",
    periods:             2,
    periodLengthMinutes: 20,
    foulsToDisqualify:   5,
    foulResetPeriod:     "game",
    timeoutsPerGame:     5,
  },
}
```

---

### 3.2 Player Entity Seeding Utility

Create `src/utils/seedPlayerEntities.js` — superadmin-only utility, not exposed in any UI. Same pattern as the tournament recovery script. **Idempotent** — safe to run multiple times (skip if document already exists).

For each existing player in `orgs/{orgId}/data/db`:

1. Write `/players/{playerId}/profile` using the identical existing player ID. Fields: `displayName`, `createdAt`, `createdByUid`, `claimedAt: null`, `linkedAccounts: []`, `gender: null`, `dateOfBirth: null`, `gradYear: null`, `gpa: null` — the four eligibility fields default to null on seeded records; coaches or parents populate them later
2. Write `/players/{playerId}/memberships/{membershipId}` for current team/season with `status: "active"`, `jerseyNumber` from org roster
3. For each finalized `scorebookGame` that includes this player, write a stat game record to `/players/{playerId}/stats/basketball/games/{scorebookGameId}` — apply the key mapping from §1.3 and season derivation from §1.4. Set `source: "scorebook"`, `verified: true`, `finalizedAt` from the scorebook game.

For each existing coach UID in the org, write a stub `/coaches/{coachId}/profile` doc.

---

### 3.3 Finalization Hook — Stat Write on Game End

The existing confirmation modal is correct and stays unchanged. Gate 7 adds a stat write step immediately after the coach confirms.

**Hook location:** wherever `status: "finalized"` is written to the scorebook game document.

Add these steps in sequence after the existing finalization logic:

```
Step 1 — For each playerId in activePlayers[]:
  - Filter events where deleted: false and playerId matches
  - Group by stat type
  - Apply key mapping from §1.3 (derive misses as attempted − made)
  - Derive season from gameDate per §1.4

Step 2 — Write to /players/{playerId}/stats/basketball/games/{scorebookGameId}
  Include all context metadata:
    orgId, orgName (snapshot), teamId, teamName (snapshot),
    gameDate, opponent, tournamentId, tournamentName,
    phase, bracketName, round, season,
    source: "scorebook", verified: true,
    finalizedAt, finalizedByUid

Step 3 — Write generatedStatIds: [{ playerId, statGameId }]
  back to the scorebook game document

Step 4 — Do NOT write to games[]
  The games[] array receives no new writes after Gate 7
```

> **Offline Safety:** The stat write uses the same Firestore offline-first pattern as all other writes — it queues and syncs on reconnect. Do NOT add a blocking network check before finalization.

---

### 3.4 Account Linking — Invitation Flow

UI copy uses **"Invite to Link Account"** everywhere. The `claimCodes` Firestore collection name is unchanged.

#### Generate Link (Coach)

- **Entry point:** Manage → Roster → tap player row → "Invite to Link Account"
- Write `/claimCodes/{code}` with 7-day TTL, `status: "pending"`
- Display share sheet with copy-to-clipboard: `https://we-track.netlify.app/claim/{code}`
- If a pending unaccepted link already exists, show it with expiry + "Regenerate" option (regenerate invalidates old code)
- Player row in Roster shows a 🔗 badge while a pending unaccepted link exists

#### Accept Link (Parent/Player)

- `https://we-track.netlify.app/claim/{code}` — deep link or web fallback
- If not signed in → prompt Google sign-in (`signInWithPopup` only — never `signInWithRedirect`)
- Show player name (from `claimCode` doc) and relationship selector: "I am this player" / "I am a parent or guardian"
- On confirm: write `usedAt`, `usedByUid`, `relationship` to claim code doc. Set `status: "pending_approval"`.
- Write notification to `/orgs/{orgId}/notifications/` with `type: "claim_pending"`
- Show confirmation screen: "Your request has been sent to the coach for approval."

#### Approve/Deny (Coach)

- Roster row badge: 🔗 link sent → ⏳ pending approval → ✅ linked
- Notifications section in Manage tab shows pending claims with player name, requester name, relationship
- **Approve:** write `{ uid, relationship, isPrimary: true, addedAt, approvedAt, approvedBy }` to `player.profile.linkedAccounts[]`. Mark claim code `status: "approved"`. Mark notification resolved.
- **Deny:** set claim code `status: "denied"`. Mark notification resolved. Player profile unchanged.

#### Secondary Account Linking (Primary account self-serve)

- **Entry point:** Sidebar → My Child → "Add Family Member"
- Primary account generates a secondary invite link (same `claimCodes` collection, `isPrimary: false`)
- Secondary account opens link → Google sign-in → relationship selector → **auto-approved** (no coach step)
- Written to `linkedAccounts[]` with `approvedBy: primaryUid`

---

### 3.5 Coach Profile Stubs

No coach profile UI is built in Gate 7. The collection and rules are established for Gate 8+ to build on.

- Seeding script (§3.2) writes `/coaches/{coachId}/profile` stubs for all existing coach UIDs
- Update the existing coach invite acceptance flow to write `/coaches/{coachId}/memberships/{membershipId}` on every accepted invite going forward — fields: `orgId`, `orgName`, `teamId`, `teamName`, `sport`, `role`, `season`, `joinedAt`, `status: "active"`

---

### 3.6 Firestore Security Rules — New Collections

Add rules for all new collections. Full logical spec in `PLAYER_ENTITY_SCHEMA.md §15`. Key additions:

```
// Sport templates — superadmin write, all authenticated read
/sportTemplates/**
  read:  request.auth != null
  write: isSuperadmin()

// Player profiles — linked accounts + coaches in any of player's orgs
/players/{playerId}/**
  read:  isLinkedAccount(playerId) || isCoachInPlayerOrg(playerId) || isSuperadmin()
  write: isLinkedAccount(playerId) || isActiveCoachForPlayer(playerId) || isSuperadmin()

// Player stats — write restricted to active org authority
/players/{playerId}/stats/**
  write: isActiveCoachForPlayer(playerId) || isSuperadmin()

// Claim codes — always readable (link acts as auth), coach creates
/claimCodes/{code}
  read:  true
  write: isActiveCoach() || isSuperadmin()

// Org notifications — org members read, coach+ write
/orgs/{orgId}/notifications/**
  read:  hasOrgRole(orgId)
  write: hasPermission(orgId, "members") || isSuperadmin()

// Sub-org collection — Phase A schema prep
/orgs/{orgId}/subOrgs/{subOrgId}
  read:  hasOrgRole(orgId)
  write: isOrgOwner(orgId) || isSuperadmin()
```

Deploy after writing: `firebase deploy --only firestore:rules`

---

### 3.7 Sub-Org Schema Phase A (Additive Only — No UI)

Two nullable field additions and one new empty collection. No migration. No UI changes.

- Add `subOrgId: null` to `writeTeamDoc()` default shape
- Add `subOrgsEnabled: false` to `writeOrgDoc()` at org creation
- Define `/orgs/{orgId}/subOrgs/{subOrgId}` collection in `firestore.rules` (see §3.6)

---

## 4. Phase B — App Shell Restructure (Gate 7.5)

> ⚠️ **ATOMIC CHANGE — DO NOT PARTIAL MIGRATE.** The 5-tab nav is replaced entirely with the 3-tab + sidebar architecture. Do not ship a hybrid state. All existing features must be accessible via the new structure before this phase is considered complete.

### 4.1 New Bottom Navigation

| Tab | Contents | All Roles |
|---|---|---|
| **Chat** | Communications — placeholder only in Gate 7.5. Wired in Gate 8. | ✅ |
| **Schedule** | Team calendar, upcoming games, events | ✅ |
| **Stats** | Live scorebook + game history + stat views | ✅ |

---

### 4.2 New Components

#### `TeamContextPill`

- Persistent pill pinned above all content, fixed during vertical scroll
- Displays: sport emoji + active team name + dropdown chevron (e.g. `🏀 Eagles 6U ▾`)
- Tap opens `AppSidebar`
- Updates automatically when active team changes via sidebar team switcher
- Reads from `activeTeam` state in `App.jsx` — same state variable, new source

#### `AppSidebar`

- Slides in from left on `TeamContextPill` tap. Overlay with backdrop dismiss.
- **Team switcher dropdown** at the top: lists all teams user belongs to. Parent entries show child badge (child player name). Persists selection to `localStorage`. Selecting a team closes dropdown and updates `activeTeam` throughout the entire app.
- **ORG section** (always visible, regardless of active team)
- **TEAM section** (scoped to active team)
- **Role-scoped secondary nav** (see §4.3)
- **Settings** always at bottom
- Remove the orange context banner from History/Reports — context is now communicated by the pill

---

### 4.3 Sidebar Content by Role

**Parent:**
```
[ 🏀 Eagles 6U ▾ ]
─────────────────────────────────
ORG
  📢 Announcements  (placeholder)
─────────────────────────────────
TEAM — Eagles 6U
  💬 Team Chat  (placeholder)
─────────────────────────────────
MY CHILD
  [Child Name]'s Profile
─────────────────────────────────
NOTIFICATIONS  (if any pending)
─────────────────────────────────
ACCOUNT
  Payments & Registration
  Waivers & Documents
  Settings
```

**Coach (Head Coach / Assistant / Manager / Staff):**
```
[ 🏀 Eagles 6U ▾ ]
─────────────────────────────────
ORG
  📢 Announcements  (placeholder)
─────────────────────────────────
TEAM — Eagles 6U
  💬 Team Chat  (placeholder)
─────────────────────────────────
MANAGE TEAM
  Roster
  Schedule
  Members
  Permissions
─────────────────────────────────
NOTIFICATIONS  (pending approvals, etc.)
─────────────────────────────────
REPORTS & EXPORTS  (HC and above)
─────────────────────────────────
SETTINGS
```

**Org Owner:**
All coach items plus:
```
ORG SETTINGS
  Billing
  Org-Level Member Management
```

---

### 4.4 Feature Redistribution

| Current location | New location | Notes |
|---|---|---|
| Track tab | Stats tab | Direct move |
| Scorebook tab | Stats tab (sub-view) | Direct move |
| History tab | Stats tab (sub-view) | Direct move |
| Reports tab | Sidebar → Reports & Exports | Coach and above only |
| Manage tab | Sidebar → Manage Team | Coach and above only |
| (new) Player Profile | Sidebar → My Child | Parent only |
| (new) Notifications | Sidebar → Notifications | Coach and above |

---

### 4.5 What Does NOT Change in Gate 7.5

- No communication functionality is built
- `conversations` Firestore collection is not written to
- ORG and TEAM channel items in the sidebar are non-functional placeholders
- All existing scorebook, history, reports, and manage functionality is fully preserved
- All components that currently read `activeTeam` continue to work unchanged — only the source of that state changes (sidebar selection instead of old pill row)

---

## 5. Migration Script — Historical Game Backfill

> **Timing:** Runs AFTER Gate 7 is deployed and tested. NOT a Gate 7 blocker. New games finalized after Gate 7 write to the correct path immediately. The 5 historical games are backfilled separately.

### 5.1 Script Responsibilities (`src/utils/backfillHistoricalStats.js`)

1. Read all `scorebookGames` from `orgs/{orgId}/data/db` where `status: "finalized"`
2. For each game, for each `playerId` in `activePlayers[]`:
   - Process events array (filter `deleted: false`, group by `playerId`)
   - Apply key mapping from §1.3 — remember: `pts2a`, `pts3a`, `fta` are **attempts** (made + missed); derive misses as `attempted − made`
   - Apply season derivation from §1.4
3. Write to `/players/{playerId}/stats/basketball/games/{scorebookGameId}`
   - `source: "scorebook"`, `verified: true`, `finalizedAt` from scorebook game
   - All context metadata: `orgId`, `orgName`, `teamId`, `teamName`, `gameDate`, `opponent`, `tournamentId`, `phase`, `season`
4. **Idempotent:** skip write if document already exists at that path
5. Log each write. After all 5 games confirmed, log summary. Do not delete `games[]`.

---

## 6. Implementation Sequence

Work in this order within the `dev` branch. Run `npm run build` after each phase. Do not merge to `main` until §7 test conditions pass.

### Phase A — Firestore Foundation
- [ ] Write security rules for all new collections (§3.6)
- [ ] Deploy: `firebase deploy --only firestore:rules`
- [ ] Add `subOrgId: null` to `writeTeamDoc()` default shape
- [ ] Add `subOrgsEnabled: false` to `writeOrgDoc()`
- [ ] Define `/orgs/{orgId}/subOrgs/` collection in rules

### Phase B — Player Entity Seeding Utility
- [ ] Build `src/utils/seedPlayerEntities.js`
- [ ] Superadmin-only, not in any UI
- [ ] Idempotent — safe to re-run
- [ ] Run against production after Gate 7 deploys

### Phase C — Finalization Hook
- [ ] Locate finalization confirm handler (LiveScorebook.jsx or equivalent)
- [ ] Add stat write step using §1.3 transform and §1.4 season derivation
- [ ] Stop writing to `games[]` — no new writes after this change
- [ ] Write `generatedStatIds[]` back to scorebook game doc

### Phase D — Account Linking UI
- [ ] Manage → Roster → player row → "Invite to Link Account" button
- [ ] `claimCode` generation and copy-to-clipboard display
- [ ] Roster badge states: 🔗 link pending, ⏳ approval pending, ✅ linked
- [ ] Deep link handler: `we-track.netlify.app/claim/{code}` → Google sign-in → relationship selector → `status: "pending_approval"`
- [ ] Notifications section in Manage tab with pending claims list
- [ ] Approve / Deny actions on each pending item
- [ ] Secondary linking UI in sidebar My Child section (wired after Phase F)

### Phase E — Coach Profile Stubs
- [ ] Seed coach profile stubs for existing coaches alongside player seeding
- [ ] Update invite acceptance flow to write `/coaches/{coachId}/memberships/{id}`

### Phase F — App Shell Restructure (Gate 7.5)
- [ ] Build `TeamContextPill` component
- [ ] Build `AppSidebar` component with role-scoped layout
- [ ] Replace 5-tab bottom nav with 3-tab (Chat, Schedule, Stats)
- [ ] Redistribute existing tab content per §4.4
- [ ] Remove orange context banner from History/Reports
- [ ] Wire `activeTeam` state source to sidebar team switcher
- [ ] Persist sidebar team selection to `localStorage`

### Phase G — Backfill Script
- [ ] Build `src/utils/backfillHistoricalStats.js`
- [ ] Run against production
- [ ] Verify output against existing History/Reports for 1–2 players manually
- [ ] Confirm idempotency (run twice, no duplicates)

---

## 7. Test Conditions

### Player Profile + Linking
- [ ] Create a new player entity from Manage → Roster. Confirm `/players/{playerId}/profile` document created in Firestore.
- [ ] Generate invite link. Confirm `/claimCodes/{code}` created with 7-day TTL, `status: "pending"`.
- [ ] Open link on Whitt's End test account. Sign in with Google. Select relationship. Confirm `status: "pending_approval"` on claim code doc.
- [ ] Approve as coach. Confirm `linkedAccounts[]` updated on player profile. Confirm notification marked resolved.
- [ ] Confirm player profile is accessible from the approved parent/test account.
- [ ] Deny a second claim link. Confirm player profile `linkedAccounts[]` unchanged.

### Stat Finalization
- [ ] Play a test scorebook game with 2+ active players. Finalize via existing confirmation modal.
- [ ] Confirm `/players/{playerId}/stats/basketball/games/{gameId}` record exists for each active player.
- [ ] Confirm stats are correct: `_points = (2pt_made × 2) + (3pt_made × 3) + ft_made`.
- [ ] Confirm `games[]` was NOT written to.
- [ ] Confirm scorebook game doc has `generatedStatIds[]` populated.
- [ ] Confirm History/Reports still work for the 5 legacy games (still reading `games[]` path).

### Migration Script
- [ ] Run backfill script against production (5 games, ~10 players).
- [ ] Confirm `/players/{playerId}/stats/basketball/games/` contains correct records for all 5 games.
- [ ] Cross-check stats for at least 2 players against what History/Reports currently displays.
- [ ] Run script a second time — confirm no duplicate documents created.

### App Shell Restructure
- [ ] Install as returning user post-Gate 7. Confirm 3-tab nav renders correctly.
- [ ] Confirm `TeamContextPill` is visible and pinned above all content on all three tabs.
- [ ] Confirm tapping pill opens `AppSidebar`.
- [ ] Confirm team switcher changes active team context across all tabs simultaneously.
- [ ] Confirm role-scoped sidebar renders correctly for parent, coach, and owner test accounts.
- [ ] Confirm all existing scorebook, history, reports, and manage features remain accessible.
- [ ] Confirm orange context banner is gone from History/Reports.

---

## 8. Known Issues & Deferred Work

| Issue | Notes | Target |
|---|---|---|
| Coach data scope enforcement in History/Reports UI | Firestore rules enforce it; UI scoping deferred — requires player profile system stable | Gate 8+ |
| Full coach profile UI (career stats, bio, public page) | Schema groundwork done in Gate 7. UI is a separate future gate. | Post-Gate 8 |
| `games[]` cleanup and removal from codebase | Do not remove until History/Reports read path updated to player stat collections | Future cleanup gate |
| Season field on GameSetup UI | Auto-derived in Gate 7. Manual override UI deferred. | Future gate |
| `storage.js` multi-org routing non-deterministic for multi-org users | Fix before any multi-org user exists | Pre-multi-org |
| Owner notification badge for `pending_conflict` roles | Gate 8 notification system | Gate 8 |
| FCM push for `claim_pending` notifications | Gate 8 — same `/orgs/{orgId}/notifications/` documents drive this | Gate 8 |
| Division eligibility engine + auto-population | Schema groundwork (gender, DOB, gradYear, GPA, divisionId) done in Gate 7. Full engine is a future gate. See `DIVISION_ELIGIBILITY_STUB.md`. | Division gate |
| GPA / DOB / gradYear edit UI for existing players | Fields collected at creation; editing existing seeded players requires a UI pass on the player profile view | Division gate or Gate 8 |

---

## 9. Files Expected to Change

### New files
```
src/utils/seedPlayerEntities.js
src/utils/backfillHistoricalStats.js
src/components/shell/TeamContextPill.jsx
src/components/shell/AppSidebar.jsx
src/components/players/PlayerProfile.jsx
src/components/players/ClaimLinkSheet.jsx
src/components/players/AccountLinkFlow.jsx     ← deep link handler
src/components/manage/NotificationsPanel.jsx
```

### Modified files
```
src/components/scorebook/LiveScorebook.jsx     ← finalization hook + stat write
src/components/manage/RosterView.jsx           ← invite button, badge states
src/utils/storage.js / writeTeamDoc()          ← subOrgId field
src/utils/storage.js / writeOrgDoc()           ← subOrgsEnabled field
src/utils/inviteFlow.js                        ← write coach membership on accept
firestore.rules                                ← all new collections
App.jsx                                        ← activeTeam from sidebar, 3-tab nav
```

---

*Whitt's End LLC | We-Track | Gate 7 Combined | April 2026*
