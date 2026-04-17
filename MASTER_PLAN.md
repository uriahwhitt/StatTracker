# WE TRACK — Master Planning Document

**App:** WE TRACK (StatTracker)
**Owner:** Whitt's End LLC
**Last Updated:** April 17, 2026
**Branch:** `main` / `dev`
**Status:** Phase 2, Gate 6 complete — Gate 7 next

> **How to use this document:** This is the single canonical reference for all architecture, feature design, and build planning. It supersedes all prior planning documents (`ARCHITECTURE.md`, `PHASE2_ARCHITECTURE.md`, `COMMUNICATION_PLAN.md`, `stattracker_monetization_and_features_planning.md`). Where those documents conflict, this document reflects the resolved decision or flags the conflict as an open question. Future Claude Code sessions should reference this document first.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Data Model](#2-architecture--data-model)
3. [Feature Specifications](#3-feature-specifications)
4. [Communication Features](#4-communication-features)
5. [Monetization & Billing](#5-monetization--billing)
6. [Admin Consoles](#6-admin-consoles)
7. [Build Phases](#7-build-phases)
8. [Open Questions](#8-open-questions)

---

## 1. Project Overview

### What It Is

WE TRACK is a mobile-first basketball stat tracking PWA built with React + Vite, deployed to `trackstat.netlify.app` and installable as a PWA on Android and iOS. It was initially built for solo use by a single org, and is expanding in Phase 2 to support multi-user, multi-role, multi-team, and eventually multi-org usage.

| | |
|---|---|
| **Stack** | React 18 + Vite, Firebase Firestore + Anonymous Auth, offline-first |
| **Deployment** | Netlify (trackstat.netlify.app), installable PWA |
| **Auth** | Anonymous mode (permanent) + Google OAuth (opt-in) |
| **Database** | Firebase Firestore with offline persistence |
| **Primary user today** | Solo developer / org admin tracking multiple teams |
| **Short-term target** | NC travel basketball coaches + org admins |
| **Long-term vision** | Multi-sport tournament organizer platform with multi-org support |

### Target Market

NC travel basketball is the launch market — a tight-knit community where word-of-mouth matters. Self-registration supports organic growth without a manual provisioning bottleneck. The feature set is designed to match or exceed competing apps (Heja, SportsYou, TeamSnap) while being a better fit for travel basketball specifically (tournament readiness, official scorebook, stat depth).

### Current Status Summary (as of April 14, 2026)

Phase 1 and 1.5 are fully complete. Phase 2 Gates 1–5b are complete: Google OAuth, org + role infrastructure, coach invite flow, parent join codes + live read, post-tournament stability fixes, scorekeeper assignment + game lock (Gate 5a), and permissions schema + new roles (Gate 5b). Gate 6 (Scorebook Game Clock) is complete. Gate 7 (Player Profile System + Claim Codes) is next.

See [§7 — Build Phases](#7-build-phases) for full gate status and remaining work.

---

## 2. Architecture & Data Model

### 2.1 Locked Architecture Decisions

The following decisions are final across all phases.

| Decision | Detail |
|---|---|
| **Event-sourced data model** | Event log only — no running totals. Enables full undo, play-by-play, future clock sync. |
| **Storage abstraction** | `loadDb` / `persist` interface in `storage.js`. Swap internals only — all other files unchanged. |
| **Firestore Phase 1.5** | Offline-first with `persistentLocalCache()`. Auto-syncs on reconnect. |
| **Anonymous mode is permanent** | Anonymous users retain full solo functionality indefinitely. Transfer codes stay in the codebase forever. |
| **Anonymous → Google linking** | Firebase native account linking. Existing UID is preserved. No data migration. |
| **Data path routing** | Personal path (`users/{uid}/data/db`) when no org role; org path (`orgs/{orgId}/data/db`) when org role exists. One-time migration on first org join. |
| **Player entity is universal join point** | Players start as anonymous placeholders created by coaches. Claimed by verified users. UID persists across team and org transfers. All stats, DMs, and calendar history follow the UID. |
| **No miss buttons** | Made-only stat entry. Corrections via undo / event log delete. |
| **Autosave** | Dual-rate debounce: 300ms for roster/manage edits; 45s during live scorebook games. localStorage is always written first on every change as the crash-safe backup — Firestore sync is for cross-device visibility, not crash recovery. |
| **Assist flow** | 2-second auto-dismiss after scoring event. |
| **Tournament scope** | Tournaments are global — not org-owned. `createdByOrgId` is nullable. |
| **IDs** | All IDs are UUID strings. Compatible with both localStorage and Firestore document IDs. |
| **Superadmin** | Implemented as Firebase Auth custom claim (`superadmin: true`). Never stored in Firestore. Set manually via Firebase Admin SDK for Whitt's End account only. |
| **Transfer codes** | Permanent. Six-character code, 10-minute TTL, maps device UID in `transferCodes/{code}`. Remains the sync mechanism for anonymous users and a fallback for authenticated users. |
| **Player-primary schema** | Player entity is permanent and primary. Stats live under the player, sport-namespaced. Orgs/teams are authority contexts, not owners. See PLAYER_ENTITY_SCHEMA.md. |

### 2.2 Organizational Hierarchy

```
Super Admin (platform operator — no org/team ownership)
    └── Org Owner / Admin (paying customer, owns the org)
            ├── Org Staff (org-level, no specific team — admin, finance, future roles)
            └── Head Coach (manages one team, full scorebook access)
                    └── Assistant Coach (same team, no role management)
                            └── Scorekeeper (per-game temp assignment)
                                    └── Parent (read-only, one team)
                                            └── Player (entity, not a user role)
```

**Key hierarchy rules:**
- Users exist above the org level — a user can hold roles across multiple orgs simultaneously
- Org Owner inherits all coach-level access on all teams in their org by default
- Org Owner can simultaneously hold a Coach role (additive roles, not exclusive)
- Org Staff is an org-level role with `teamId: null` — not assigned to any specific team. Covers administrative, financial, and other non-coaching org functions. Access scope TBD per sub-role.
- Scorekeeper is a per-game temporary assignment, not a standing role
- Anonymous users cannot be assigned any role and remain invisible to the role system
- A coach already active in one org can accept an invite from another org — roles are additive
- **Ownership transfer:** During a transfer, two owners may temporarily coexist. The original owner retains full access until they explicitly step down (to Org Staff or leave). This is an in-app flow — no superadmin intervention required.

### 2.3 Role Definitions

| Role | Scope | Manage | Scorebook | History | Reports | Notes |
|---|---|---|---|---|---|---|
| **Superadmin** | System-wide | Full | Full | Full | Full | Platform operator only. Custom claim. |
| **Org Owner / Admin** | One org | Full | Full | Full | Full | Paying customer. All teams in org. Creates teams. |
| **Manager** | One org (no team) | Admin + finance + season config | Grantable | Full | Full | Org-level admin role. `teamId: null`. Covers scheduling, compliance, financials. Gate 5b. |
| **Staff** | Team or org | Grantable per flag | Grantable | Full | Full | Ground-level ops. Equipment manager, team volunteer, trusted parent on game day. Gate 5b. |
| **Head Coach** | One team | Team roster + members | Full | Full | Full | Can assign roles, generate join codes, break game locks. Cannot create teams. |
| **Assistant Coach** | One team | Grantable per flag | Full | Full | Full | No role management by default. Individual flags grantable. |
| **Scorekeeper** | One game | None | Input only (locked game) | None | None | Not a standing role — scorebook access gated by `permissions.scorebook` flag. |
| **Parent** | One team | Read-only roster | Grantable | Full | Full | Joins via reusable 6-character join code. Google account required. |

### 2.4 Role Storage

```
// Standing roles — subcollection, orgId is the document ID
users/{uid}/roles/{orgId} = {
  role: "owner" | "headcoach" | "assistantcoach" | "manager" | "staff" | "parent",
  teamId: string | null,              // null for owner/manager (org-wide), teamId for coaches/staff/parent
  grantedByUid: string,
  grantedAt: string,                  // ISO timestamp
  status: "active" | "pending_conflict",  // pending_conflict = accepted HC invite but HC already exists
  removedAt: string | null,           // null = active; set on soft-removal
  removedBy: string | null,           // uid of user who performed the removal

  // Gate 5b — explicit permission flags. Computed from role at creation via
  // defaultPermissions(role) in roles.js. Individual flags grantable by owner/HC.
  permissions: {
    scorebook:    boolean,  // Scorebook tab visible + can score games
    roster:       boolean,  // Add/edit/remove players on assigned team
    schedule:     boolean,  // Create/edit scheduled games + tournaments
    members:      boolean,  // Invite/remove team members
    documents:    boolean,  // View + verify player document uploads (Doc Vault)
    tasks:        boolean,  // Create + assign compliance tasks
    compliance:   boolean,  // Org-wide compliance dashboard
    reports:      boolean,  // Generate PDF/JSON exports
    messaging:    boolean,  // Team group chat + direct messages
    financials:   boolean,  // Financial records (future)
    equipment:    boolean,  // Jersey registry + equipment management (future)
    seasonConfig: boolean,  // Configure season settings (future)
    orgSettings:  boolean,  // Modify org profile + global settings (future)
    // billing — never stored; always derived from role === "owner"
  }
}
```

Denormalized mirror doc (written alongside every role write, enables member list queries):
```
orgs/{orgId}/members/{uid} = { uid, displayName, email, photoURL, ...same fields as role doc }
```

`defaultPermissions(role)` in `src/utils/roles.js` is the single source of truth for which flags are `true` by default for each role. See `IMPLEMENTATION_STATUS.md §Gate 5b` for the full default matrix.

### 2.5 Auth Strategy — Dual Mode (Permanent)

Two parallel modes coexist forever. Neither is deprecated.

| Mode | Identity | Sync | Role System | Transfer Codes |
|---|---|---|---|---|
| **Anonymous** | Device UID | Transfer codes only | None — solo mode | Active |
| **Authenticated** | Google UID | Automatic, all devices | Full role + invite system | Available as fallback |

**Account linking flow (anonymous → Google):**
1. Settings → "Sign in with Google"
2. Google OAuth completes
3. Firebase links Google credential to existing anonymous UID — UID preserved, data unchanged
4. User now has persistent identity across all devices

**New device sign-in (post-OAuth):**
1. Open app → "Sign in with Google"
2. Same Google account → same UID → Firestore syncs automatically
3. No transfer code needed

**`storage.js` routing logic:**
```
If user has no org role:
  → users/{uid}/data/db     (personal path)

If user has an org role:
  → orgs/{orgId}/data/db    (org path, shared with role members)
```

One-time data migration copies personal data to org path when user first joins or creates an org. Personal path becomes a tombstone.

### 2.6 Core `db` Schema

The `db` object shape is identical for both personal and org paths. Phase 2 adds new top-level collections alongside it but does not change the `db` shape.

```js
db = {
  tournaments:     Tournament[],
  organizations:   Organization[],
  players:         Player[],
  teams:           Team[],
  scheduledGames:  ScheduledGame[],
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
  createdByOrgId:   string | null,    // nullable — becomes operator ID in tournament organizer mode
}
```

#### `organizations[]`
```js
{
  id:   string,
  name: string,
}
```

#### `players[]` (local db — not the top-level Firestore player entity)
```js
{
  id:        string,
  orgId:     string,
  name:      string,
  createdAt: string,
}
```
> Jersey number lives on team roster, not on the player. See `teams[].roster`.

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

#### `scheduledGames[]`
```js
{
  id:            string,
  orgId:         string,
  homeTeamId:    string,
  awayTeamId:    string | null,
  opponent:      string,
  gameDate:      string,           // YYYY-MM-DD
  location:      string,
  tournamentId:  string | null,
  status:        "scheduled" | "live" | "final",
  phase:         "pool" | "bracket" | null,
  bracketName:   string | null,
  round:         string | null,
}
```

#### `scorebookGames[]`
```js
{
  id:               string,
  scheduledGameId:  string | null,
  teamId:           string,
  orgId:            string,
  opponent:         string,
  gameDate:         string,
  tournamentId:     string | null,
  phase:            "pool" | "bracket" | null,
  bracketName:      string | null,
  round:            string | null,
  roster:           [{ playerId, jerseyNumber, name }],  // point-in-time snapshot
  events:           Event[],
  format:           GameFormat,
  status:           "live" | "finalized",
  createdAt:        string,
  finalizedAt:      string | null,
  generatedGameIds: string[],
}
```

#### `game.format` schema
```js
{
  periodType:            "half" | "quarter",   // default: "half"
  periods:               number,               // auto-set: half=2, quarter=4
  doubleBonusFoulLimit:  number,               // default: 10. Primary bonus threshold.
  singleBonusEnabled:    boolean,              // default: false. Legacy leagues only.
  singleBonusFoulLimit:  number | null,        // only set when singleBonusEnabled
  foulResetPeriod:       "half" | "quarter",   // default: "half"
  foulsToDisqualify:     number,               // default: 5
  timeoutsPerHalf:       number,               // default: 4
  // Deprecated (backward compat reads only):
  homeTimeouts:          number,               // → replaced by timeoutsPerHalf
  awayTimeouts:          number,               // → replaced by timeoutsPerHalf
  bonusThreshold:        number,               // → replaced by doubleBonusFoulLimit
}
```

#### `games[]` — Individual Tracker
```js
{
  id:              string,
  playerId:        string,
  teamId:          string | null,
  tournamentId:    string | null,
  gameDate:        string,
  opponent:        string,
  stats:           Stats,
  points:          number,
  source:          "manual" | "scorebook",
  scorebookGameId: string | null,
  phase:           "pool" | "bracket" | null,
  bracketName:     string | null,
  round:           string | null,
}
```

#### Stat event schema (inside `scorebookGame.events[]`)
```js
{
  // ...existing fields...
  gameClockTime: string | null,   // e.g. "6:24" — null if clock was stopped at entry
  clockSynced:   false,           // always false in Phase 2; reserved for Phase 3 camera sync
}
```

### 2.7 Firestore Top-Level Collections (Phase 2 Additions)

```
/users/{uid}/
  profile: {
    displayName: string,
    email: string,
    photoURL: string,
    createdAt: string
  }
  roles/
    {orgId}: {
      role: string,
      teamId: string | null,
      grantedByUid: string,
      grantedAt: string
    }
  data/
    db: { ...db shape... }   // personal path

/orgs/{orgId}/
  profile: {
    name: string,
    ownerUid: string,
    createdAt: string,
    billingTier: "free" | "coach_pro" | "org_basic" | "org_standard" | "org_elite",
    billingStatus: "active" | "past_due" | "canceled",
    grandfathered: boolean,
    grandfatheredReason: string | null,
    grandfatheredAt: timestamp | null,
    seasonConfig: { ... }    // see §3.12
  }
  data/
    db: { ...db shape... }   // org-shared path

/players/{playerId}/
  profile: {
    name: string,
    birthYear: number,
    createdAt: string,
    createdByUid: string,
    eligibilityStatus: "eligible" | "pending" | "ineligible",
    dateOfBirth: timestamp,
    gradYear: string,
    tournamentReady: boolean   // computed at read time
  }
  linkedAccounts: [
    {
      uid: string,
      relationship: "self" | "parent" | "guardian",
      approvedAt: string,
      approvedBy: string
    }
  ]
  memberships: [
    {
      orgId: string,
      teamId: string,
      season: string,           // e.g. "2025-2026"
      status: "active" | "archived",
      joinedAt: string,
      archivedAt: string | null
    }
  ]
  documents/{docType}           // see Document Vault §3.8

/coaches/{coachId}/
  profile: {
    name: string,
    createdAt: string,
    linkedUid: string | null
  }
  memberships: [
    {
      orgId: string,
      teamId: string,
      role: "headcoach" | "assistantcoach",
      season: string,
      status: "active" | "archived"
    }
  ]

/invites/{token}/
  {
    orgId: string,
    teamId: string,
    role: "headcoach" | "assistantcoach",
    createdByUid: string,
    createdAt: string,
    expiresAt: string,       // 48-hour TTL
    usedAt: string | null,
    usedByUid: string | null
  }

/joinCodes/{code}/
  {
    orgId: string,
    teamId: string,
    role: "parent",
    createdByUid: string,
    createdAt: string,
    expiresAt: string | null  // null = season-long
  }

/claimCodes/{code}/
  {
    playerId: string,
    orgId: string,
    teamId: string,
    createdByUid: string,
    createdAt: string,
    usedAt: string | null,
    usedByUid: string | null,
    relationship: "self" | "parent" | "guardian" | null,
    approvedAt: string | null,
    approvedByUid: string | null
  }

/gameLocks/{gameId}/
  {
    lockedByUid: string,
    lockedByName: string,
    lockedAt: string,
    lastActivity: string,    // updated on every stat entry (300ms debounce)
    teamId: string,
    orgId: string
  }

/scorekeeperAssignments/{gameId}/
  {
    assignedUid: string,
    assignedByUid: string,
    assignedAt: string,
    teamId: string,
    orgId: string
  }

/transferCodes/{code}/
  {
    uid: string,
    createdAt: string,
    expiresAt: string         // 10-minute TTL
  }
```

#### Phase 3+ Collections (schema defined, not yet implemented)

| Collection | Full Schema | Phase |
|---|---|---|
| `conversations/{conversationId}` | see §3.20 | Phase 3, Gate 8 |
| `conversations/{conversationId}/messages/{messageId}` | see §3.20 | Phase 3, Gate 8 |
| `users/{uid}/calendarSubscriptions/{teamId}` | see §3.20 | Phase 3, Gate 8 |
| `orgs/{orgId}/teams/{teamId}/calendarEvents/{eventId}` | see §3.20 | Phase 3, Gate 8 |
| `tasks/{taskId}` | see §3.9 | Phase 2, post-Gate 7 |
| `verificationLog/{playerId}/{docType}` | see §3.8 | Phase 2, Gate 7 |
| `orgs/{orgId}/jerseyRegistry/` | see §3.11 | Phase 2, post-Gate 5 |
| `users/{uid}/profile` | see §2.7 top-level definition above | Gate 7+ — not yet written by any code |

### 2.8 Firestore Security Rules (Logical)

```
// Org data — readable by any member with a role in that org
/orgs/{orgId}/**
  read:  user has any role in orgId
  write: user is headcoach or above in orgId, OR superadmin

/orgs/{orgId}/data/db
  read:  user has any role in orgId
  write: user has permissions.scorebook == true on their member doc (Gate 5b),
         OR role is owner/headcoach/assistantcoach (legacy fallback for pre-5b docs),
         OR superadmin

// Player profiles
/players/{playerId}
  read:  uid is in linkedAccounts[], OR coach/owner in any of player's orgs, OR superadmin
  write: uid is in linkedAccounts[] (own data only), OR headcoach or above in player's org, OR superadmin

// Coach profiles
/coaches/{coachId}
  read:  uid === linkedUid, OR org owner in any of coach's orgs, OR superadmin
  write: uid === linkedUid (own data only), OR headcoach or above, OR superadmin

// Claim codes — link acts as auth
/claimCodes/{code}
  read:  always
  write: headcoach or above (create), system (mark used)

// Game locks
/gameLocks/{gameId}
  read:  user has any role in the game's orgId
  write: assigned scorekeeper (claim/update), OR headcoach or above (break), OR superadmin

// Scorekeeper assignments
/scorekeeperAssignments/{gameId}
  read:  user has any role in the game's orgId
  write: headcoach or above in the game's orgId, OR superadmin

// Invites — link acts as auth
/invites/{token}
  read:  always
  write: headcoach or above (create), system (mark used)

// Join codes
/joinCodes/{code}
  read:  always
  write: headcoach or above (create/delete)

// User data — private
/users/{uid}/**
  read:  uid === request.auth.uid, OR superadmin
  write: uid === request.auth.uid, OR superadmin
```

**Superadmin check (in rules):**
```javascript
function isSuperadmin() {
  return request.auth.token.superadmin == true;
}
```

### 2.9 Navigation Structure

#### End-State Navigation Model (Target: Gate 7.5)

The app uses a **three-tab bottom nav** with a **persistent team context pill** at the top of the screen and a **slide-in sidebar** for context switching, secondary navigation, and low-frequency features.

##### Bottom Tabs (universal — all roles)

| Tab | Contents |
|---|---|
| **Chat** | Team and org communications — group channels, DMs, org announcements |
| **Schedule** | Team calendar, upcoming games, events |
| **Stats** | Scorebook (live scoring), game history, individual and team stat views |

These three tabs represent the highest-frequency actions for every role. They are always visible regardless of which team context is active.

##### Team Context Pill

A persistent pill is pinned at the top of the screen, above all content, and remains fixed during vertical scroll. It displays the currently active team name. Tapping the pill opens the sidebar.

```
[ 🏀 Eagles 6U  ▾ ]
```

The pill is always visible. It is the single entry point into the sidebar. It communicates team context at a glance for coaches, parents, and scorekeepers regardless of which tab is active.

##### Sidebar Structure

The sidebar slides in from the left when the team context pill is tapped. It contains:

1. **Team switcher dropdown** — at the top of the sidebar. Selecting a different team closes the dropdown and updates the active team context throughout the entire app (all three tabs scope to the new selection). The pill label updates to reflect the active team.

2. **ORG section** — pinned at the top of the channel list, always visible regardless of which team is selected. Contains org-scoped channels and announcements. Visibility of individual items within this section is filtered by the user's permissions.

3. **TEAM section** — scoped to the currently active team. Contains team-specific channels and direct messages.

4. **Role-scoped secondary navigation** — below the channel list. Items visible here differ by role (see below).

5. **Settings** — always present at the bottom of the sidebar.

##### Sidebar Content by Role

**Parent:**
```
[ Eagles 6U ▾ ]                    ← team switcher (shows child badge if multiple children)
─────────────────────────────────
ORG
  📢 Announcements                 ← read-only; posted by owner
  [any org channels user was added to]
─────────────────────────────────
TEAM — Eagles 6U
  💬 Team Chat
  [any custom team channels user was added to]
─────────────────────────────────
DIRECT MESSAGES
  Coach Rivera
─────────────────────────────────
MY CHILD
  Jake's Profile
─────────────────────────────────
ACCOUNT
  Payments & Registration
  Waivers & Documents
  Settings
```

**Coach (Head Coach / Assistant Coach / Manager / Staff):**
```
[ Eagles 6U ▾ ]
─────────────────────────────────
ORG
  📢 Announcements                 ← read-only unless owner
  [any org channels coach was added to, e.g. "Head Coaches"]
─────────────────────────────────
TEAM — Eagles 6U
  💬 Team Chat
  [custom team channels this coach created or was added to]
─────────────────────────────────
DIRECT MESSAGES
  Jake's Mom
  Sophie's Dad
─────────────────────────────────
MANAGE TEAM
  Roster
  Schedule
  Members
  Permissions
─────────────────────────────────
REPORTS & EXPORTS
─────────────────────────────────
SETTINGS
```

**Org Owner:**
```
[ Eagles 6U ▾ ]                    ← team switcher includes all org teams
─────────────────────────────────
ORG
  📢 Announcements                 ← owner can post here
  🏆 Head Coaches                  ← owner-created custom channel
  [any other custom org channels]
  + New Org Channel                ← owner only
─────────────────────────────────
TEAM — Eagles 6U
  💬 Team Chat
  [custom team channels]
  + New Team Channel               ← head coach or above
─────────────────────────────────
DIRECT MESSAGES
  ...
─────────────────────────────────
MANAGE TEAM
  Roster / Schedule / Members / Permissions
─────────────────────────────────
ORG SETTINGS
  Billing
  Org-Level Member Management
  Org Announcements (compose)
─────────────────────────────────
REPORTS & EXPORTS
─────────────────────────────────
SETTINGS
```

##### Team Context Switcher — Dropdown Detail

The dropdown lists all teams the user is a member of. For parents with multiple children, each entry shows a child badge:

```
Coach view:
  Eagles 6U
  Wildcats JV
  Lincoln Varsity

Parent view:
  Eagles 6U      (Jake, Emma)
  Wildcats Travel (Sophie)
```

The app persists the last selected team in localStorage and restores it on next launch.

##### ORG Section Visibility Rules

- The ORG section is **always present** in the sidebar regardless of which team is active in the switcher. There is no separate "org context" to switch to.
- Each item in the ORG section is only visible to users who have been added to that channel, or who have org-level permissions.
- A parent who has no org-level channel membership sees only `📢 Announcements` in the ORG section.
- A head coach added to an org-level "Head Coaches" channel sees that channel in the ORG section from any team context.
- The org owner sees all org channels and a `+ New Org Channel` control.
- There is no UI concept of "switching to the org." The org is a persistent section, not a navigable context.

##### Current Navigation (Pre-Gate 7.5)

Until Gate 7.5 ships, the existing 5-tab bottom nav remains in place:

| Tab | Current label |
|---|---|
| Track | Track |
| Scorebook | Scorebook |
| History | History |
| Reports | Reports |
| Manage | Manage |

The Gate 7.5 restructure replaces this entirely. Do not partially migrate tabs — the shell restructure is an atomic change.

### 2.10 Visual Style Reference

```js
// Colors (from constants.js)
T.bg      = "#0a0a0f"                    // page background
T.card    = "rgba(255,255,255,0.04)"     // card background
T.border  = "rgba(255,255,255,0.08)"     // card border
T.orange  = "#f97316"                    // primary accent, CTAs, jersey numbers
T.green   = "#22c55e"                    // positive stats, success
T.blue    = "#3b82f6"                    // informational
T.red     = "#ef4444"                    // errors, fouls, danger
// Text: primary #ffffff  secondary #888888  muted #444444
// Border radius: 12px cards, 8–10px buttons/inputs, 20px pills
// Fonts: DM Sans (body), DM Mono (numbers, scores, jersey numbers)
// Section labels: 10px, weight 700, letter-spacing 0.08em, uppercase, color #555
```

> **Modal pattern:** Do not use `position: fixed`. Use a faux viewport: wrapper div with `minHeight`, `flex`, `alignItems: center`, `background: rgba(0,0,0,0.85)`.

### 2.12 Player-Primary Sport-Agnostic Schema

**Canonical reference:** `PLAYER_ENTITY_SCHEMA.md` supersedes any prior schema definitions that treat orgs or teams as the owner of player identity or stat history. All Gate 7+ implementation must conform to that document.

**Locked architectural principles (do not revisit):**

- **Player is the primary entity.** Orgs and teams are organizational contexts — they do not own player identity or stat history.
- **Stats are permanently owned by the player.** Game records live under `players/{playerId}/stats/{sport}/games/`. Org and team are immutable metadata tags, not the storage hierarchy. Stats survive org deletion, expiry, or any number of player transfers.
- **Sport lives on the team.** Each team has exactly one sport. Orgs can have multi-sport teams.
- **Sport templates are defined by superadmin.** Org owners pick one template per team at creation. Templates are not editable by orgs. This drives the scorebook engine — no sport-specific logic is hardcoded.
- **Memberships are temporal.** A membership record represents one player's relationship to one team in one season. Archived, never deleted. Career history is the full membership chain.
- **Sub-orgs are child orgs.** Players hold a membership at the org level and are assigned to a sub-org and team beneath it.
- **Verified vs. self-reported is permanent and immutable.** Player controls public visibility, not the verified flag itself.

**New top-level collections introduced in Gate 7+:**

| Collection | Purpose | Gate |
|---|---|---|
| `/sportTemplates/{sport}` | Superadmin-defined stat definitions and format defaults | Gate 7 prep |
| `/players/{playerId}/stats/{sport}/games/{gameId}` | Permanent player stat records | Gate 7 |
| `/players/{playerId}/memberships/{membershipId}` | Temporal team/org relationships | Gate 7 |
| `/players/{playerId}/documents/{docType}` | Birth certs, waivers — Firebase Storage backed | Gate 7 |
| `/orgs/{orgId}/subOrgs/{subOrgId}` | Child org units (schema prep) | Gate 7.5 |

**Migration strategy (Gate 7):** Historical game records in `orgs/{orgId}/data/db` are not migrated immediately. New games finalized after Gate 7 write stat records to both the player entity (new) and retain the scorebook game under the team (unchanged). Historical backfill is a one-time post-Gate-7 script, not a Gate 7 deliverable.

---

## 3. Feature Specifications

### 3.1 Scorebook

#### Core Behavior (Locked)
- Event-sourced: tap-to-record only. No miss buttons. Undo via event log delete.
- Autosave: 300ms debounce for roster/manage edits; 45s during live games. localStorage written immediately on every change as crash-safe backup.
- Live game publishing: all player stats are pre-derived from the full event log on the tablet and published as `playerStats[]`. The `events` field in the live doc contains only the last 50 events for the play-by-play feed. `LiveGameView` consumes `playerStats[]` directly — never re-derives from the truncated event slice.
- Period-aware foul and timeout derivation — counts reset correctly per `foulResetPeriod` setting.
- Jersey override per game (from GameSetup, overrides team roster default).

#### Scorebook UI Layout
```
┌──────────────────────────────────────────────────────┐
│  Q2          6:24  ▶ / ■        [Edit]               │  ← GameClock bar (Phase 2 Gate 6)
├──────────────────────────────────────────────────────┤
│  GameHeader (score, period, foul/timeout stats row)  │
├──────────────────────────────────────────────────────┤
│  Player rows (FlashButton stat entry)                │
├──────────────────────────────────────────────────────┤
│  OpponentStrip (+2, +3, +1, Foul, Tech, T/O)         │
└──────────────────────────────────────────────────────┘
```

#### GameHeader Stats Row
```
[ Home fouls ] [ Home TO left ] | [ Opp fouls ] [ Opp TO left ]
[ badge slot ]                  | [ badge slot ]
```
Bonus badge logic:
```js
if (fouls >= format.doubleBonusFoulLimit)     → "DBL BONUS" (red)
else if (singleBonusEnabled && fouls >= singleBonusFoulLimit) → "BONUS" (orange)
else                                          → empty placeholder (fixed height — no layout shift)
```

#### Period Selector
- Tappable pill in header → expands inline panel (not a modal)
- Pills: visited (grey), current (orange), future (dark/disabled)
- Fires `period_change` event on tap
- Navigating backward does not re-reset foul counts — counts always derived from filtered events

#### `scorebookEngine.js` signatures
```js
deriveTeamStats(events, format, displayPeriod)
deriveTimeouts(events, format, displayPeriod)
```
Foul group logic:
```js
const halfSize = Math.floor(format.periods / 2);
const foulGroup = format.foulResetPeriod === "quarter"
  ? displayPeriod
  : (displayPeriod <= halfSize ? 1 : 2);
```

### 3.2 Game Clock (Phase 2, Gate 6)

- Countdown clock displayed at top of Scorebook screen
- Counts down from configurable period length (set before game or at period break)
- Manual start/stop toggle
- Edit mode: inline nudge buttons (+10s, -10s, +1s, -1s) — clock auto-pauses on open, resumes on Done
- No number-pad entry — nudge-only for one-handed operation during live play
- `gameClockTime` (string, e.g. `"6:24"`) attached to each stat event. `null` if clock was stopped.
- Component: `src/components/scorebook/GameClock.jsx`
- Props: `periodLength` (seconds), `onTickWithTime(timeString)` callback

### 3.3 Game Locking System (Phase 2, Gate 5)

**Lock lifecycle:**
```
Unstarted
  → [Assigned scorekeeper taps "Start Keeping Score" + confirms]
  → Locked / Active
      → [Every stat entry updates lastActivity]
      → [lastActivity stale > 15 min] → Auto-released
      → [Head Coach or above taps "Break Lock" + confirms] → Force-released
  → Released → Available to claim again
```

**Lock rules:**
- Only assigned Scorekeeper (or Head Coach, Org Owner, Superadmin) can claim
- Once locked, no other user can enter stats regardless of role
- `lastActivity` updated on every stat entry (same 300ms debounce as autosave)
- Inactivity timeout: 15 minutes

**Lock display (all users during active game):**
```
🔒 Being scored by [Display Name]   [Break Lock — Head Coach+ only]
```

**Force-break flow (Head Coach+):**
1. Confirmation dialog: *"This will end [Name]'s scoring session. They will be notified. Continue?"*
2. On confirm: lock document deleted, in-app alert sent to displaced scorekeeper
3. Head Coach can immediately reassign or claim themselves

**Live read during active game:**
All users with team access receive real-time updates via `onSnapshot` listener:
- Live score, running box score, read-only event log (reverse chronological)

### 3.4 Player Profile System (Phase 2, Gate 7)

**Design philosophy:** All people are first-class entities. Profiles exist independently of any org or team. Membership is a relationship record, not ownership. Career stats accumulate across all seasons and orgs.

**Player lifecycle:**
```
Coach creates anonymous player entity (name, jersey, team)
    ↓
Coach generates claim link → /claimCodes/{code}
    ↓
Parent/player opens link → Google OAuth → selects relationship
    ↓
Coach receives notification → approves link
    ↓
UID permanently bound to player entity
    ↓ (automatic on approval)
User added to team group chat memberUids
User added to team calendar subscription
Push notification: "You've been added to [Team Name]"
```

**On team/org transfer:**
- Within org: new coach inherits verified compliance status; team-level tasks do not transfer; new team's active tasks auto-apply
- Between orgs: open question (see §7)

**End-of-season archiving:**
- `memberships[]` entries marked `status: "archived"` — player entity and stats remain intact
- New season = new membership record appended to same player entity
- Career stats accumulate naturally

**Multiple linked accounts:** A parent account can be linked to multiple player entities (multiple children). Each link goes through the same coach-approval flow.

**Claim code rules:**
- Multiple Google accounts can link to one player (player + family members)
- Removing a player from a team does not break the account link
- Anonymous users cannot claim a profile — Google account required
- Org owners can generate a claim code at any time, including post-season

### 3.5 Invitation & Join Code Flows

#### Coach Invite (Head Coach or above → new coach)
- One-time-use link with 48-hour TTL
- Manage → Team → Members → "Add Coach" → select role (Head Coach / Assistant Coach)
- App generates token, writes to `/invites/{token}`
- Shareable link: `wetrack.app/invite/{token}`
- Acceptance: open link → Google sign-in → role written to `users/{uid}/roles/{orgId}` → token marked used → user lands in app with team context

#### Parent Join Code (reusable, season-long)
- 6-character alphanumeric code, reusable until regenerated
- Manage → Team → Members → "Parent Join Code" → display + QR
- Regenerating invalidates old code
- Parent usage: Settings → "Join a Team" → enter code
- Anonymous users prompted to sign in with Google at this point (the only required sign-in gate)
- On sign-in: `parent` role written, team context loaded

#### Player Claim Code
- Manage → Roster → [Player] → "Generate Claim Link"
- Shareable link: `wetrack.app/claim/{code}`
- Can be regenerated at any time (supports post-season late claiming)
- See §3.4 for full flow

### 3.6 Welcome Screen & Onboarding (Phase 2, Gate 8)

**Two permanent user tiers:**

| Tier | Auth | Access | Data |
|---|---|---|---|
| **Solo / Anonymous** | None required | Track + personal History/Reports | Stored in own Firebase path |
| **Team Member** | Google OAuth | All above + team data, live scorebook, communication | Personal stats separate from official |

**First-launch flow:**
1. App detects auth state
2. No prior auth → show Welcome Screen
3. Welcome Screen: "Get Started" (anonymous) or "Sign in with Google" (team-enabled)
4. Returning users skip Welcome Screen entirely
5. "Get Started" is always available — Google sign-in never forced at this stage

**Transition moment (anonymous → team join):**
> *"Your personally tracked games are still in My Stats. Official team records are separate and managed by your team's scorekeeper."*

### 3.7 My Stats vs Official Stats

**Three data buckets:**

| Type | Source | Editable By | Visible To |
|---|---|---|---|
| **Personal tracked stats** | User's tap input | User only | User only |
| **Official team stats** | Locked Scorebook | Scorekeeper + coaches | All team members (read) |
| **Team stats (read-only)** | Official record | No one at this level | Parents, players |

**Toggle behavior:**
- Appears at top of History and Reports when user has both personal and team data
- Default: Official Stats for team-role users; My Stats for solo/anonymous users (no toggle shown)
- The two views are never mixed without explicit labeling

**Game card indicators:**
- 🏀 Personal icon → personal tracked game
- 🏆 Team badge → official team game

### 3.8 Document Vault

**Availability:** Org Standard ($39.99/mo) and Org Elite tiers only.

**Supported document types (initial):**
- Birth certificate (permanent — verified once, persists unless player transfers orgs)
- Grade report (season-scoped — resets each season via season rollover)
- Physical clearance (one-time, calendar expiration)
- Custom documents (coach or org admin defined)

**Document schema:**
```
players/{playerId}/documents/{docType} {
  uploadedBy: parentUid,
  uploadedAt: timestamp,
  fileUrl: string,                   // Firebase Storage path
  
  status: "pending" | "verified" | "rejected",
  verifiedBy: coachUid,
  verifiedAt: timestamp,
  verificationMethod: "manual" | "ai_assisted",
  
  checksCompleted: {
    nameMatch: boolean,
    dobMatch: boolean,
    documentValid: boolean
  },
  checklistConfirmedBy: coachUid,
  checklistConfirmedAt: timestamp,
  
  rejectionReason: string | null,
  expiresAt: timestamp | null,       // for physicals, etc.
  
  // AI fields — null until Phase 3
  aiPrecheck: {
    extractedName: null,
    extractedDob: null,
    confidence: null,
    checkedAt: null,
    modelVersion: null
  }
}
```

**Firebase Storage path:**
```
/orgs/{orgId}/players/{playerId}/documents/{docType}/{timestamp}.jpg
```

**Storage security rules:**

> **Note:** The helper functions `isOrgCoach()`, `isOrgAdmin()`, and `isPlayerParent()` are not yet implemented in `firestore.rules`. These are Phase 3 rules that will be added when Document Vault is built.

```javascript
match /orgs/{orgId}/players/{playerId}/documents/{allPaths=**} {
  allow read: if isOrgCoach(orgId) || isOrgAdmin(orgId) || isPlayerParent(playerId);
  allow write: if isPlayerParent(playerId) && isValidDocumentUpload();
  allow delete: if isOrgAdmin(orgId) || isPlayerParent(playerId);
}
```

**Verification UI (Phase 1 — manual):**
```
[Document Image — tap to zoom]

Player Profile
──────────────
Name on file:  Devon Shamar Smith
DOB on file:   March 3, 2014

Verification Checklist
──────────────────────
[ ] Full name on document matches profile
[ ] Date of birth matches profile
[ ] Document appears valid and unaltered

↑ All three required to enable Verify button

[ Verify ]   [ Reject ]
    └── Reject reason required:
        ○ Image too blurry
        ○ Document cut off
        ○ Wrong document type
        ○ Name doesn't match
        ○ DOB doesn't match
```

**Phase 2 — AI-assisted verification (future):**
- Claude Vision API called via Firebase Function on upload
- Extracts name and DOB, compares to player profile
- Pre-fills checklist items on high-confidence match
- Coach still visually reviews and confirms
- `verificationMethod` logged as `"ai_assisted"`

**Firebase Function scaffold (Phase 1 stub, ready for Phase 2):**
```javascript
exports.onDocumentUploaded = functions.firestore
  .document('players/{playerId}/documents/{docType}')
  .onCreate(async (snap, context) => {
    // Phase 1: notify coach
    await notifyCoachForVerification(
      context.params.playerId,
      context.params.docType
    );
    // Phase 2: uncomment when ready
    // const aiResult = await runAiPrecheck(...);
    // await snap.ref.update({ aiPrecheck: aiResult });
  });
```

**Audit trail:**
```
verificationLog/{playerId}/{docType} {
  uploadedBy: parentUid,
  uploadedAt: timestamp,
  aiPrecheck: (Phase 2),
  verifiedBy: coachUid,
  verifiedAt: timestamp,
  checklistConfirmed: boolean,
  method: "manual" | "ai_assisted"
}
```

### 3.9 Task & To-Do System

**Two-layer architecture:**

**Org-Level Tasks** — owned by org admin, apply org-wide:
- Birth certificate upload, grade report upload, academic eligibility verification
- Season-reset tasks, exceptions granted by org admin with audit log

**Team-Level Tasks** — owned by coach, apply to specific team only:
- Tournament waivers, team-specific signups, equipment requirements, jersey size survey

**Task schema:**
```
tasks/{taskId} {
  orgId: string,
  teamId: string | null,          // null for org-scope tasks
  createdBy: coachUid | orgAdminUid,
  assignedTo: "player" | "parent" | "both",
  scope: "individual" | "team" | "org",
  taskCategory: "system" | "custom",
  taskType: "document_upload" | "external_link" | "acknowledgement" | "form",
  
  title: string,
  description: string,
  externalUrl: string | null,
  requiresUpload: boolean,
  requiresVerification: boolean,
  
  dueDate: timestamp | null,
  expiresAt: timestamp | null,
  
  taskPersistence: "season" | "permanent" | "one_time",
  
  status: "active" | "expired" | "archived",
  autoApplyToNewMembers: boolean
}
```

**Auto-apply logic (when player joins team):**
```
Query team tasks where:
  status == "active"
  expiresAt > now() OR no expiration
  autoApplyToNewMembers == true
→ Fan out to new player only
→ Skip expired tasks
```

**Task persistence types:**
- `permanent` — birth certificate (verified once; does not reset on season rollover)
- `season` — grade report (resets each season on org admin action)
- `one_time` — tournament waivers, specific events (expires after event)

**Season rollover (org admin action):**
```
Org Admin → Start New Season
  → Set season dates, grade requirements, GPA minimums
  → System resets "season" tasks to pending for all players
  → Permanent tasks remain verified
  → One-time tasks stay archived
  → All coaches notified
  → All parents get startup task banner
```

**Eligibility exception grant:**
```
playerCompliance/{playerId}/exceptions/{exceptionId} {
  grantedBy: orgAdminUid,
  grantedAt: timestamp,
  documentType: "birthCertificate",
  reason: string,
  expiresAt: timestamp | null,
  status: "active" | "expired" | "revoked"
}
```
- Org admin: can grant, revoke, see all exceptions
- Coach: can see exceptions for their players, cannot grant/revoke
- Parent: sees "Eligibility approved by org admin" only

### 3.10 Tournament Readiness

Lives within Player/Roster Management — not a separate feature area.

**Player compliance fields (on player entity):**
```
players/{playerId} {
  eligibilityStatus: "eligible" | "pending" | "ineligible",
  dateOfBirth: timestamp,
  gradYear: string,
  tournamentReady: boolean  // computed at read time
}
```
`tournamentReady` = true only when all required org documents are verified AND all active team tasks with a due date are complete.

**Roster compliance view (Coach):**
```
Team Roster — Tournament Ready

  ✅ Marcus J.    — Birth cert verified, grade report verified
  ⚠️  Devon S.    — Grade report pending
  ❌ Aaliyah T.  — Birth cert missing
  ❌ Jordan M.   — Jersey not assigned
```

**Org tournament readiness dashboard:**
```
Org Tournament Readiness — [Season]

  8U Team A   — 12/12 players ready  ✅
  10U Team B  —  8/10 players ready  ⚠️
  12U Team C  —  5/12 players ready  ❌

  [ Export Eligibility Report ]
```

### 3.11 Jersey Number Management

**Rules:**
- One number per player per org
- No two players in the same org share a number
- Coach assigns at team level; system validates against org-wide registry in real time

**Firestore structure:**
```
orgs/{orgId}/jerseyRegistry/ {
  "23": playerId,
  "11": playerId,
  "4":  playerId
}
```

**Assignment flow:**
```
Coach enters jersey number
  → Query org jerseyRegistry
  → Available → assigned, registry updated
  → Taken → "Number 23 is assigned to Marcus J. on 12U Team A — choose another"
```

**On transfer:**
- Player's number freed from old team (or old org)
- Coach of new team assigns/requests number
- Registry updated accordingly

### 3.12 Season Configuration (Org Level)

```
orgs/{orgId}/seasonConfig/ {
  currentSeason: "2025-2026",
  seasonStartDate: timestamp,
  seasonEndDate: timestamp,
  requiredDocuments: [
    {
      type: "gradeReport",
      persistence: "season",
      minimumGpa: 2.0,
      gradeLevel: null         // null = all grades
    },
    {
      type: "birthCertificate",
      persistence: "permanent"
    }
  ]
}
```

### 3.13 Multi-Team / Multi-Player Context Switching

**Context hierarchy:**
```
Team Selector → Player Selector → All screens scope to selection
```

- Single team: Team Selector hidden
- Multiple teams: persistent header dropdown or pill row
- History, Reports, and Communication all filter from active selection
- App remembers last selected team and player between sessions (localStorage)
- Role and permissions change based on which team is active

### 3.14 PWA Install UX (Phase 2, Gate 8)

**Android:**
- Capture `beforeinstallprompt` event, suppress auto-fire
- Show dismissable install banner on first launch
- Tapping banner triggers native Android install dialog
- Persistent "Install App" option in Settings

**iOS:**
- One-time visual guide modal: Share button → "Add to Home Screen"
- Shown once, dismissable, accessible from Settings afterwards

**Long-term (deferred):** Bubblewrap for proper Google Play Store listing.

---

## 4. Communication Features (Post–Phase 2)

> **Prerequisites before any communication work begins:**
> - Google OAuth — Coach ✅ (complete as of Gate 1/2)
> - Parent/Player invite + verification flow (Gate 3/4)
> - Coach approval of player/parent account link (Gate 7)
> - `authUid` field on player entities (Gate 7)
> - Real role-based Firestore security rules (Gate 2, ongoing)

### 3.15 Design Philosophy

- **Team is the top-level context** for all communication — unifies coach and parent experience
- **One DM thread per user pair, ever** — deterministic ID, team context carried by message tags
- **Coaches are power users, parents are casual users** — same data, different UI
- **Enrollment is automatic** on coach approval of parent/player account link
- **No anonymous participation** — all communication requires a verified Google account

### 3.16 Access by Role

| Role | Group Chat | Direct Messages | Calendar |
|---|---|---|---|
| Org Admin | All teams in org | Anyone in org | All team calendars |
| Coach | Create + post in own teams | Message any player/parent across all their teams | Create + edit events for own teams |
| Player | Read + reply in own team chats | Receive DMs from coach only | View own team calendar |
| Parent | Read + reply in own team chats | Receive DMs from coach only | View + subscribe to child's team calendars |

**Key rules:**
- Parents and players cannot initiate DMs — coaches initiate all direct conversations
- Parents cannot message other parents; players cannot message other players
- Coach running multiple teams has unified cross-team access without context switching

### 3.17 Group Chat

Each team has exactly one group chat, created automatically when the team is created.

**Enrollment:**
- **Enroll:** Automatic on coach approval of player/parent account link
- **Remove:** Automatic on roster removal — write access revoked, read history preserved
- **Re-enroll:** Re-approval re-adds the user

**Deduplication:** If two siblings are on the same team, parent is enrolled once (deduplication by UID).

**Announcement-only:** Optional `allowReplies: false` flag per message or per conversation (decision pending — see §7).

### 3.18 Direct Messages

**One thread per user pair:**
```js
const dmId = [uid1, uid2].sort().join('_')
// Deterministic, collision-proof, no query needed for lookup
```

**Team context tagging (individual messages):**
```js
{
  senderUid: "uid_coach",
  text: "Practice moved to 6pm Friday",
  sentAt: timestamp,
  teamContext: "Eagles 6U"   // pre-selected to most recent shared team; user can change
}
```

**Coach initiates only.** Parents and players can only reply to threads a coach has opened.

### 3.19 Team Calendar

**Team calendar:** Owned by coach/org. Events are the single source of truth — subscribing parents see live updates, not copies.

**Personal calendar (parent view):** Aggregated view of all subscribed team calendars. Per-team color-coding. Toggle on/off per team.

**Event types:** `practice`, `game` (links to `scheduledGame`), `tournament` (links to `tournament`), `meeting`, `custom`

**Scheduled game integration:** When a `scheduledGame` is created in Manage, it automatically generates a corresponding calendar event. Updates propagate automatically (no double-entry).

**Subscription model:**
- Auto-subscribed on same approval event as group chat enrollment
- Toggle (on/off) without losing subscription
- Coaches see all their teams' calendars simultaneously by default

### 3.20 Communication Firestore Schema

**Conversations:**
```js
// Group chat
conversations/{conversationId} {
  type: "group",
  orgId: string,
  teamId: string | null,         // nullable — null for org-level channels
  name: string,
  allowReplies: boolean,
  memberUids: string[],
  members: [
    {
      uid: string,
      displayName: string,
      role: "coach" | "player" | "parent",
      teamName: string | null,
      playerName: string | null  // for parents: which child this membership is via
    }
  ],
  lastMessage: string,
  lastMessageAt: timestamp,
  createdBy: string,
  scope: "team" | "org",         // explicit scope indicator
  managedBy: string | null,      // UID of channel manager; null = self-removal allowed
  isSystemChannel: boolean,      // true for auto-created channels (team chat, announcements); false for custom
}

// Direct message
conversations/{uid1_uid2} {  // sorted UIDs joined by underscore
  type: "direct",
  memberUids: [uid1, uid2],
  members: [
    { uid: string, displayName: string, role: string, teamNames: string[] }
  ],
  lastMessage: string,
  lastMessageAt: timestamp
  // NO teamId — DMs are person-to-person
}
```

**Messages:**
```js
conversations/{conversationId}/messages/{messageId} {
  senderUid: string,
  senderName: string,           // denormalized
  text: string,
  sentAt: timestamp,
  teamContext: string | null,   // DMs only
  readBy: { [uid]: timestamp }  // read receipts
}
```

**Calendar events:**
```js
orgs/{orgId}/teams/{teamId}/calendarEvents/{eventId} {
  type: "practice" | "game" | "tournament" | "meeting" | "custom",
  title: string,
  startAt: timestamp,
  endAt: timestamp,
  location: string | null,
  notes: string | null,
  scheduledGameId: string | null,
  tournamentId: string | null,
  createdBy: string,
  updatedAt: timestamp
}
```

**Calendar subscriptions:**
```js
users/{uid}/calendarSubscriptions/{teamId} {
  teamId: string,
  teamName: string,          // denormalized
  orgId: string,
  color: string,             // hex — assigned on enrollment, user can override
  visible: boolean,          // default true
  subscribedAt: timestamp
}
```

**Standard query (same for coaches and parents):**
```js
db.collection('conversations')
  .where('memberUids', 'array-contains', currentUid)
  .orderBy('lastMessageAt', 'desc')
// type === "group" → Team Chats section
// type === "direct" → Direct Messages section
```

### 3.21 Communication UI Architecture

#### Team Context Pill + Sidebar (see §2.9)

The team context pill and sidebar are the primary navigation mechanism for all communication features. Communication does not have its own independent navigation — it is surfaced through the Chat tab (bottom nav) scoped to the active team context set via the sidebar.

#### Chat Tab — Layout by Role

**Parent (team-scoped view):**

When a parent opens the Chat tab, they see only what is relevant to the currently active team:

```
[ Eagles 6U ▾ ]                 ← team context pill (tap to switch teams)
─────────────────────────────────
ORG
  📢 Org Announcements

TEAM
  💬 Team Chat
  [any custom channels they are in]

DIRECT MESSAGES
  Coach Rivera
```

Switching teams via the pill updates this view entirely. Simple, uncluttered, no cross-team noise.

**Coach (unified view across teams):**

Coaches see the full sidebar channel list. They do not need to switch team context to see a DM — DMs appear in the sidebar regardless of which team is active. Team identifier labels on DM entries provide context at a glance.

```
DM label format:  Jake's Mom  •  Eagles 6U
```

#### Notification Badges

Unread message counts appear as red dot badges on:
- Individual channel rows in the sidebar
- The Chat tab in the bottom nav (aggregate across all channels)
- The team context pill (if there is unread activity in the inactive team context)

The pill badge ensures a parent or coach knows to switch team context without having to check manually.

#### FCM Notification Deep-Link Behavior

Unchanged from prior spec. Every FCM payload carries `conversationId`, `teamId`, and `type`. On notification tap:
- **Coach:** Opens directly to the relevant conversation. No context switch needed.
- **Parent:** App switches to the correct team context using `teamId`, then opens the conversation.

### 3.22 Custom Channels

#### Overview

In addition to the auto-created team group chat, coaches and org owners can create custom named channels with a curated member list. These channels behave identically to group chats in the data model — they are `type: "group"` conversations with a custom `name` and explicit `memberUids`. No new schema is required.

#### Scope

Custom channels are scoped to either the **org level** or a **team level**, determined by which field is set at creation:

| Scope | `orgId` | `teamId` | Who can create |
|---|---|---|---|
| Org-level | set | `null` | Org owner only |
| Team-level | set | set | Head coach or above (gated by `permissions.messaging`) |

Org-level channels appear in the **ORG section** of the sidebar for all members who have been added, regardless of which team is active in the switcher.

Team-level channels appear in the **TEAM section** of the sidebar, scoped to the active team context.

#### Creation Flow

- Owner taps `+ New Org Channel` in the ORG section of the sidebar.
- Head coach taps `+ New Team Channel` in the TEAM section of the sidebar.
- Creator provides a channel name and selects members from the org or team member list.
- The channel is created as a `type: "group"` conversation doc with `allowReplies: true` by default.
- The channel appears immediately in the sidebar of all added members via the existing `onSnapshot` conversations query (`memberUids array-contains currentUid`).

#### Member Management

Each custom channel has a `managedBy` field set to the creator's UID. Only the `managedBy` user (or the org owner) can add or remove members after creation. Members cannot leave a managed channel on their own — they must be removed by the manager.

For channels where self-removal makes sense (informal groups), `managedBy` can be set to `null` at creation time to allow member self-removal. This is a creator choice at channel creation.

#### Org Announcements Channel

The org announcements channel is a special-case org-level channel created automatically when an org is created. It has `allowReplies: false` and `managedBy: ownerUid`. Only the org owner can post to it. It appears in the ORG section of the sidebar for all org members regardless of role or team membership. It cannot be deleted.

```js
// Auto-created on org creation
conversations/{orgId + "_announcements"} {
  type: "group",
  orgId: string,
  teamId: null,
  name: "Announcements",
  allowReplies: false,
  managedBy: ownerUid,
  memberUids: [],           // populated as members join any team in the org
  ...
}
```

> **Note:** Populating `memberUids` on the announcements channel as new members join the org is an enrollment side effect that must be handled in the same approval flow that enrolls users into team group chats.

#### Permissions Gate

The `permissions.messaging` flag (part of the 13-flag permissions schema from Gate 5b) gates the ability to **create** custom team-level channels. Reading and participating in channels a user has been added to does not require this flag — it is governed solely by `memberUids` membership.

Org-level channel creation is gated by `role === 'owner'` — not by a permissions flag — since it is inherently an owner action.

### 3.23 Notifications (FCM)

**Required payload fields:**
```js
{
  conversationId: string,
  teamId: string,
  type: "group_message" | "direct_message" | "calendar_event",
  eventId: string | null
}
```

**Tap behavior:**
- Coach: opens directly to conversation in unified view
- Parent: app switches to correct team context via `teamId`, then opens conversation or calendar event

**Notification badges** on team switcher indicate unread activity across all contexts.

### 3.24 Communication Implementation Sequence

| Phase | Feature | Notes |
|---|---|---|
| Comm 1 | Team group chat | Auto-enrollment on approval. Coach + member messaging. |
| Comm 2 | Team calendar | Auto-subscription on approval. scheduledGame integration. |
| Comm 3 | Personal calendar view | Unified view with per-team toggles. |
| Comm 4 | Coach-initiated DMs | One thread per user pair. Team context tagging. |
| Comm 5 | Push notifications (FCM) | Deep-link routing by teamId + conversationId. |
| Comm 6 | Read receipts | Confirm priority before building. |
| Comm 7 | Announcement-only mode | `allowReplies` flag. |

### 3.25 Sub-Org Architecture

> **Status:** Phase A (schema prep) — ready for Gate 7 or Gate 7.5. Phase B (full feature) — deferred to Phase 3, Gate 9. See `SUB_ORG_ARCHITECTURE.md` for full specification.

#### Overview

Sub-orgs allow a large organization to create named divisions or districts under the top-level org. Disabled by default (`subOrgsEnabled: false`). Designed for the second target market: county parks and recreation programs divided into geographic districts.

**Travel basketball (sub-orgs disabled — no change to current behavior):**
```
Org — Eagles Travel (Owner)
  ├── 6U Team
  ├── 8U Team
  └── 10U Team
```

**Parks & Rec (sub-orgs enabled):**
```
Org — County Parks & Rec (Commissioner / Org Owner)
  ├── District 1 (District Director)
  │     ├── 8U Red
  │     └── 10U A
  └── District 2 (District Director)
        └── 8U Gold
```

#### Phase A — Schema Prep (Gate 7 or Gate 7.5)

Two additive nullable fields and one new subcollection. No UI. No new roles. No migration required for existing data.

```js
// Team doc addition
orgs/{orgId}/teams/{teamId} {
  subOrgId: string | null,   // null = team belongs directly to org (default)
}

// Org doc addition
orgs/{orgId} {
  subOrgsEnabled: boolean,   // false by default; owner-toggled
}

// New sub-org collection
orgs/{orgId}/subOrgs/{subOrgId} {
  id: string,
  orgId: string,
  name: string,              // e.g. "District 1", "North District"
  createdAt: timestamp,
  createdBy: string,         // owner UID
}
```

**Claude Code tasks (Gate 7 or 7.5):**
- Add `subOrgId: null` to `writeTeamDoc()` default shape
- Add `subOrgsEnabled: false` to org creation doc in `writeOrgDoc()`
- Define `orgs/{orgId}/subOrgs/{subOrgId}` collection in `firestore.rules` with owner-only write, org-member read

#### Phase B — Full Feature (Phase 3, Gate 9)

Prerequisites: Gate 7.5 (App Shell Restructure) and Gate 8 (Communication) complete. Full scope includes:
- Sub-org management UI (create/rename/delete districts, assign teams)
- **District Director role** — new role scoped to `orgId + subOrgId`; sits between Org Owner and Head Coach; compliance + reports + messaging access across all teams in their district; no scorebook access
- Sidebar team switcher grouped by district when `subOrgsEnabled: true` (flat list otherwise — no change to travel orgs)
- District-level communications channels (scope: `"district"`, requires `subOrgId` field on conversation doc)
- Firestore security rules for `isDistrictDirector()` helper and sub-org collection
- **Billing gate:** sub-org feature locked to Org Standard or above

> **Open questions before Phase B planning:** invite flow for district directors, multiple directors per district, team reassignment between districts, district director read access to team chats, sub-org deletion behavior. See `SUB_ORG_ARCHITECTURE.md §Open Questions`.

---

## 5. Monetization & Billing

### 4.1 Strategy

Cost recovery only — cover Firebase, hosting, domain, and storage costs. Target: $50–100/month covered at early scale.

**Why subscriptions over ads:**
- Niche youth sports audience too small for meaningful ad CPM revenue
- Subscription scales cleanly with user growth
- No SDK overhead, no UX compromise
- Competing apps (Heja, SportsYou, TeamSnap) already condition coaches to pay

**Payment processor:** Stripe (no app store cut, ~97 cents on the dollar). Firebase + Stripe Extension is the implementation path. Stripe checkout triggers when user hits a paid feature gate.

### 4.2 Pricing Tiers

| Tier | Price | Inclusions |
|---|---|---|
| **Free** | $0 | 1 team, basic stat tracking, standard reports |
| **Coach Pro** | $4.99/month | Multiple teams, communication, advanced PDF exports, historical data |
| **Org Basic** | $19.99/month | Up to 5 teams, org admin dashboard, communication |
| **Org Standard** | $39.99/month | Up to 15 teams, document vault, tournament readiness |
| **Org Elite** | $69.99/month | Unlimited teams, document vault, priority support |

**Free tier limits (abuse prevention):** 1 team maximum, no communication features, no document vault. Communication and document vault are the primary paid feature gates.

### 4.3 Billing Fields on Org Document

```
orgs/{orgId} {
  billingTier: "free" | "coach_pro" | "org_basic" | "org_standard" | "org_elite",
  billingStatus: "active" | "past_due" | "canceled",
  grandfathered: boolean,
  grandfatheredReason: "beta_founder" | null,
  grandfatheredAt: timestamp | null
}
```

### 4.4 Grandfathering (Beta Orgs)

Beta testing orgs receive free-for-life access. Set manually by super admin via operator dashboard.

Grandfathered orgs bypass all paywall checks in security rules and app logic. No Stripe involvement.

### 4.5 Self-Registration Flow

> **Current State (Gate 2):** Org creation is currently restricted to superadmin only. Self-registration for org admins is a future gate — the flow below describes the intended end state, not the current implementation.

New orgs self-register without super admin involvement:
```
Org admin → "Create Organization"
  → Google OAuth
  → Org created: billingTier: "free", grandfathered: false, status: "active"
  → Org admin lands in dashboard
  → Soft paywall on paid features
```

---

## 6. Admin Consoles

### 5.1 Super Admin Console (to build)

Platform operator only. No org or team ownership. Responsibilities:
- Platform-wide org list: tier, status, team count, created date
- Billing tier override
- Grandfather toggle with reason note + confirmation step
- User lookup and audit
- Org suspend / restore
- Platform health metrics (total orgs, teams, active users)
- Anomaly flagging (org on free tier with unusual team count)

Implementation: web-based dashboard, superadmin custom claim gates access.

### 5.2 Org Admin Console

Paying customer view. Responsibilities:
- Org settings and season configuration
- Invite coaches to teams (one-time invite links)
- Invite parents directly (when no coach is assigned yet)
- Configure season requirements (required documents, GPA minimums, grade levels)
- Grant eligibility exceptions with logged reason
- View org tournament readiness dashboard
- Export eligibility reports
- Manage billing tier (Stripe portal link)
- Succession and role management

### 5.3 Coach View

Manages one team within the org. Responsibilities:
- Team roster CRUD, jersey number assignment
- Generate player claim links
- Generate parent join code (display, QR, regenerate)
- Schedule: create/edit games and tournaments
- Assign scorekeeper per game
- Verify player documents (manual checklist)
- Create team-level tasks
- Can see all players across org (for pickup/transfer purposes)
- Cannot see other teams' communication or stats

### 5.4 Dual Role (Org Admin + Coach)

Same authenticated user, additive roles. Common in NC travel basketball (club directors who also coach).
- UI surfaces both contexts: org admin console + team-switcher coach view
- Role checks are additive — most permissive role wins

---

## 7. Build Phases

### Phase 1 / 1.5 — COMPLETE ✅

All items shipped: Scorebook UI fixes, GameSetup format step, data migration v3, Firebase Firestore + anonymous auth + offline persistence, transfer code device sync, Manage tab (People + Schedule segments), History tab, Reports tab.

---

### Phase 2 — Gate Status

#### Gate 0 — Coach Beta ✅ COMPLETE
Transfer code to coach device. Coach validates History + Reports read-only.

#### Gate 1 — OAuth Foundation ✅ COMPLETE
- Google OAuth sign-in in Settings
- Anonymous → Google account linking (UID preserved)
- Google profile avatar overlay on gear icon
- Superadmin account + `isSuperadmin()` in `auth.js`
- Two-device sync verified

#### Gate 2 — Org + Role Infrastructure 🔧 FUNCTIONALLY COMPLETE (E2E test pending)

| Item | Status |
|---|---|
| `/orgs/`, `/users/{uid}/roles/` Firestore structure | ✅ Done |
| "Create Organization" flow in Settings | ✅ Done |
| Superadmin-only org creation guard | ✅ Done |
| One-time personal → org path data migration | ✅ Done (always-write bug fixed) |
| `storage.js` path routing + `setActivePath` | ✅ Done |
| Firestore security rules (`firestore.rules`) | ✅ Done |
| Settings → "My Teams" section | ✅ Done |

**Remaining:** E2E test — personal stat data accessible under org path from both devices after org creation; security rules block access without role; Manage tab reflects org data immediately after creation (no reload).

#### Gate 3 — Coach Invite Flow ✅ COMPLETE

- `/invites/{token}` collection + TTL logic
- Manage → Team → Members → "Add Coach" flow (generates invite link)
- Invite acceptance: open link → Google sign-in → role written → team context loaded
- History + Reports scoped to coach's assigned team
- Head Coach conflict detection → `pending_conflict` status + owner notification doc
- Role transfer, soft-removal (removedAt/removedBy), self-removal guard

**Test condition:** ✅ Verified — HC invite accepted, conflict detected and resolved, all three role levels see correct data.

#### Gate 4 — Parent Join Codes + Live Read ✅ COMPLETE

- `/joinCodes/{code}` collection
- Manage → Team → "Parent Join Code" UI (display, copy, regenerate)
- Settings → "Join a Team" text entry + Google sign-in prompt for anonymous users
- Parent role written on join code redemption; role-based nav applied
- Firestore `onSnapshot` live game doc at `orgs/{orgId}/live/game`
- Read-only `LiveGameView` (box score + play-by-play feed); `LiveGameBanner` (pulsing indicator)
- Go Live is coach-controlled; explicit Stop button clears the doc

**Post-tournament fixes applied (April 6, 2026):**
- Autosave throttled to 45s during live games (see §3.1 and architectural decisions)
- Sync status dot + offline warning banner in the Go Live bar (`src/utils/syncStatus.js`)
- Box score bug fixed: player stats pre-derived on tablet, published as `playerStats[]`; `LiveGameView` no longer re-derives from the 50-event truncated feed
- Stale game safeguard in `LiveGameView`: games not updated in >3h show "Possibly Ended" + last-update time
- "End Broadcast" recovery button on finalized games in `ScorebookView`
- Active roster sorted by jersey number in `LiveScorebook` (display only; game logic unchanged)
- Two-phase group sub standby queue: pre-queue bench players in amber before dead ball; auto-fill on deselect; amber badge on SUB button when queue is pending

**Test condition:** ✅ Gate 4 verified April 2, 2026. Post-tournament fixes verified April 6, 2026.

#### Gate 5 — Scorekeeper Role + Org Membership Management ⬜ NOT STARTED

**5a — Scorekeeper Assignment + Game Lock**
- `/scorekeeperAssignments/{gameId}` collection
- Manage → Schedule → [Game] → "Assign Scorekeeper" flow
- "Start Keeping Score" button for assigned scorekeeper
- Explicit confirm dialog before lock is claimed
- Lock banner for all other users: "🔒 Being scored by [Name]"
- `lastActivity` heartbeat (300ms debounce)
- 15-minute inactivity auto-release
- "Break Lock" button for Head Coach and above + confirm dialog
- In-app notification to displaced scorekeeper on break

**5b — Org Membership Management + New Roles**

*Org Members Panel (new, org-level in Manage → PeopleView)*
- Shows all members across all teams in the org, grouped by team
- Shows org-level members separately (`teamId: null`) — Org Staff
- Actions: Change Role, Assign to Team, Remove
- Accessible to Org Owner and Superadmin

*Org Staff role (`role: 'orgstaff', teamId: null`)*
- Org-level standing role, not tied to any specific team
- Future sub-role system: `staffRole` field (e.g. `'finance'`, `'admin'`, `'operations'`)
- Planned for financial features (player dues, payment tracking) and non-coaching administrative tasks
- Access scope: full History + Reports for all teams in org; no scorebook input; Manage is read-only org roster

*Transfer Ownership flow (owner-only)*
- Org Owner taps "Transfer Ownership" in the Org Members Panel
- Picker shows all current org members
- Selected member is immediately promoted to `role: 'owner', teamId: null`
- Two owners coexist during the transition period
- Original owner sees a persistent "Complete Transfer" banner
- Original owner taps → chooses: **Become Org Staff** (retains org access, no team) or **Leave Org**
- On step-down: original owner's role doc updated; transfer complete

*Firestore rules additions*
- `role === 'orgstaff'` handled in `hasOrgRole` (already works via `removedAt == null` check)
- Owner transfer requires write to own role doc (self-demote) — already permitted

**Test conditions:**
- Assign Scorekeeper from second account, claim lock, break lock from HC account
- Owner promotes HC to co-owner; two owners visible in panel; original owner steps down to Org Staff
- Org Staff account sees full org history but cannot access scorebook or manage players

#### Gate 6 — Scorebook Game Clock ✅ COMPLETE

Functionally complete, pending live UI test.

- `src/components/scorebook/GameClock.jsx` — new component ✅
- Configurable period length (whole minutes) ✅
- Start / Stop toggle ✅
- Edit mode with nudge buttons (+10s, -10s, +1s, -1s) ✅
- Auto-pause on edit; resume on Done ✅
- `gameClockTime` field on each stat event ✅
- Clock bar integrated above Scorebook input area ✅

**Test condition:** Pending live UI test.

#### Gate 7 — Player Profile System + Claim Codes ⬜ NOT STARTED

> ⚠️ **Schema dependency:** This gate must implement the player entity model defined in `PLAYER_ENTITY_SCHEMA.md`. Read that document before writing any code. The schema defined there supersedes any player/stats/membership schema previously described in this document.

**Sport template bootstrap (superadmin task — do once before Gate 7 ships):**
- Create `/sportTemplates/basketball` document in Firestore console with full `statDefinitions` array (`2pt_made`, `3pt_made`, `ft_made`, `oreb`, `dreb`, `assist`, `steal`, `block`, `turnover`, `personal_foul`, `technical_foul` and their opponent/team equivalents)
- This is a manual superadmin operation, not application code

**Firestore collections to create:**
- `/sportTemplates/{sport}` — read by all authenticated users; write by superadmin only
- `/players/{playerId}/profile` — see PLAYER_ENTITY_SCHEMA.md §6
- `/players/{playerId}/memberships/{membershipId}` — see §6
- `/players/{playerId}/stats/{sport}/games/{gameId}` — see §7
- `/players/{playerId}/documents/{docType}` — metadata only; files in Firebase Storage
- `/coaches/{coachId}/profile` — see §9

**Application features:**
- Manage → Roster → [Player] → "Generate Claim Link" flow
- `/claimCodes/{code}` collection and claim acceptance flow
- Claim acceptance: open link → Google sign-in → select relationship → pending approval
- Coach approval flow: notification of pending requests, approve/deny UI
- Player profile linked to Google account(s) on approval
- On game finalization: write stat records to `players/{playerId}/stats/{sport}/games/{gameId}` with `verified: true`
- Season archiving logic: mark memberships archived at season end
- Firestore security rules for all new collections (see PLAYER_ENTITY_SCHEMA.md §15)
- Sub-org schema Phase A: add `subOrgId: null` to `writeTeamDoc()` and `subOrgsEnabled: false` to `writeOrgDoc()` — additive only, no UI

**Test condition:** Create player profile, generate claim link, accept on test parent account, approve as coach. Confirm player profile accessible from parent account. Finalize a scorebook game and confirm stat record written to `players/{playerId}/stats/basketball/games/`. Confirm archiving season membership does not break access to stat history.

#### Gate 7.5 — App Shell Restructure ⬜ NOT STARTED

**Prerequisite:** Gate 7 (Player Profile System) must be complete. Gate 7 introduces parent users with child profiles, which makes the current 5-tab nav structurally wrong for the parent role. Gate 7.5 fixes this before Gate 8 adds the Chat tab.

**Scope:**

This gate is a **shell-only restructure**. No new features are built. All existing functionality is preserved and redistributed into the new nav model.

| Item | Detail |
|---|---|
| Replace 5-tab bottom nav with 3-tab bottom nav | Tabs: Chat, Schedule, Stats |
| Build persistent `TeamContextPill` component | Pinned above all content; fixed during scroll; displays active team name; tap opens sidebar |
| Build `AppSidebar` component | Slides in from left on pill tap; contains team switcher dropdown, ORG section, TEAM section, role-scoped secondary nav, settings |
| Implement team switcher dropdown | Lists all teams user belongs to; parent entries show child badge; persists selection to localStorage |
| ORG section (static shell) | Always visible in sidebar; `📢 Announcements` placeholder; no functional comms yet — wired in Gate 8 |
| TEAM section (static shell) | `💬 Team Chat` placeholder; no functional comms yet — wired in Gate 8 |
| Redistribute existing tabs into new structure | Scorebook → Stats tab; History → Stats tab (sub-view); Reports → sidebar (coach/owner only); Manage → sidebar (coach/owner only); Child Profile → sidebar (parent only) |
| Role-scoped sidebar rendering | Parent, Coach, and Owner sidebar layouts as specified in §2.9 |
| Sub-org schema prep (Phase A) | Add `subOrgId: null` to `writeTeamDoc()`; add `subOrgsEnabled: false` to `writeOrgDoc()`; define `orgs/{orgId}/subOrgs/{subOrgId}` collection in `firestore.rules` — no UI, fully additive |
| Remove orange context banner | Remove the orange context banner from History/Reports — team context is now communicated by the persistent pill |

**What does NOT change in this gate:**
- No communication functionality is built (that is Gate 8)
- The `conversations` Firestore collection is not written to
- The ORG and TEAM channel items in the sidebar are non-functional placeholders
- All existing scorebook, history, reports, and manage functionality is fully preserved

**Architecture note:** The sidebar is the single source of team context for the entire app. After Gate 7.5, the existing `activeTeam` / `activeOrg` state in `App.jsx` is driven by the sidebar team switcher selection rather than the top-of-screen pill row. All child components that currently read `activeTeam` continue to work unchanged — only the source of that state changes.

**Test condition:** Install as returning user after Gate 7 complete. Confirm 3-tab nav renders correctly. Confirm team switcher opens sidebar and switches active team context across all tabs. Confirm role-scoped sidebar sections render correctly for parent, coach, and owner accounts. Confirm all existing scorebook, history, reports, and manage features remain accessible and functional.

#### Gate 8 — Welcome Screen, Onboarding & UX Polish ⬜ NOT STARTED

- Welcome Screen with "Get Started" and "Sign in with Google" paths
- Auth state detection on first launch (skip for returning users)
- Tutorial mode (solo + team orientation paths)
- Transition moment notification (anonymous → team join)
- My Stats / Official Stats toggle on History and Reports
- Team / Player context selector for multi-team users
- Android PWA install prompt (`beforeinstallprompt` banner + Settings option)
- iOS install visual guide (one-time modal + Settings option)
- Transfer Mr. Jordan's org ownership (once Coach Corey + roster established)

**Test condition:** Fresh install, no prior data. Navigate welcome screen, complete solo tutorial, join team, confirm transition moment appears, confirm My Stats / Official Stats toggle is visible and functional.

---

### Phase 3 — Communication Features (Post–Gate 8)

All communication work is gated on Gate 7.5 (App Shell Restructure) being complete. The new 3-tab nav and sidebar are the structural foundation for all communication UI. Implementation sequence: Comm 1 (group chat) → Comm 2 (team calendar) → Comm 3 (personal calendar) → Comm 4 (DMs) → Comm 5 (notifications).

See §3.20–§3.24 for full specifications.

---

### Future / Deferred (Phase 3+)

#### ⚠️ Deferred Planning Required — Dual Scorebook & Game Ownership

> **Full planning session required before implementation.** See `DUAL_SCOREBOOK_GAME_OWNERSHIP_STUB.md` for the complete stub with mental model, open questions, and implementation order. Do not begin implementation planning until Gate 9 (Sub-Org) is complete and a dedicated planning session has resolved the open questions in that document.

Core concepts captured in stub:
- **Game tier model:** Tier 1 (Ghost/internal), Tier 2 (Exhibition/linked between orgs), Tier 3 (Tournament official record)
- **Dual scorebook:** Write domain partitioning (home tablet owns `homeEvents`, away tablet owns `awayEvents`). Conflict detection via `homeObservedScore` / `awayObservedScore` comparison. Non-blocking discrepancy alert inline in UI.
- **Scorekeeper lock extension:** Two simultaneous locks per game (home + away), each claimed independently
- **Finalization authority:** Mutual confirmation (exhibition), organizer-controlled (tournament)
- **Stat profiles:** Full (all stats) vs. Standard (points + fouls + timeouts per player) — set at game creation
- **Use cases:** Tournament hosting (NTBA/Big Shots), parks & rec cross-district games, exhibition between two app orgs, exhibition against a non-app team (anonymous stubs + share link)

> **Open questions (resolve in planning session):** exhibition finalization authority, orphaned stat book retroactive linking, correction request flow for finalized tournament records, score discrepancy threshold (zero vs. ±1–2 buffer), dual-lock heartbeat/stale detection, HC override on dual game, period sync between tablets, stat profile configurability, tournament organizer account type. See stub for full list.

#### Feature Backlog

| Feature | Notes |
|---|---|
| Sub-Org / District Director | Phase 3, Gate 9. Full spec in `SUB_ORG_ARCHITECTURE.md`. Schema prep added to Gate 7.5. |
| Tournament organizer mode | Multi-org bracket building. Tier 3 game records. `tournament.createdByOrgId` already nullable. |
| Camera-assisted clock sync | `clockSynced` flag is already on every event (always `false` until implemented). |
| Spectator view via public URL | Read-only for fans without an account. |
| Recruiting profile enhancements | Trend charts, tournament-only stat filters, comparison to team averages. |
| Parent multi-player tracker | Simultaneous stat input for 3+ children. |
| Coach performance reports | W-L rate, points allowed, etc. Schema supports this via coach profile memberships. |
| Bubblewrap / Play Store listing | Wraps PWA as native Android app for proper distribution. |
| AI-assisted document verification | Claude Vision pre-fills coach checklist on high-confidence match. |
| Sport expansion | Document vault and task system already generic. Football physicals, soccer age verification, etc. |
| Geographic expansion | Self-registration model supports rapid scaling without provisioning bottleneck. |

#### ⚠️ Monetization & Features — Detailed Planning Pending

> See `MONETIZATION_AND_FEATURES_PLAN.md` for the full planning document covering: pricing tiers, Stripe implementation, grandfathering, invitation system, jersey number management, task & compliance system, document vault (Phase 1 manual + Phase 2 AI-assisted), tournament readiness dashboard, season configuration, and super admin console. Core decisions already reflected in §5 (Monetization & Billing) and §6 (Admin Consoles). Open questions from that document have been merged into §8 (Open Questions) below.

---

### Key Technical Debt / Known Issues

| Issue | Status |
|---|---|
| `storage.js` path routing: `getDocs` collection query didn't immediately reflect new role doc writes (Firestore local cache lag) | ✅ Fixed via `setActivePath` |
| `migratePersonalDataToOrg` silently skipped writing if any previous migration existed | ✅ Fixed |
| Org creation UI visible to all authenticated users | ✅ Fixed (superadmin guard) |
| `isSuperadmin()` in rules uses custom claim correctly | ✅ Verified in `firestore.rules` |
| Autosave (300ms) flooded Firestore write queue during live games on unstable wifi — write queue exhausted, data stranded in localStorage | ✅ Fixed — 45s throttle in `useAutosave.js` when `game.status === 'live'` |
| `LiveGameView` box score wrong for games >50 events — stats re-derived from truncated event slice | ✅ Fixed — stats pre-derived on tablet and published as `playerStats[]` |
| Live broadcast not auto-clearing on game finalization — banner stuck on parent devices | ✅ Fixed — `LiveGameBanner` uses `onSnapshot` (auto-hides on doc delete); "End Broadcast" recovery button in `ScorebookView` |
| `loadDb` migration flag (`hasRunMigration_v3`) writes to localStorage only — won't re-run if user clears browser storage | Minor — acceptable for now |
| `storage.js:72` multi-org routing — `rolesSnap.docs[0].id` returns whichever org Firestore serves first; non-deterministic for users with multiple org memberships | ⚠️ Known — fix before any multi-org user exists |

---

## 8. Open Questions

Organized by feature area. All require decisions before or during implementation of the relevant gate.

### Auth & Role Management

- [ ] **Head Coach conflict UX:** When two HC invites are both accepted, the second acceptor lands in `pending_conflict` status and the org owner is notified via an in-app notification doc. The current UX requires the owner to manually go to Manage → Team → Members to resolve. Consider whether a proactive notification badge or a dedicated "Conflicts" view is warranted, or whether the current owner-resolves-at-leisure approach is acceptable for the intended user base.
- [ ] **Multi-org path routing:** `storage.js` line 72 uses `rolesSnap.docs[0].id` — the first role document returned by Firestore. This is correct for single-org users but will produce non-deterministic org routing for any user who holds roles in multiple orgs simultaneously. Must be fixed before any coach with multi-org memberships uses the app. Resolution: add an explicit active org selection stored in localStorage, set on login and on org-switch.
- [ ] **Can a coach belong to multiple orgs simultaneously?** Monetization doc says yes (cross-org coach scenario). PHASE2_ARCHITECTURE implies yes. Confirm behavior when accepting an invite to a second org.
- [ ] **Org admin leaves org:** If an org admin is also a coach and leaves, what is the succession process for org ownership? Does super admin need to intervene?
- [ ] **Org admin removes a coach mid-season:** What happens to their team assignments and historical data?
- [ ] **Player-initiated DMs:** Can players (not just parents) DM a coach? Does this differ by age group?
- [ ] **Org admin in chat:** Does the org admin appear in team chats and DM lists, or do they have a separate oversight-only view?

### Billing & Monetization

- [ ] **Exact free tier limits:** What is the player/roster limit per team on the free tier?
- [ ] **Annual pricing discount?** (e.g. 2 months free for annual commitment)
- [ ] **Subscription lapse:** What happens to org data when a subscription lapses — grace period? Data export only mode?
- [ ] **Coach Pro independence:** Does Coach Pro exist as a standalone tier, or only as part of an org upgrade path?

### Player Transfers

- [ ] **Inter-org transfer:** Who initiates — both org admins? Player/parent request? Is there a formal request flow or does the coach just generate a new claim link in the new org?
- [ ] **Document verification on transfer:** When a player transfers between orgs, does the receiving org inherit the prior verification, or must they re-verify? Who decides?
- [ ] **Jersey number on removal:** What happens to a jersey number if a player is removed from the org entirely (not just transferred)? Is the number immediately freed or held?
- [ ] **Retired numbers:** Should retired numbers be supported (honoring standout players)?

### Tasks & Compliance

- [ ] **Task linked to calendar event:** When a coach creates a team task scoped to a tournament, should it be linkable to a specific calendar event/game?
- [ ] **Org admin access to team-level tasks:** Can org admins see and manage team-level tasks, or is that strictly coach territory?
- [ ] **Task reminder cadence:** How often do reminder notifications fire for incomplete tasks?
- [ ] **Resubmission:** Can parents dispute a rejection with a resubmission? Is there a resubmission limit?
- [ ] **Wrong document type:** What is the process if a parent uploads the wrong document type?

### Document Vault

- [ ] **Data retention after org cancels:** How long are documents stored after a player leaves an org or the org cancels their subscription?
- [ ] **Parent deletes upload before verification:** Should this be allowed?
- [ ] **COPPA compliance:** Minors' documents require specific privacy policy language. Legal review needed before launch.
- [ ] **Eligibility export format:** Does verified document status need to be exportable in a format acceptable to tournament officials?

### Jersey Management

- [ ] **Maximum roster size:** Is there a cap per team that affects number range?

### Tournament Readiness

- [ ] **Tournament readiness tied to calendar events:** Should tournament readiness be computed relative to a specific event, or is it always a general team status?
- [ ] **Org-wide tournaments:** Can org admin create org-wide tournaments that automatically populate team schedules?
- [ ] **Archive completed tournaments:** Should there be a way to mark a tournament as "completed" to archive its associated tasks?

### Communication

- [ ] **Safeguarding rules for adult-to-minor direct messaging:** Youth sports platforms often have safeguarding requirements (e.g. no private adult-to-minor messaging without a guardian copied). What obligations apply to this user base and jurisdiction? This is a legal/liability question, not just a UX decision.
- [ ] **Player-direct DMs and age gate:** Should player-to-coach DMs have any age gate or require parental visibility?
- [ ] **Message retention policy:** How long are messages stored? Auto-delete after a season ends or player leaves?
- [ ] **Data portability:** If a coach or parent deletes their account, what happens to their sent messages in group chats?
- [ ] **Coach leaves org:** What happens to DM history when a coach's account is removed from an org? Preserve but mark inactive?
- [ ] **Coach cross-org:** Can a coach who works with multiple orgs have a unified view across both, or is each org a separate login context?
- [ ] **Message deletion:** Can coaches delete messages in their team chat? Can org admins delete any message?
- [ ] **Roster removal read access cutoff:** Should removed members see a UI indicator of their removal date (e.g. "You left this team on Oct 3")?
- [ ] **Announcement-only setting:** Is `allowReplies: false` a per-conversation setting (coach sets on creation) or a per-message toggle? Or both?
- [ ] **Event RSVP:** Do parents/players need to confirm attendance for calendar events? RSVPs significantly increase schema and UI complexity.
- [ ] **External calendar sync:** Should team calendar events be exportable to Google Calendar / Apple Calendar via iCal feed?
- [ ] **Game result on calendar event:** When a `scheduledGame` is finalized, does the linked calendar event update to show the final score?
- [ ] **Recurring events:** Do practices need a recurring event pattern (every Tuesday + Thursday)?
- [ ] **Calendar color assignment:** System-assigned or user-controlled per team?
- [ ] **Notification preferences:** Can parents mute a specific team's notifications (e.g. during vacation) without unsubscribing from the calendar?
- [ ] **Quiet hours:** Should the app respect a quiet hours window?
- [ ] **Coach notification volume:** Digest/batching option for coaches with 3+ teams?

### Notifications (General)

- [ ] **Push notification infrastructure:** FCM assumed but not formally confirmed. Confirm before building Gate 5.
- [ ] **Notification preference controls:** Full preference controls for coaches and parents — scope, frequency, quiet hours.
- [ ] **Scheduled task reminders:** Should coaches be able to schedule task reminder notifications for a specific date/time?

---

*Planning document suite last cleaned: April 15, 2026*
*Canonical files: MASTER_PLAN.md, IMPLEMENTATION_STATUS.md, CLAUDE.md,*
*PLAYER_ENTITY_SCHEMA.md, SUB_ORG_ARCHITECTURE.md,*
*DUAL_SCOREBOOK_GAME_OWNERSHIP_STUB.md*
*All prior planning documents (ARCHITECTURE.md, PHASE2_ARCHITECTURE.md,*
*COMMUNICATION_PLAN.md, STATTRACKER_PRD.md, MONETIZATION_AND_FEATURES_PLAN.md,*
*PLANNING_SUMMARY.md, MASTER_PLAN_UPDATE_NAV_COMMS.md, local_store.md)*
*have been deleted. Their content is fully consolidated into MASTER_PLAN.md.*
