# WE TRACK — Player-Primary Sport-Agnostic Schema
**Document Type:** Architecture — Canonical Schema Reference  
**Version:** 1.0  
**Date:** April 2026  
**Status:** Planning — Pre-Gate 7  
**Author:** Whitt's End LLC

> **Codebase placement:** This file belongs at the root of the planning documents directory alongside MASTER_PLAN.md. It is the canonical schema reference for all Gate 7+ development. Claude Code must read this document before implementing any player profile, stat write, team creation, or org structure in Gate 7 or later.

---

## Purpose

This document defines the complete Firestore collection hierarchy and schema for the player-primary, sport-agnostic data model. It supersedes any prior schema definitions that treat orgs or teams as the owner of player identity or stat history.

This document should be read alongside `MASTER_PLAN.md` and governs all schema decisions from Gate 7 forward. Claude Code must not implement any player profile, stat write, or org/team structure that contradicts the principles defined here.

---

## Locked Architectural Principles

These decisions are final and must not be revisited during implementation.

| Principle | Detail |
|---|---|
| **Player is the primary entity** | Players exist independently of any org or team. Orgs and teams are organizational contexts — they do not own player identity or stat history. |
| **Stats owned by the player permanently** | Game stat records live under `players/{playerId}/stats/{sport}/games/`. Org and team are immutable metadata tags on each record, not the storage hierarchy. Stats survive org deletion, expiry, or player transfer. |
| **Sport lives on the team** | Each team has exactly one sport. Orgs can have multi-sport teams. Sport config drives the scorebook engine — no basketball-specific logic is hardcoded. |
| **Sport templates defined by superadmin** | Superadmin creates and maintains sport templates (stat definitions, game format defaults). Org owners pick a template when creating a team. Templates are not editable by orgs. |
| **Memberships are temporal** | A membership record represents one player's relationship to one team in one season. Memberships are archived, never deleted. Career history is the full membership chain. |
| **Sub-orgs are child orgs** | A parent org (e.g. NC Loaded) contains sub-orgs (NC Loaded 17U, NC Loaded 16U). Players hold a membership at the org level and are assigned to a sub-org and team. |
| **Org/team as authority, not owner** | Orgs have authority to record stats on behalf of players during active membership. That authority expires when membership is archived. The stat record is permanent regardless. |
| **Verified vs. self-reported is permanent metadata** | Every stat game record carries `verified: boolean` and `source`. This distinction is permanent and cannot be changed after finalization. Player controls public visibility of unverified stats. |

---

## Collection Hierarchy Overview

```
/sportTemplates/{sport}/                  ← superadmin-defined, read-only to orgs

/users/{uid}/                             ← auth identity, roles, preferences
  profile/
  roles/{orgId}/
  preferences/

/orgs/{orgId}/                            ← billing + admin shell
  profile/
  members/{uid}/
  subOrgs/{subOrgId}/                     ← child orgs (optional — flat orgs skip this)
    profile/
    teams/{teamId}/                       ← team lives under sub-org or directly under org
      profile/
      roster/{playerId}/                  ← active roster slot (temporal)
      scheduledGames/{gameId}/
      scorebookGames/{gameId}/
  teams/{teamId}/                         ← flat org teams (no sub-org)
    profile/
    roster/{playerId}/
    scheduledGames/{gameId}/
    scorebookGames/{gameId}/
  feeSchedules/{feeScheduleId}/
  documents/{docId}/
  tasks/{taskId}/
  tournaments/{tournamentId}/
  jerseyRegistry/

/players/{playerId}/                      ← PRIMARY ENTITY — permanent
  profile/
  linkedAccounts/
  memberships/{membershipId}/
  stats/{sport}/
    games/{gameId}/                       ← permanent stat record
    seasons/{season}/                     ← aggregated season totals (derived, cached)
  documents/{docType}/                    ← birth cert, waiver, etc.
  recruitingProfile/

/coaches/{coachId}/                       ← coach entity — permanent
  profile/
  memberships/{membershipId}/

/invites/{token}/
/joinCodes/{code}/
/claimCodes/{code}/
/gameLocks/{gameId}/
/scorekeeperAssignments/{gameId}/
/transferCodes/{code}/
/auditLog/{logId}/
```

---

## 1. Sport Templates

Defined and maintained exclusively by superadmin. Org owners pick one template per team at team creation. Templates are immutable to orgs — no customization below the superadmin level.

```js
/sportTemplates/{sport} = {
  sport:        string,           // "basketball" | "soccer" | "football" | "lacrosse" | ...
  displayName:  string,           // "Basketball"
  createdAt:    timestamp,
  updatedAt:    timestamp,
  createdByUid: string,           // superadmin uid

  // Game format defaults — org owner can override per team at team creation
  formatDefaults: {
    periodType:           "half" | "quarter" | "period" | "inning",
    periods:              number,           // e.g. 2 (halves), 4 (quarters)
    periodLengthMinutes:  number,           // e.g. 20, 12, 10
    overtimeLengthMinutes: number | null,
    foulsToDisqualify:    number | null,    // null for sports with no foul-out
    foulResetPeriod:      "half" | "quarter" | "period" | null,
    teamFoulTracking:     boolean,
    bonusEnabled:         boolean,
    timeoutsPerPeriod:    number | null,
    timeoutsPerGame:      number | null,    // for sports that track total, not per-period
  },

  // Stat definitions — drives scorebook buttons and event log labels
  statDefinitions: [
    {
      key:        string,     // internal event key, e.g. "2pt_made", "goal", "tackle"
      label:      string,     // display label, e.g. "2PT", "Goal", "Tackle"
      category:   "scoring" | "defense" | "possession" | "discipline" | "other",
      playerStat: boolean,    // true = tracked per player; false = team-only (e.g. timeout)
      counted:    boolean,    // true = increments a counter; false = event only (e.g. substitution)
      pointValue: number | null,  // null for non-scoring stats
      requiresTarget: boolean,    // true = requires a second player (e.g. assist)
      targetLabel: string | null, // label for the target prompt, e.g. "Assisted by"
      undoable:   boolean,    // true = can be undone via event log
      displayOrder: number,   // order in the scorebook button grid
    }
  ],

  // Opponent tracking — what gets tracked for the opposing team
  opponentTracking: [
    { key: string, label: string, pointValue: number | null }
  ],

  // Aggregate stat keys shown on player profile and reports
  // Maps display label to a derivation expression over statDefinitions
  profileStats: [
    {
      key:        string,     // e.g. "ppg", "goals", "tackles"
      label:      string,     // e.g. "PPG", "Goals", "Tackles"
      expression: string,     // e.g. "sum(2pt_made)*2 + sum(3pt_made)*3 + sum(ft_made)"
      perGame:    boolean,    // true = divide by games played
      displayPrecision: number, // decimal places
    }
  ],
}
```

**Built-in sport template keys (superadmin creates these at platform launch):**
- `basketball`
- `soccer`
- `football`
- `lacrosse`
- `volleyball`
- `baseball`
- `softball`

---

## 2. Users

Auth identity. Roles are scoped per org. Preferences are personal.

```js
/users/{uid}/profile = {
  displayName:  string,
  email:        string,
  photoURL:     string | null,
  createdAt:    timestamp,
  lastActiveAt: timestamp,
}

// Standing roles — one document per org the user belongs to
/users/{uid}/roles/{orgId} = {
  role:         "owner" | "headcoach" | "assistantcoach" | "manager" | "staff" | "parent",
  teamId:       string | null,        // null for owner/manager; teamId for coaches/staff/parent
  subOrgId:     string | null,        // null for flat orgs; subOrgId for sub-org members
  grantedByUid: string,
  grantedAt:    timestamp,
  status:       "active" | "pending_conflict",
  removedAt:    timestamp | null,
  removedBy:    string | null,

  // Explicit permission flags (Gate 5b model — 13 flags)
  permissions: {
    scorebook:    boolean,
    roster:       boolean,
    schedule:     boolean,
    members:      boolean,
    documents:    boolean,
    tasks:        boolean,
    compliance:   boolean,
    reports:      boolean,
    messaging:    boolean,
    financials:   boolean,
    equipment:    boolean,
    seasonConfig: boolean,
    orgSettings:  boolean,
  }
}

/users/{uid}/preferences = {
  recruitingProfileVisibility: "public" | "coaches_only" | "private",
  showUnverifiedStats:         boolean,   // player controls this on their public profile
  activeOrgId:                 string | null,
  activeTeamId:                string | null,
  theme:                       "dark" | "light",    // always dark for now
}
```

---

## 3. Organizations

The org is a billing and administrative shell. It does not own players or stats. It has authority to record stats on behalf of players during active membership.

```js
/orgs/{orgId}/profile = {
  name:               string,
  ownerUid:           string,
  createdAt:          timestamp,
  sport:              string | null,      // null for multi-sport orgs
  logoUrl:            string | null,
  region:             string | null,      // e.g. "NC", "Southeast"
  publicPageEnabled:  boolean,            // controls public org homepage
  parentOrgId:        string | null,      // null = top-level org; set = this IS a sub-org
  subOrgsEnabled:     boolean,            // false for flat orgs, true for parent orgs

  // Billing
  billingTier:        "free" | "coach_pro" | "org_basic" | "org_standard" | "org_elite",
  billingStatus:      "active" | "past_due" | "canceled",
  stripeCustomerId:   string | null,
  grandfathered:      boolean,
  grandfatheredReason: "beta_founder" | null,
  grandfatheredAt:    timestamp | null,

  // Season config
  seasonConfig: {
    currentSeason:        string,         // e.g. "2025-2026"
    seasonStartDate:      timestamp | null,
    seasonEndDate:        timestamp | null,
    requiredDocuments:    string[],       // e.g. ["birth_certificate", "waiver"]
    gradeMinimum:         number | null,
    ageMaximum:           number | null,
  },

  // Soft delete
  deletedAt:  timestamp | null,
  deletedBy:  string | null,
}

// Members — one per user with a role in this org
/orgs/{orgId}/members/{uid} = {
  uid:          string,
  displayName:  string,         // snapshot at time of join
  email:        string,
  photoURL:     string | null,
  role:         string,
  teamId:       string | null,
  subOrgId:     string | null,
  joinedAt:     timestamp,
  removedAt:    timestamp | null,
  permissions:  { ...same 13-flag shape as users/{uid}/roles/{orgId}... }
}
```

---

## 4. Sub-Orgs

Sub-orgs are child organizational units within a parent org. A parent org like "NC Loaded" might have sub-orgs for each age group. Sub-orgs are optional — flat orgs skip this layer entirely.

```js
/orgs/{orgId}/subOrgs/{subOrgId}/profile = {
  name:         string,           // e.g. "NC Loaded 17U"
  parentOrgId:  string,           // always the containing orgId
  sport:        string,           // inherited from parent or overridden
  ageGroup:     string | null,    // e.g. "17U", "16U"
  createdAt:    timestamp,
  createdByUid: string,
  deletedAt:    timestamp | null,
}
```

Teams and all operational data (roster, schedules, scorebook) live under the sub-org when sub-orgs are enabled:

```
/orgs/{orgId}/subOrgs/{subOrgId}/teams/{teamId}/
```

For flat orgs (no sub-orgs), teams live directly under the org:

```
/orgs/{orgId}/teams/{teamId}/
```

All application logic resolves the team path dynamically based on whether `subOrgsEnabled` is true. The team schema is identical in both cases.

---

## 5. Teams

Sport lives on the team. Each team has exactly one sport and one sport template. The scorebook engine is driven entirely by the team's sport config — no sport-specific logic is hardcoded in the engine.

```js
// Path: /orgs/{orgId}/teams/{teamId}/profile  OR
//       /orgs/{orgId}/subOrgs/{subOrgId}/teams/{teamId}/profile

{
  name:           string,
  orgId:          string,
  subOrgId:       string | null,    // null for flat orgs
  sport:          string,           // e.g. "basketball" — must match a sportTemplates key
  sportTemplateId: string,          // references /sportTemplates/{sport}
  ageGroup:       string | null,    // e.g. "17U"
  season:         string,           // e.g. "2025-2026"
  createdAt:      timestamp,
  createdByUid:   string,

  // Format overrides — org owner can override template defaults at team creation
  // These values take precedence over sportTemplate.formatDefaults
  formatOverrides: {
    periodType:           string | null,
    periods:              number | null,
    periodLengthMinutes:  number | null,
    foulsToDisqualify:    number | null,
    foulResetPeriod:      string | null,
    timeoutsPerPeriod:    number | null,
  },

  // Active roster snapshot — player IDs currently on this team this season
  // Full player data is fetched from /players/{playerId}
  // This array is the authoritative active roster for this team/season
  activeRoster: [
    {
      playerId:     string,
      jerseyNumber: string,
      addedAt:      timestamp,
      addedByUid:   string,
    }
  ],

  // Soft delete
  deletedAt:  timestamp | null,
  deletedBy:  string | null,
}

// Roster slot — mirrors activeRoster[] but as a queryable subcollection
// Used for security rules and large roster queries
/orgs/{orgId}/teams/{teamId}/roster/{playerId} = {
  playerId:     string,
  jerseyNumber: string,
  addedAt:      timestamp,
  addedByUid:   string,
  removedAt:    timestamp | null,   // null = still active
  removedBy:    string | null,
}
```

---

## 6. Players (Primary Entity)

The player entity is permanent. It is never deleted. It exists independently of any org or team.

```js
/players/{playerId}/profile = {
  // Identity
  displayName:      string,
  preferredName:    string | null,    // nickname shown on scorebook
  dateOfBirth:      timestamp | null, // set when birth cert verified
  gradYear:         string | null,    // e.g. "2028"
  photoURL:         string | null,
  height:           string | null,    // e.g. "6'2\""
  weight:           string | null,    // e.g. "185 lbs"
  hometown:         string | null,
  primarySport:     string | null,    // player-chosen primary sport for profile display
  sports:           string[],         // all sports this player has stats in

  // Creation
  createdAt:        timestamp,
  createdByUid:     string,           // uid of coach who created the anonymous placeholder
  claimedAt:        timestamp | null, // null = unclaimed anonymous placeholder
  
  // Eligibility (computed at read time from documents + tasks)
  eligibilityStatus: "eligible" | "pending" | "ineligible",
  tournamentReady:   boolean,

  // Recruiting profile settings
  recruitingProfile: {
    enabled:              boolean,    // player opt-in to public profile
    publicSlug:           string | null,  // e.g. "marcus-johnson-sf-2027"
    showUnverifiedStats:  boolean,    // player controls this
    headline:             string | null,  // e.g. "6'3\" SF | NC Loaded | Class of 2027"
    bio:                  string | null,
    highlightVideoUrl:    string | null,
    contactEmail:         string | null,  // shown only to verified college coaches
  },

  // Soft delete — players are never hard deleted
  archivedAt:       timestamp | null,
  archivedBy:       string | null,
  archivedReason:   string | null,
}

// Accounts linked to this player (parent, self, guardian)
// Array stored on the profile document for security rule access
/players/{playerId}/profile.linkedAccounts = [
  {
    uid:          string,
    relationship: "self" | "parent" | "guardian",
    approvedAt:   timestamp,
    approvedBy:   string,   // uid of coach who approved
  }
]

// Memberships — one per team per season
// Temporal — archived when player leaves team or season ends
/players/{playerId}/memberships/{membershipId} = {
  membershipId:   string,         // UUID
  orgId:          string,
  orgName:        string,         // snapshot — survives org deletion
  subOrgId:       string | null,
  subOrgName:     string | null,  // snapshot
  teamId:         string,
  teamName:       string,         // snapshot
  sport:          string,
  season:         string,         // e.g. "2025-2026"
  jerseyNumber:   string,
  role:           "player",       // future: "captain" etc.
  joinedAt:       timestamp,
  status:         "active" | "archived",
  archivedAt:     timestamp | null,
  archivedReason: "season_end" | "transfer" | "removed" | null,
}
```

---

## 7. Player Stats (Permanent, Sport-Namespaced)

Stats are owned by the player entity. Sport is the top-level namespace. Org and team are immutable metadata on each record — not the storage location.

```js
// Individual game stat record
/players/{playerId}/stats/{sport}/games/{gameId} = {
  gameId:         string,       // references the scorebookGame or manual entry
  gameDate:       string,       // YYYY-MM-DD
  opponent:       string,
  location:       string | null,

  // Context metadata — immutable after finalization
  orgId:          string,
  orgName:        string,       // snapshot at time of game
  subOrgId:       string | null,
  subOrgName:     string | null,
  teamId:         string,
  teamName:       string,       // snapshot at time of game
  season:         string,
  tournamentId:   string | null,
  tournamentName: string | null, // snapshot
  phase:          "pool" | "bracket" | null,
  bracketName:    string | null,
  round:          string | null,

  // Source and verification — permanent, immutable after finalization
  source:         "scorebook" | "manual",
  verified:       boolean,      // true = from official scorebook; false = self-reported
  finalizedAt:    timestamp | null,
  finalizedByUid: string | null,

  // Stats — structure is sport-specific, driven by sportTemplate.statDefinitions
  // Keys match statDefinition.key values for the team's sport
  // Basketball example:
  stats: {
    // Scoring
    "2pt_made":    number,
    "2pt_missed":  number,
    "3pt_made":    number,
    "3pt_missed":  number,
    "ft_made":     number,
    "ft_missed":   number,
    // Defense
    "oreb":        number,
    "dreb":        number,
    "steal":       number,
    "block":       number,
    // Other
    "assist":      number,
    "turnover":    number,
    "personal_foul": number,
    "technical_foul": number,
    // Computed at write time for query efficiency
    "_points":     number,      // prefix _ = computed/derived
    "_fgm":        number,
    "_fga":        number,
    "_minutes":    number | null,
  },

  // Soccer example (same structure, different keys):
  // stats: {
  //   "goal": number,
  //   "assist": number,
  //   "shot": number,
  //   "shot_on_target": number,
  //   "yellow_card": number,
  //   "red_card": number,
  //   "tackle": number,
  //   "save": number,     // goalkeeper
  //   "_goals": number,   // computed
  // }
}

// Season aggregate — computed and cached, never source of truth
// Rebuilt on demand or after game finalization
/players/{playerId}/stats/{sport}/seasons/{season} = {
  season:       string,
  orgId:        string,         // primary org for this season
  teamId:       string,         // primary team for this season
  gamesPlayed:  number,
  gamesVerified: number,        // games from official scorebook
  totals:       { ...same key structure as game stats... },
  perGame:      { ...same keys, divided by gamesPlayed... },
  updatedAt:    timestamp,
}
```

---

## 8. Player Documents (Firebase Storage)

Document metadata lives in Firestore. File bytes live in Firebase Storage. Files are never publicly accessible — all reads go through signed URLs with short TTLs.

```js
/players/{playerId}/documents/{docType} = {
  docType:          string,     // "birth_certificate" | "waiver" | "physical" | "insurance"
  orgId:            string,     // org that requested/verified this doc
  season:           string,
  storagePath:      string,     // Firebase Storage path — never a public URL
  uploadedAt:       timestamp,
  uploadedByUid:    string,
  fileSize:         number,     // bytes
  mimeType:         string,

  // Verification
  status:           "pending" | "verified" | "rejected",
  verifiedAt:       timestamp | null,
  verifiedByUid:    string | null,
  rejectedReason:   string | null,

  // Expiry
  expiresAt:        timestamp | null,   // null = no expiry

  // Soft delete
  deletedAt:        timestamp | null,
  deletedBy:        string | null,
}
```

Storage path convention:
```
players/{playerId}/documents/{season}/{docType}/{filename}
```

---

## 9. Coaches (Entity)

Coach profiles are first-class entities, parallel to players. Career history and performance metrics accumulate across orgs.

```js
/coaches/{coachId}/profile = {
  displayName:  string,
  linkedUid:    string | null,    // null = unclaimed placeholder
  createdAt:    timestamp,
  createdByUid: string,
  claimedAt:    timestamp | null,
  photoURL:     string | null,
  bio:          string | null,
}

/coaches/{coachId}/memberships/{membershipId} = {
  orgId:        string,
  orgName:      string,     // snapshot
  subOrgId:     string | null,
  subOrgName:   string | null,
  teamId:       string,
  teamName:     string,     // snapshot
  sport:        string,
  role:         "headcoach" | "assistantcoach",
  season:       string,
  joinedAt:     timestamp,
  status:       "active" | "archived",
  archivedAt:   timestamp | null,

  // Performance — derived at query time from scorebookGames, never stored as aggregate
  // _wins, _losses, _pointsAllowedPerGame computed on demand
}
```

---

## 10. Scorebook Games (Operational — Lives Under Team)

The scorebook game record lives under the team for operational access during the game. On finalization, stat records are written to each player's permanent stat collection. The scorebook game record itself is retained under the team as the official source for dispute resolution.

```js
// Path mirrors team path — under subOrg if applicable
/orgs/{orgId}/teams/{teamId}/scorebookGames/{gameId} = {
  id:                 string,
  scheduledGameId:    string | null,
  teamId:             string,
  orgId:              string,
  subOrgId:           string | null,
  sport:              string,               // copied from team at game creation
  sportTemplateId:    string,               // locked at game creation
  opponent:           string,
  opponentOrgId:      string | null,        // set for Tier 2/3 games
  gameDate:           string,               // YYYY-MM-DD
  location:           string | null,
  tournamentId:       string | null,
  phase:              "pool" | "bracket" | null,
  bracketName:        string | null,
  round:              string | null,

  // Game tier (from dual scorebook planning)
  tier:               1 | 2 | 3,           // 1=internal, 2=exhibition, 3=tournament official

  // Format — resolved from sportTemplate.formatDefaults + team.formatOverrides
  format: {
    periodType:             string,
    periods:                number,
    periodLengthMinutes:    number,
    foulsToDisqualify:      number | null,
    foulResetPeriod:        string | null,
    doubleBonusFoulLimit:   number | null,
    singleBonusEnabled:     boolean,
    singleBonusFoulLimit:   number | null,
    timeoutsPerPeriod:      number | null,
    timeoutsPerGame:        number | null,
  },

  // Roster snapshot — point-in-time, immutable after game starts
  roster: [
    { playerId: string, jerseyNumber: string, name: string }
  ],

  // Event log
  events:             Event[],              // full event log — see event schema below
  initialFive:        string[],             // playerIds of starting lineup

  // Live publishing
  playerStats:        object[],             // pre-derived, published for live read
  isLive:             boolean,

  // Status
  status:             "setup" | "live" | "finalized",
  createdAt:          timestamp,
  finalizedAt:        timestamp | null,
  finalizedByUid:     string | null,

  // Links to generated player stat records (written on finalization)
  generatedStatIds: [
    { playerId: string, statGameId: string }
  ],

  // Soft delete (scorebook games are never hard deleted)
  deletedAt:          timestamp | null,
}

// Event schema — sport-agnostic
// eventType values come from sportTemplate.statDefinitions[].key
Event = {
  id:             string,
  period:         number,
  gameClockTime:  string | null,    // e.g. "6:24" — null if clock stopped
  clockSynced:    boolean,          // always false until camera sync (Phase 3+)
  timestamp:      string,           // ISO — wall clock time of entry
  type:           string,           // matches statDefinition.key or system event
  playerId:       string | null,    // null for team/opponent events
  targetPlayerId: string | null,    // for events requiring a second player (e.g. assist)
  teamContext:    "home" | "away",
  // System event types (not in statDefinitions):
  // "period_start" | "period_end" | "period_change"
  // "substitution_in" | "substitution_out"
  // "timeout_home" | "timeout_away"
  // "game_clock_edit"
}
```

---

## 11. Scheduled Games

```js
/orgs/{orgId}/teams/{teamId}/scheduledGames/{gameId} = {
  id:             string,
  orgId:          string,
  subOrgId:       string | null,
  teamId:         string,
  sport:          string,
  opponent:       string,
  opponentOrgId:  string | null,
  opponentTeamId: string | null,
  gameDate:       string,       // YYYY-MM-DD
  gameTime:       string | null, // "HH:MM" 24h
  location:       string | null,
  tournamentId:   string | null,
  status:         "scheduled" | "live" | "final",
  phase:          "pool" | "bracket" | null,
  bracketName:    string | null,
  round:          string | null,
  scorebookGameId: string | null,  // linked when game is started
  createdAt:      timestamp,
  createdByUid:   string,
}
```

---

## 12. Tournaments

Tournaments are platform-level entities — not owned by any org. Any org can participate. The org that creates a tournament is the organizer.

```js
/tournaments/{tournamentId} = {
  name:             string,
  sport:            string,
  organizerOrgId:   string | null,    // null = platform-created
  location:         string,
  startDate:        string,           // YYYY-MM-DD
  endDate:          string,
  notes:            string | null,
  publicPageEnabled: boolean,

  // Divisions
  divisions: [
    {
      id:       string,
      name:     string,         // e.g. "Platinum 17U"
      ageGroup: string | null,
      sport:    string,
    }
  ],

  createdAt:    timestamp,
  createdByUid: string,
  deletedAt:    timestamp | null,
}
```

---

## 13. Org Financial Collections

```js
/orgs/{orgId}/feeSchedules/{feeScheduleId} = {
  name:           string,
  teamId:         string | null,    // null = org-wide
  subOrgId:       string | null,
  amount:         number,           // cents
  currency:       "usd",
  dueDate:        timestamp | null,
  paymentPlan: {
    enabled:        boolean,
    installments:   number,
    intervalDays:   number,
    firstPaymentAt: timestamp,
  },
  stripeProductId: string,
  stripePriceId:   string,
  createdBy:       string,
  createdAt:       timestamp,
  status:          "active" | "archived",
  autoApplyToNewMembers: boolean,
}

/orgs/{orgId}/playerFees/{feeId} = {
  playerId:             string,
  feeScheduleId:        string,
  orgId:                string,
  teamId:               string | null,
  amountDue:            number,     // cents
  amountPaid:           number,
  balance:              number,     // amountDue - amountPaid
  status:               "unpaid" | "partial" | "paid" | "waived" | "overdue",
  waivedBy:             string | null,
  waivedAt:             timestamp | null,
  waivedReason:         string | null,
  stripeCustomerId:     string,
  stripeSubscriptionId: string | null,
  payments: [
    {
      amount:                 number,
      paidAt:                 timestamp,
      stripePaymentIntentId:  string,
      method:                 "card",
    }
  ],
  dueDate:    timestamp | null,
  createdAt:  timestamp,
}
```

---

## 14. Platform Collections

```js
/invites/{token} = {
  orgId:        string,
  subOrgId:     string | null,
  teamId:       string,
  role:         "headcoach" | "assistantcoach" | "manager" | "staff",
  createdByUid: string,
  createdAt:    timestamp,
  expiresAt:    timestamp,      // 48-hour TTL
  usedAt:       timestamp | null,
  usedByUid:    string | null,
}

/joinCodes/{code} = {
  orgId:        string,
  subOrgId:     string | null,
  teamId:       string,
  role:         "parent",
  createdByUid: string,
  createdAt:    timestamp,
  expiresAt:    timestamp | null,   // null = season-long
}

/claimCodes/{code} = {
  playerId:         string,
  orgId:            string,
  teamId:           string,
  createdByUid:     string,
  createdAt:        timestamp,
  usedAt:           timestamp | null,
  usedByUid:        string | null,
  relationship:     "self" | "parent" | "guardian" | null,
  approvedAt:       timestamp | null,
  approvedByUid:    string | null,
}

/gameLocks/{gameId} = {
  lockedByUid:    string,
  lockedByName:   string,
  lockedAt:       timestamp,
  lastActivity:   timestamp,
  teamId:         string,
  orgId:          string,
  subOrgId:       string | null,
}

/scorekeeperAssignments/{gameId} = {
  assignedUid:    string,
  assignedByUid:  string,
  assignedAt:     timestamp,
  teamId:         string,
  orgId:          string,
  subOrgId:       string | null,
}

/transferCodes/{code} = {
  uid:        string,
  createdAt:  timestamp,
  expiresAt:  timestamp,    // 10-minute TTL
}

// Audit log — written on any sensitive operation
/auditLog/{logId} = {
  action:       string,     // e.g. "role_granted", "game_finalized", "fee_waived"
  performedBy:  string,     // uid
  targetEntity: string,     // e.g. "players/{playerId}"
  orgId:        string | null,
  before:       object | null,
  after:        object | null,
  timestamp:    timestamp,
  ipAddress:    string | null,  // from Cloud Function context
}
```

---

## 15. Security Rules Summary

```
// Sport templates — superadmin write, all authenticated read
/sportTemplates/**
  read:  authenticated
  write: isSuperadmin()

// Org data — members read, role-gated write
/orgs/{orgId}/**
  read:  hasOrgRole(orgId)
  write: hasPermission(orgId, "orgSettings") OR isSuperadmin()

/orgs/{orgId}/teams/{teamId}/scorebookGames/**
  read:  hasOrgRole(orgId)
  write: hasPermission(orgId, "scorebook") OR isSuperadmin()

// Player profiles — linked accounts + coaches in any of player's orgs
/players/{playerId}
  read:  isLinkedAccount(playerId) OR isCoachInPlayerOrg(playerId) OR isSuperadmin()
  write: isLinkedAccount(playerId) OR isCoachInPlayerOrg(playerId) OR isSuperadmin()

// Player stats — same read; write restricted to active org membership authority
/players/{playerId}/stats/**
  read:  isLinkedAccount(playerId) OR isCoachInPlayerOrg(playerId) OR isSuperadmin()
  write: isActiveCoachForPlayer(playerId) OR isSuperadmin()
  // isActiveCoachForPlayer = coach in org where player has active membership

// Player documents — linked accounts + org coaches only; no public read ever
/players/{playerId}/documents/**
  read:  isLinkedAccount(playerId) OR isCoachInPlayerOrg(playerId) OR isSuperadmin()
  write: isCoachInPlayerOrg(playerId) OR isSuperadmin()

// Claim codes — link acts as auth
/claimCodes/{code}
  read:  always
  write: isActiveCoach() OR isSuperadmin()

// Users — private
/users/{uid}/**
  read:  isOwner(uid) OR isSuperadmin()
  write: isOwner(uid) OR isSuperadmin()

// Audit log — superadmin read, Cloud Functions write only
/auditLog/**
  read:  isSuperadmin()
  write: false   // written exclusively by Cloud Functions
```

---

## 16. Migration Path from Current Schema

The current schema stores game records in `orgs/{orgId}/data/db` as `scorebookGames[]` and `games[]` arrays. The player-primary schema replaces this with individual Firestore documents.

**Migration is a Gate 7 concern — do not attempt before Gate 7.**

Migration strategy:
1. Gate 7 builds the new `players/{playerId}` collection fresh — no migration of old game records initially
2. New games finalized after Gate 7 write to both `players/{playerId}/stats/{sport}/games/` (new) and retain the `scorebookGames[]` record under the team (unchanged — backward compat)
3. Historical game records in `orgs/{orgId}/data/db` remain queryable for History/Reports via the existing `storage.js` path — no disruption to current users
4. A one-time background migration script (similar to the tournament recovery approach) backfills historical games into the player stat collections after Gate 7 is stable
5. The `games[]` (Individual Tracker) array is the lowest priority for migration — these are the manual/self-reported records and will be migrated with `verified: false`

---

## 17. Key Design Decisions Log

| Decision | Rationale |
|---|---|
| Sport lives on the team, not the org | Orgs can run multi-sport programs. Basketball team and soccer team under same org is valid. |
| Superadmin defines sport templates, org owner picks | Prevents stat key fragmentation across orgs. Ensures cross-org leaderboards and recruiting profiles are comparable. |
| Stats permanently owned by player, org/team as metadata | Player career history survives org deletion, expiry, or any number of team transfers. |
| Sub-orgs as a child collection under the parent org | Keeps billing and admin at the parent org level. Sub-org is an organizational grouping, not a billing entity. |
| Players hold org membership, assigned to sub-org + team | Avoids re-invitation when players move between sub-orgs within the same parent org. |
| Verified vs. self-reported is permanent and immutable | Integrity of the recruiting profile depends on the distinction being trustworthy. Players control visibility, not the verified flag itself. |
| Scorebook game lives under the team, stat records under the player | Scorebook game is operational — needed for real-time access during play. Stat records are the permanent artifact — needed for career history. Both exist simultaneously post-finalization. |
| Org/team name snapshotted on every stat record | Ensures historical records remain human-readable even when orgs rename or cease to exist. |
| Season aggregates are computed/cached, never source of truth | Aggregates can always be rebuilt from the game records. This prevents aggregate corruption from being permanent. |

---

*End of document.*  
*Next step: Incorporate this schema into MASTER_PLAN.md §2 before Gate 7 planning session begins.*
