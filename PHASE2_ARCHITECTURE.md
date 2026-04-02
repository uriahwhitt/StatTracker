> **SUPERSEDED — Do not use as primary reference.**
> This document is preserved for historical context only. `MASTER_PLAN.md` is the single canonical reference for all Phase 2 auth, role, and profile architecture. Where this document and `MASTER_PLAN.md` conflict, `MASTER_PLAN.md` takes precedence.

# WE TRACK — Phase 2 Architecture Update
**Document Type:** Architecture Delta — Addendum to `ARCHITECTURE.md`
**Version:** 2.0
**Date:** March 2026
**Status:** Superseded by MASTER_PLAN.md
**Author:** Whitt's End LLC

---

## Purpose

This document extends `ARCHITECTURE.md` with all decisions made for Phase 2. It covers:
- Google OAuth migration strategy
- Role-based access model (final)
- Player / Coach / User profile system (first-class entities)
- Firestore data structure expansion
- Invitation and join code flows
- Game locking system
- Scorebook game clock
- Welcome screen & onboarding
- My Stats vs Official Stats model
- Multi-team / multi-player context switching
- PWA install UX
- UI changes
- Sequenced build order

All decisions in this document are locked. Claude Code should treat this as authoritative alongside `ARCHITECTURE.md`.

---

## Table of Contents

1. [Role Model](#1-role-model)
2. [Auth Strategy — Anonymous + OAuth Dual Mode](#2-auth-strategy--anonymous--oauth-dual-mode)
3. [Player, Coach & User Profile System](#3-player-coach--user-profile-system)
4. [Firestore Structure Expansion](#4-firestore-structure-expansion)
5. [Invitation & Join Code Flows](#5-invitation--join-code-flows)
6. [Game Locking System](#6-game-locking-system)
7. [Scorebook Game Clock](#7-scorebook-game-clock)
8. [Welcome Screen & Onboarding](#8-welcome-screen--onboarding)
9. [My Stats vs Official Stats](#9-my-stats-vs-official-stats)
10. [Multi-Team / Multi-Player Context Switching](#10-multi-team--multi-player-context-switching)
11. [PWA Install UX](#11-pwa-install-ux)
12. [UI Changes](#12-ui-changes)
13. [Firestore Security Rules Structure](#13-firestore-security-rules-structure)
14. [Build Sequence](#14-build-sequence)
15. [Deferred to Phase 3](#15-deferred-to-phase-3)

---

## 1. Role Model

### 1.1 Role Hierarchy

| Role | Scope | Manage | Scorebook | History | Reports | Notes |
|---|---|---|---|---|---|---|
| **Superadmin** | System-wide | Full | Full | Full | Full | Whitt's End account only. Implemented as Firebase Auth custom claim. |
| **Org Owner** | One org | Full | Full | Full | Full | Inherits all roles on all teams in their org by default. Future: receives coach performance reports. |
| **Head Coach** | One team | Team only | Full | Full | Full | Can assign roles, generate join codes, break game locks. Future: subject of coach performance reports. |
| **Assistant Coach** | One team | None | Full | Full | Full | No role management access. Future: subject of coach performance reports. |
| **Scorekeeper** | One game | None | Input only (locked game) | None | None | Temporary assignment per game. Assignable to any team member. Removable by Head Coach or above. |
| **Parent** | One team | None | Live read-only | Full | Full | Joins via reusable team join code. Requires Google account. |

### 1.2 Key Role Rules

- A person can hold different roles across different orgs and teams simultaneously.
- Org Owner has full access to all teams in their org — they do not need a separate Coach role assigned.
- Org Owner can assign themselves as Head Coach of any specific team when they want explicit team membership.
- Scorekeeper is a **per-game temporary assignment**, not a standing role. It is assigned by a Head Coach or above and is removable at any time.
- Anonymous users (no Google account) cannot be invited to an org or assigned any role. They remain invisible to the role system and operate in solo mode only.

### 1.3 Role Storage in Firestore

```
users/{uid}/roles/{orgId} = {
  role: "owner" | "headcoach" | "assistantcoach" | "parent",
  teamId: string | null,   // null for owner (org-wide), teamId for coach/parent
  grantedByUid: string,
  grantedAt: string        // ISO timestamp
}
```

Superadmin is stored as a Firebase Auth **custom claim** (`superadmin: true`), not in Firestore. This prevents tampering. Set manually via Firebase Admin SDK for the Whitt's End account only.

Scorekeeper assignments are stored separately — see §6.

---

## 2. Auth Strategy — Anonymous + OAuth Dual Mode

### 2.1 Two Permanent Modes

The app operates in two permanent parallel modes. Neither is deprecated.

| Mode | Identity | Sync | Role System | Transfer Codes |
|---|---|---|---|---|
| **Anonymous** | Device UID | Transfer codes only | None — solo use | Active |
| **Authenticated** | Google UID | Automatic, all devices | Full role + invite system | Not needed (but not removed) |

Anonymous users who never want a Google account retain full solo functionality indefinitely. Transfer codes remain in the codebase permanently.

### 2.2 Upgrading Anonymous → Google (Account Linking)

Firebase supports native anonymous-to-Google account linking. The existing UID is preserved — no data migration required.

**Flow:**
1. User opens Settings → taps "Sign in with Google"
2. Google OAuth completes
3. Firebase links Google credential to the existing anonymous UID
4. Firestore path `users/{uid}/data/db` is unchanged
5. User now has persistent identity across all devices

**This is the recommended path for any user who has existing data and wants to keep it.**

### 2.3 New Device Sign-In (Post-OAuth)

Once a user has signed in with Google at least once:
1. Opens app on any new device → taps "Sign in with Google"
2. Same Google account → same UID → Firestore syncs automatically
3. No transfer code needed

### 2.4 Data Path Routing Logic (`storage.js`)

`storage.js` must route reads/writes to the correct Firestore path based on auth state:

```
If user has no org role:
  → users/{uid}/data/db     (personal/anonymous path, unchanged from Phase 1.5)

If user has an org role:
  → orgs/{orgId}/data/db    (org path, shared with other role members)
```

When a user first creates or is added to an org, a one-time migration copies their personal data to the org path. The personal path becomes a tombstone.

### 2.5 Transfer Codes (Unchanged from Phase 1.5)

Transfer codes remain exactly as designed in `ARCHITECTURE.md §9.3`. No changes. They are the sync mechanism for anonymous users and remain available to authenticated users as a manual fallback.

---

## 3. Player, Coach & User Profile System

### 3.1 Design Philosophy

All people in the system — players, coaches, parents — are **first-class entities**. Profiles exist independently of any org or team membership. Team membership is a **relationship record**, not ownership. This ensures:

- A player's career stats persist across seasons, teams, and orgs
- A coach's win/loss record and performance data accumulate over time
- If a player or coach leaves an org using this app, their claimed profile and all history remain accessible through their personal account
- Org owners can generate performance reports on coaches across all seasons

### 3.2 Player Profile Schema

Player profiles live at the **top level of Firestore**, not nested under any org or team.

```
/players/{playerId}/
  profile: {
    name: string,
    birthYear: number,
    createdAt: string,          // ISO timestamp
    createdByUid: string        // uid of coach/admin who created the profile
  }
  linkedAccounts: [
    {
      uid: string,
      relationship: "self" | "parent" | "guardian",
      approvedAt: string,
      approvedBy: string        // uid of coach who approved the link
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
```

### 3.3 Coach Profile Schema

Coach profiles also live at the top level, separate from their user auth record.

```
/coaches/{coachId}/
  profile: {
    name: string,
    createdAt: string,
    linkedUid: string | null    // Google UID once claimed
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
```

Coach performance metrics (W-L record, points allowed per game, etc.) are derived at query time from game records linked to their `coachId` — they are not stored as a separate aggregate. This ensures the data is always accurate and never stale.

### 3.4 Claim Code / Link System

**For Players:**
1. Coach creates a player profile when building the roster
2. A unique claim code is generated for that player profile
3. Parent or player opens the app, signs into Google, enters the claim code
4. Selects relationship: "This is me" or "This is my child / family member"
5. Coach receives a notification and approves the link
6. Google account and player entity are permanently connected

**For Coaches:**
- Coaches are invited via the standard one-time invite link (see §5.1)
- On accepting the invite and signing in with Google, their `linkedUid` is written to their coach profile

**Key Rules:**
- Multiple Google accounts can be linked to one player (player + one or more family members)
- Removing a player from a team does **not** break the account link
- The link is permanent once approved — data persists regardless of future org changes
- Anonymous users cannot claim a player or coach profile — Google account required
- Org owners can generate a claim code at any time, including after a season has ended (no data loss for late claiming)
- Unclaimed player profiles remain in the org's records and are fully accessible to coaches and org owners

### 3.5 End-of-Season Archiving

At season end:
- Team memberships in `players/{playerId}/memberships[]` are marked `status: "archived"`
- The player entity and all associated stats remain fully intact
- When a player joins a new team the following season, a new membership record is appended to the same player entity
- Career stats accumulate naturally across all seasons and teams

### 3.6 Independent (Solo) Mode for Claimed Players

A player with a claimed profile can continue receiving **personally tracked stats** even without active org membership. Solo tracking lives at the player level, not just the user level.

---

## 4. Firestore Structure Expansion

### 4.1 New Collections (Phase 2)

The Phase 1.5 structure (`users/{uid}/data/db`) is extended with the following new top-level collections:

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
    db: { ...existing db shape... }   // personal path, used if no org

/orgs/{orgId}/
  profile: {
    name: string,
    ownerUid: string,
    createdAt: string
  }
  data/
    db: { ...existing db shape... }   // org-shared path

/players/{playerId}/
  // See §3.2 for full schema

/coaches/{coachId}/
  // See §3.3 for full schema

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
    expiresAt: string | null  // null = season-long, no expiry
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
    lastActivity: string,    // updated on every stat entry (300ms debounce same as autosave)
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
```

### 4.2 `db` Schema — No Changes

The `db` object shape defined in `ARCHITECTURE.md §3.1` is unchanged. Phase 2 only changes where that object lives in Firestore (personal path vs. org path) and who has read/write access to it.

---

## 5. Invitation & Join Code Flows

### 5.1 Head Coach / Assistant Coach Invite (One-Time Link)

Coach-level invites are one-time-use links with a 48-hour TTL. They are not reusable codes.

**Sending (Head Coach or above):**
1. Manage → Team → Members → "Add Coach"
2. Select role: Head Coach or Assistant Coach
3. App generates a token, writes to `/invites/{token}`
4. Displays a shareable link: `wetrack.app/invite/{token}`
5. Head Coach shares link via any channel (text, email, etc.)

**Accepting (Invitee):**
1. Opens link → app loads invite context
2. If not signed in → prompted to sign in with Google (required for coach roles)
3. On sign-in, role is written to `users/{uid}/roles/{orgId}`
4. Token marked `usedAt` + `usedByUid`, then ignored for future use
5. User lands in the app with their team context loaded

### 5.2 Parent Join Code (Reusable, Team-Scoped)

Parent join codes are reusable for the duration of a season. A new code can be generated by the Head Coach at any time (invalidating the previous one).

**Generating (Head Coach or above):**
1. Manage → Team → Members → "Parent Join Code"
2. Displays a 6-character alphanumeric code and optional QR code
3. Code written to `/joinCodes/{code}` with no expiry (or end-of-season date if set)
4. Previous code for that team is deleted on regeneration

**Using (Parent):**
1. Settings → "Join a Team" → enter 6-character code
2. If anonymous → prompt: *"Joining a team requires a Google account so your access stays with you. Sign in with Google to continue."* — this is the only point in the app where a Google sign-in is required
3. On sign-in, role `parent` written to `users/{uid}/roles/{orgId}` scoped to `teamId`
4. Parent now sees History + Reports for that team and live read-only during active games

**Parent access scope:**
- All players' stats for their assigned team
- Read-only — no write access of any kind
- Live game score and box score during active locked games (real-time Firestore listener)

### 5.3 Player Profile Claim Codes

Claim codes allow a parent, guardian, or player to link their Google account to a player profile created by a coach. See §3.4 for the full flow.

**Generating (Head Coach or above):**
1. Manage → Roster → [Player] → "Generate Claim Link"
2. A unique code written to `/claimCodes/{code}`
3. Shareable link displayed: `wetrack.app/claim/{code}`
4. Can be regenerated at any time (old code invalidated) — supports post-season late claiming

### 5.4 Scorekeeper Assignment

Scorekeeper is a per-game role, not a standing team role. It is assigned explicitly before each game.

**Assigning (Head Coach or above):**
1. Manage → Schedule → [Game] → "Assign Scorekeeper"
2. Select from list of current team members (any role)
3. Assignment written to `/scorekeeperAssignments/{gameId}`
4. Assigned person sees a "Keep Score" button appear on that game in their view

**Claiming the Lock (Assigned Scorekeeper):**
1. Tap "Start Keeping Score" on the game
2. Confirmation dialog: *"You're about to start keeping score for [Game]. This will lock the scorebook to your device."*
3. On confirm → lock written to `/gameLocks/{gameId}`
4. Scorebook opens in input mode
5. All other users now see a read-only live view with lock banner

---

## 6. Game Locking System

### 6.1 Lock Lifecycle

```
Unstarted
  → [Assigned scorekeeper taps "Start Keeping Score" + confirms]
  → Locked / Active
      → [Every stat entry updates lastActivity]
      → [lastActivity stale > 15 minutes] → Auto-released
      → [Head Coach or above taps "Break Lock" + confirms] → Force-released
  → Released
      → Available to claim again (same or new scorekeeper)
```

### 6.2 Lock Rules

- Only the assigned Scorekeeper (or Head Coach, Org Owner, Superadmin) can claim a lock.
- Once locked, no other user can enter stats for that game regardless of their role.
- `lastActivity` is updated on every stat entry event, using the same 300ms debounce as autosave.
- Inactivity timeout: **15 minutes** (long enough to cover halftime, short enough to recover from a dead phone).
- Any user with team access (Coach, Assistant, Parent) sees a live read-only view of the game while it is locked.

### 6.3 Lock Display (All Users)

While a game is actively locked, all non-scorekeeper views show:

```
🔒 Being scored by [Display Name]   [Break Lock — visible to Head Coach and above only]
```

### 6.4 Force-Break Lock (Head Coach or Above)

1. Head Coach views active game → sees lock banner with "Break Lock" button
2. Confirmation dialog: *"This will end [Name]'s scoring session. They will be notified. Continue?"*
3. On confirm:
   - Lock document deleted from `/gameLocks/{gameId}`
   - In-app alert sent to displaced scorekeeper (if online): *"Your scoring session was ended by [Coach Name]."*
   - Head Coach can immediately reassign or claim the lock themselves

### 6.5 Live Read During Active Game

While a game is locked and active, all users with team access receive real-time updates via Firestore listeners:
- Live score
- Running box score
- Read-only event log (reverse chronological)

Implemented as a standard Firestore `onSnapshot` listener on the game document. No additional backend infrastructure required.

---

## 7. Scorebook Game Clock

### 7.1 Overview

A game clock is displayed at the top of the Scorebook screen. It counts **down** from a configurable period length. The scorekeeper starts and stops the clock manually and can edit the current time at any point to resync with the official scoreboard clock.

The clock is a UI-only tool for the scorekeeper's reference and for timestamping stat events. It does not affect scoring logic or game state.

### 7.2 Clock Behavior

| State | Description |
|---|---|
| **Stopped (default)** | Clock displays the configured period start time. Start button visible. |
| **Running** | Clock counts down in real time. Stop button visible. Edit button visible. |
| **Stopped (mid-game)** | Clock holds current time. Start/Resume button visible. Edit button visible. |
| **At 0:00** | Clock stops automatically. End of period prompt shown. |

### 7.3 Configuration

Before the game begins (or at any period break), the scorekeeper can set:
- **Period length:** configurable in whole minutes (e.g. 8 min for youth quarters, 10 min for older age groups, 20 min for halves)
- **Current period:** displayed as a label (e.g. "Q1", "Q2", "H1", "H2") — manually advanced by the scorekeeper

Period length is set once per session and persists across all periods of that game.

### 7.4 Edit / Resync Flow

Because the scorekeeper will typically start/stop the app clock a second or two behind the real scoreboard, an Edit button is always available while the clock is running or stopped.

**Tapping Edit opens an inline time editor directly on the clock display:**

```
  ┌─────────────────────────────┐
  │   [ - 10s ]  6:24  [ + 10s ]│
  │   [ - 1s  ]        [ + 1s  ]│
  │         [ Done ]            │
  └─────────────────────────────┘
```

- **Nudge buttons:** `+10s`, `-10s`, `+1s`, `-1s` for quick fine-tuning
- The clock **pauses automatically** when the editor opens
- Tapping **Done** resumes the clock from the adjusted time (if it was running before edit was tapped)
- No number pad / manual entry — nudge-only to keep it fast and one-handed during live play

### 7.5 Stat Event Timestamps

Every stat entry event already has a `clockSynced` flag in the schema (per the Phase 3 deferred item in the original document). In Phase 2, the clock time at the moment of each stat entry is recorded as a `gameClockTime` string (e.g. `"6:24"`) on the event object. The `clockSynced` flag remains `false` until the camera-assisted sync feature is implemented in Phase 3.

```
statEvent: {
  ...existing fields...,
  gameClockTime: string | null,   // null if clock was stopped at time of entry
  clockSynced: false              // always false in Phase 2; reserved for Phase 3
}
```

### 7.6 UI Placement

```
┌──────────────────────────────────────────────────────┐
│  Q2          6:24  ▶ / ■        [Edit]               │
├──────────────────────────────────────────────────────┤
│  [Scorebook input area]                               │
└──────────────────────────────────────────────────────┘
```

- Period label on the left (tappable to advance period manually)
- Clock time centered
- Start/Stop toggle button immediately right of the time
- Edit button far right
- Entire clock bar is a single fixed row above the scorebook input area

### 7.7 New File

The clock component is isolated to a new file:

```
src/components/scorebook/GameClock.jsx
```

This component manages its own countdown interval. It accepts `periodLength` (in seconds) as a prop and calls a callback `onTickWithTime(timeString)` on each second tick so the parent Scorebook component can attach the current time to any stat event logged during that second.

---

## 8. Welcome Screen & Onboarding

### 8.1 Two User Tiers

| Tier | Auth | Access | Data |
|---|---|---|---|
| **Solo / Anonymous** | None required | Individual tracker + personal history/reports | Stored in own Firebase path, fully private |
| **Team Member** | Google OAuth required | All of the above + team data, scorebook read, communication (future) | Personal stats never affect official team records |

### 8.2 First-Launch Flow

1. App detects auth state on first load
2. If no prior auth state exists → show Welcome Screen
3. Welcome Screen presents two clear paths:
   - **"Get Started"** → enters app as anonymous user, solo mode
   - **"Sign in with Google"** → Google OAuth → team-enabled mode
4. Returning users (anonymous or authenticated) skip the Welcome Screen entirely

The Welcome Screen must not block access. "Get Started" is always available — Google sign-in is never forced at this stage.

### 8.3 Tutorial Mode

Tutorial mode handles both user tiers:

- **Solo orientation:** Track tab walkthrough, personal stats, history/reports
- **Team orientation:** Team context, live scorebook read, official vs. personal stats distinction

Tutorial is dismissable at any time and not shown to returning users.

### 8.4 Transition Moment (Anonymous → Team)

When an anonymous user later joins a team via join code, a one-time notification explains:

> *"Your personally tracked games are still in My Stats. Official team records are separate and managed by your team's scorekeeper."*

This is the critical moment to set expectations before the My Stats vs Official Stats distinction becomes visible (see §9).

---

## 9. My Stats vs Official Stats

### 9.1 Three Data Buckets

| Type | Source | Editable By | Visible To |
|---|---|---|---|
| **Personal tracked stats** | User's own tap input during games | User only | User only |
| **Official team stats** | Scorekeeper via locked Scorebook | Scorekeeper + coaches | All team members (read) |
| **Team stats (read-only)** | Official record | No one at this level | Parents, players |

### 9.2 UI Toggle

A **"My Stats / Official Stats"** toggle appears at the top of the History and Reports screens whenever a user has access to both data sources (i.e., they have a team role AND have personally tracked games).

- The two views are **never mixed** in a single display without explicit labeling
- Default view is **Official Stats** for users with a team role
- Default view is **My Stats** for solo/anonymous users (no toggle shown)

Every game card in History shows a visual indicator:
- 🏀 Personal icon → personal tracked game
- 🏆 Team badge → official team game

### 9.3 Edge Cases

- **Parent who tracked 18 points but official shows 14:** The toggle and visual indicators must make the source of each number clear. The app must never feel broken in this scenario.
- **User who has never used the team scorebook:** Official Stats toggle is hidden until at least one official game exists for their team. No empty state confusion.
- **Anonymous user who joins a team:** My Stats tab retains all prior personal tracking history. Official Stats tab shows team records going forward.

---

## 10. Multi-Team / Multi-Player Context Switching

### 10.1 Context Toggle Hierarchy

For users who belong to multiple teams, or parents with multiple players:

```
Team Selector → Player Selector → All screens scope to selection
```

- If a user has only one team, the Team Selector is hidden
- If a user has multiple teams, the Team Selector appears first as a persistent header dropdown or pill row
- Player Selector then scopes to the selected team
- History, Reports, and Communication (future) all filter from the active selection
- **App remembers last selected team and player between sessions** (persisted in local storage)

### 10.2 Edge Case: Parent Who Is Also a Coach

- They hold two different roles (parent on Team A, coach on Team B)
- Team toggle handles the role switch
- Available screens and permissions change based on which team is active
- Handled naturally by the existing role architecture — no special logic required

### 10.3 Implementation Notes

The existing player toggle pattern is extended upward into a team layer. This is a pure UI change; the underlying role and data structures already support multiple team memberships per user.

---

## 11. PWA Install UX

### 11.1 Android — Native Prompt

Use the `beforeinstallprompt` event to trigger a native install dialog from a custom in-app button or banner. The service worker is already registered in `main.jsx`.

**Flow:**
1. Capture the `beforeinstallprompt` event and prevent it from firing automatically
2. Show a dismissable install prompt banner on first launch
3. Tapping the banner triggers the native Android install dialog
4. Provide a persistent "Install App" option in Settings for users who dismissed the banner

### 11.2 iOS — Visual Guide

Apple blocks `beforeinstallprompt`. Best option is a one-time visual guide displayed on first launch:

- Screenshot or icon-based illustration showing: Share button → "Add to Home Screen"
- Shown only once, dismissable, not shown again after dismissal
- Also accessible from Settings → "Install App"

### 11.3 Long-Term (Deferred)

Bubblewrap (Google tool) can wrap the PWA as a proper Google Play Store listing, eliminating the browser menu confusion on Android entirely. Deferred — not a Phase 2 task.

---

## 12. UI Changes

### 12.1 Header — Auth State Indicator

| State | Header change |
|---|---|
| Anonymous | Gear icon only (unchanged) |
| Signed in | Gear icon gains Google profile photo as avatar overlay |

No blocking sign-in gates anywhere in the app. Auth is always opt-in.

### 12.2 Settings Page

**Anonymous user — Settings additions:**
- Transfer Code section (unchanged from Phase 1.5)
- New CTA banner: *"Sign in with Google to join teams, sync across devices, and access live game feeds."*
- "Sign in with Google" button

**Authenticated user — Settings changes:**
- Google account card: profile photo, display name, email
- "My Teams" section: list of orgs/teams the user belongs to with their role label
- "Sign out" option
- Transfer code section removed (automatic sync replaces it)
- "Manage Organizations" link visible if user is an Org Owner
- "Join a Team" entry point remains visible

### 12.3 Manage Tab — Members Section (Head Coach + Above)

New "Members" section added to each Team view:

```
Members
  [List of current members with name, role badge, and remove button]

  [+ Add Coach]             → generates one-time invite link, copies to clipboard
  [Parent Join Code]        → displays current code + QR, option to regenerate
  [Assign Scorekeeper]      → per scheduled game, select from member list
```

Game lock status is visible in the Schedule section next to each game:

```
🔒 Live — Being scored by [Name]     [Break Lock]
```

### 12.4 Join a Team Entry Point (Parent / New Member)

Settings → "Join a Team" — text input for 6-character join code. Triggers Google sign-in prompt if anonymous.

### 12.5 Scorekeeper Game View

When a user has been assigned as Scorekeeper for a game and has not yet claimed the lock:

```
[Game card in Schedule or History]
  ● Scorebook ready
  [Start Keeping Score]   ← explicit button, not auto-open
```

After claiming the lock, the existing Scorebook UI opens in input mode with the Game Clock bar at the top (see §7.6).

### 12.6 My Stats / Official Stats Toggle

Appears at the top of History and Reports screens for eligible users. See §9.2 for full behavior.

### 12.7 Team / Player Context Selector

Appears as a persistent header element on History, Reports, and (future) Communication screens for users with multiple team memberships or multiple linked players. See §10.1.

---

## 13. Firestore Security Rules Structure

These are the logical rules. Exact syntax to be written in `firestore.rules`.

```
// Org data — readable by any member with a role in that org
/orgs/{orgId}/**
  read:  user has any role in orgId
  write: user is headcoach or above in orgId, OR superadmin

// Org db — write gated more tightly
/orgs/{orgId}/data/db
  read:  user has any role in orgId
  write: user is headcoach or above in orgId (not assistant, not parent), OR superadmin

// Player profiles — readable by linked accounts, coaches in same org, superadmin
/players/{playerId}
  read:  uid is in linkedAccounts[], OR user has coach/owner role in any of player's orgs, OR superadmin
  write: uid is in linkedAccounts[] (own data only), OR user is headcoach or above in player's org, OR superadmin

// Coach profiles — readable by coaches themselves, org owners in same org, superadmin
/coaches/{coachId}
  read:  uid === linkedUid, OR user is org owner in any of coach's orgs, OR superadmin
  write: uid === linkedUid (own data only), OR user is headcoach or above, OR superadmin

// Claim codes — readable by anyone with the code (link acts as auth), writable by head coach or above
/claimCodes/{code}
  read:  always (code acts as the auth)
  write: user is headcoach or above (create), system (mark used)

// Game locks — claim by assigned scorekeeper, break by headcoach or above
/gameLocks/{gameId}
  read:  user has any role in the game's orgId
  write: user is assigned scorekeeper (claim/update), OR headcoach or above (break), OR superadmin

// Scorekeeper assignments — managed by headcoach or above
/scorekeeperAssignments/{gameId}
  read:  user has any role in the game's orgId
  write: user is headcoach or above in the game's orgId, OR superadmin

// Invites — readable by anyone with the token (link-based), writable only by system
/invites/{token}
  read:  always (link acts as the auth)
  write: user is headcoach or above (create), system (mark used)

// Join codes — readable by anyone (code acts as the auth)
/joinCodes/{code}
  read:  always
  write: user is headcoach or above (create/delete)

// User profiles and roles — private to the user
/users/{uid}/**
  read:  uid === request.auth.uid, OR superadmin
  write: uid === request.auth.uid, OR superadmin
```

**Superadmin check:**
```javascript
function isSuperadmin() {
  return request.auth.token.superadmin == true;
}
```

This uses the custom claim set via Firebase Admin SDK. It is never stored in a Firestore document.

---

## 14. Build Sequence

Work through gates sequentially. Each gate has a clear test condition before moving to the next.

### Gate 0 — Coach Beta (No OAuth Required)
**Goal:** Validate History + Reports output with an external user before any auth complexity.

- [ ] Transfer code from primary device to coach's device
- [ ] Coach accesses History + Reports read-only via their device
- [ ] Validate stat report quality and UX

**Test condition:** Coach can view all game history and export a player report without assistance.

---

### Gate 1 — OAuth Foundation
**Goal:** Persistent identity, automatic multi-device sync for primary user.

- [ ] Enable Google OAuth provider in Firebase console
- [ ] Add "Sign in with Google" button to Settings page
- [ ] Implement anonymous → Google account linking (preserves UID)
- [ ] Add Google profile avatar overlay to gear icon in header
- [ ] Update Settings page for authenticated state (account card, sign out)
- [ ] Establish Whitt's End superadmin account: sign in, set `superadmin: true` custom claim via Firebase Admin SDK
- [ ] Create second account for your own Scorekeeper/user role (separate from superadmin)

**Test condition:** Sign in on two devices with the same Google account. Make a stat entry on device A. Confirm it appears on device B within 5 seconds.

---

### Gate 2 — Org + Role Infrastructure
**Goal:** Data ownership moves from personal to org-scoped. Foundation for all sharing.

- [ ] Expand Firestore structure: `/orgs/`, `/users/{uid}/roles/`
- [ ] "Create Organization" flow (Settings or onboarding prompt for authenticated users)
- [ ] One-time data migration: personal path → org path on org creation
- [ ] `storage.js` routing logic: personal path vs. org path based on role
- [ ] Basic Firestore security rules (org read/write by role)
- [ ] Settings → "My Teams" section showing org membership and role

**Test condition:** Your personal stat data is fully accessible under the org path from both devices. No data loss. Security rules prevent access without a role.

---

### Gate 3 — Coach Invite Flow
**Goal:** External coach can log in with Google and access their team's data. Minimum Mr. Jordan pitch-ready state.

- [ ] `/invites/{token}` collection and TTL logic
- [ ] Manage → Team → Members → "Add Coach" flow (generates invite link)
- [ ] Invite acceptance flow: open link → Google sign-in → role written → team context loaded
- [ ] History + Reports scoped to coach's assigned team
- [ ] Coach cannot see or access other teams in the org
- [ ] Assign Head Coach role to Coach Corey via invite link (once Google OAuth is live)

**Test condition:** Invite beta coach via link. They sign in with Google, land in the app, and can see History + Reports for their team only. They cannot access other teams or the Manage tab.

---

### Gate 4 — Parent Join Codes + Live Read
**Goal:** Parents can join a team and watch live games. Showcase feature for Mr. Jordan pitch.

- [ ] `/joinCodes/{code}` collection
- [ ] Manage → Team → "Parent Join Code" UI (display, QR, regenerate)
- [ ] Settings → "Join a Team" entry point
- [ ] Google sign-in prompt at join code entry for anonymous users
- [ ] Parent role written on join code use
- [ ] Firestore `onSnapshot` listener for live game score + box score
- [ ] Read-only live game view for Parent and Coach roles during active locked game

**Test condition:** Join your own team with a test parent account. While a game is locked and active, confirm the parent view shows live score updates within 2 seconds of stat entry.

---

### Gate 5 — Scorekeeper Assignment + Game Lock
**Goal:** Scorekeeping can be handed off to any team member safely.

- [ ] `/scorekeeperAssignments/{gameId}` collection
- [ ] Manage → Schedule → [Game] → "Assign Scorekeeper" flow
- [ ] "Start Keeping Score" button visible to assigned scorekeeper on their game
- [ ] Explicit confirm dialog before lock is claimed
- [ ] Lock banner visible to all other users: "🔒 Being scored by [Name]"
- [ ] `lastActivity` heartbeat on stat entry (300ms debounce)
- [ ] 15-minute inactivity auto-release
- [ ] "Break Lock" button visible to Head Coach and above
- [ ] Break lock confirm dialog + in-app notification to displaced scorekeeper
- [ ] Post-break: lock available to claim again

**Test condition:** Assign yourself as Scorekeeper on a test game using your second (non-superadmin) account. Claim the lock, enter stats, confirm the superadmin view shows live updates. Then break the lock from the superadmin account and confirm the scorekeeper account receives the notification and loses input access.

---

### Gate 6 — Scorebook Game Clock
**Goal:** Scorekeeper has a resync-capable countdown clock during live games.

- [ ] `src/components/scorebook/GameClock.jsx` — new component
- [ ] Configurable period length (set before game or at period break)
- [ ] Period label display with manual advance
- [ ] Start / Stop toggle
- [ ] Edit mode with nudge buttons (+10s, -10s, +1s, -1s)
- [ ] Auto-pause when edit mode opens; resume on Done
- [ ] `gameClockTime` field attached to each stat event
- [ ] Clock bar integrated into Scorebook UI above input area

**Test condition:** Start a simulated game. Run the clock, stop it mid-period, use the nudge buttons to resync by 8 seconds, resume, and confirm the adjusted time is reflected on subsequent stat entries.

---

### Gate 7 — Player Profile System + Claim Codes
**Goal:** Players and their families can claim persistent profiles. Foundation for career stats.

- [ ] `/players/{playerId}` collection and schema
- [ ] `/coaches/{coachId}` collection and schema
- [ ] Manage → Roster → [Player] → "Generate Claim Link" flow
- [ ] `/claimCodes/{code}` collection
- [ ] Claim acceptance flow: open link → Google sign-in → select relationship → pending approval
- [ ] Coach approval flow: notification of pending link requests, approve/deny UI
- [ ] Player profile linked to Google account(s) on approval
- [ ] Season archiving logic: mark memberships as archived at season end
- [ ] Firestore security rules for `/players/` and `/coaches/`

**Test condition:** Create a player profile, generate a claim link, accept it on a test parent account, approve it as coach. Confirm the player profile is accessible from the parent account and that archiving the season membership does not break access.

---

### Gate 8 — Welcome Screen, Onboarding & UX Polish
**Goal:** App is self-explanatory to a brand new user. Ready for broader rollout.

- [ ] Welcome Screen with "Get Started" and "Sign in with Google" paths
- [ ] Auth state detection on first launch (skip welcome for returning users)
- [ ] Tutorial mode (solo orientation + team orientation paths)
- [ ] Transition moment notification for anonymous → team join
- [ ] My Stats / Official Stats toggle on History and Reports
- [ ] Team / Player context selector for multi-team users
- [ ] Android PWA install prompt (beforeinstallprompt banner + Settings option)
- [ ] iOS install visual guide (one-time modal + Settings option)
- [ ] Transfer Mr. Jordan's org ownership (once Coach Corey + roster are established)

**Test condition:** Fresh install on a new device with no prior data. Navigate the welcome screen, complete tutorial as a solo user, then join a team and confirm the transition moment appears and the My Stats / Official Stats toggle is visible and functional.

---

## 15. Deferred to Phase 3

The following items were discussed and explicitly deferred. Do not implement in Phase 2.

| Item | Notes |
|---|---|
| Dual-team simultaneous scorekeeping | Two scorekeepers, one game, each entering one team's stats. Requires conflict detection architecture. |
| Real-time conflict notification between scorekeepers | Dependent on dual-team scorekeeping. |
| Tournament organizer mode | Multi-org bracket building. `tournament.createdByOrgId` field is already nullable in preparation. |
| Official score table mode | Both teams tracked in one scorebook game. Schema change: add `awayTeamId` and `awayRoster[]` to `scorebookGame`. |
| Camera-assisted clock sync | `clockSynced` flag is present on every event (Phase 2 always writes `false`). No schema changes needed when implemented. |
| Spectator view via public URL | Read-only public link for fans without an account. |
| Recruiting profile enhancements | Trend charts, tournament-only stat filters, comparison to team averages. |
| Parent multi-player tracker | Simultaneous stat input for multiple players (3 sons use case). |
| Coach performance reports | W-L rate, points allowed per game, and other metrics aggregated at org level. Schema already supports this via coach profile memberships. |
| Bubblewrap / Play Store listing | Wraps the PWA as a native Android app for proper Play Store distribution. |
| Ad implementation (Google AdSense) | Anchor banner ads on History, Reports, Tournament, Calendar, and Chat screens. Not on Track or live Scorebook. |
| In-app communication (Chat) | Direct messaging between team members. |
| Calendar integration | Team schedule and event calendar view. |

---

## Appendix A — Environment Variables (Phase 2 Additions)

No new environment variables are required for Phase 2 beyond those established in Phase 1.5. The Firebase project config in `.env` is unchanged.

Firebase Admin SDK (for setting superadmin custom claim) is a one-time manual operation run locally — it does not require any new `.env` variables in the deployed app.

---

## Appendix B — Files Expected to Change in Phase 2

| File | Change |
|---|---|
| `src/utils/storage.js` | Add org path routing logic. Add `onSnapshot` listener support for live game read. |
| `src/utils/auth.js` | New file. Google OAuth sign-in, anonymous linking, auth state listener, custom claim check. |
| `src/utils/roles.js` | New file. Role resolution helpers: `getUserRole(uid, orgId)`, `canWrite(uid, orgId)`, `isScorekeeper(uid, gameId)`, etc. |
| `src/components/Settings.jsx` | Auth state UI (anonymous vs. signed-in), "Join a Team" entry point, "My Teams" section, PWA install prompt. |
| `src/components/WelcomeScreen.jsx` | New file. First-launch screen with Get Started and Sign in with Google paths. |
| `src/components/manage/Members.jsx` | New component. Member list, Add Coach, Parent Join Code, Assign Scorekeeper. |
| `src/components/manage/Roster.jsx` | Updated to include player profile view and "Generate Claim Link" action. |
| `src/components/scorebook/GameLock.jsx` | New component. Lock banner, "Start Keeping Score" button, break lock UI. |
| `src/components/scorebook/GameClock.jsx` | New component. Countdown clock with start/stop/edit and nudge-based resync. |
| `firestore.rules` | Full security rules as described in §13. |
| `firebase.json` | No changes expected. |

All other existing files should remain unchanged. Phase 2 follows the same pattern established in Phase 1.5: isolate auth and role logic to new utility files, touch existing components as minimally as possible.

---

*End of Phase 2 Architecture Document*
*Next document: PHASE3_ARCHITECTURE.md (to be written when Phase 2 Gates 0–5 are complete)*
