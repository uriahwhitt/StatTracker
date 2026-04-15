# WE TRACK — Dual Scorebook & Game Ownership
## Planning Stub — Full Planning Session Required Before Implementation
**Created:** April 14, 2026
**Status:** Stub only — decisions captured, implementation not yet designed
**Author:** Whitt's End LLC
**Prerequisites before planning session:**
  - Gate 9 (Sub-Org) complete
  - Dual scorebook is a Phase 3 / Phase 4 gate — exact placement TBD

---

## Overview

This document captures the mental model and open questions for two deeply related
features:

1. **Dual Scorebook** — two tablets keeping score for the same game simultaneously,
   each owning one team's stats, with real-time conflict detection
2. **Game Ownership & Cross-Org Linking** — a single authoritative game record shared
   across teams and orgs that may have no prior relationship

These features are prerequisites for:
- Tournament hosting (NTBA, Big Shots, similar)
- Parks & rec cross-district games
- Any exhibition between two orgs using the app

They are **not** prerequisites for the travel basketball or parks and rec rollout in
their initial phases. Both use cases can launch with single-tablet scoring and org-scoped
game records. This work unlocks the next level of institutional adoption.

---

## Part 1 — Game Existence Tiers

Games exist at three levels of formality. The tier determines ownership, linkability,
and finalization authority.

### Tier 1 — Ghost / Personal Record

A team tracks a game internally with no connection to the opponent.

- Lives in the org's own Firestore path only
- Opponent is a plain text string — no real entity, no UID, no org association
- **Cannot be linked to an official tournament hosted on the app**
- Cannot be upgraded to a linked game retroactively (no invite was sent)
- Fully valid for the org's own history and reports

```js
scorebookGames/{gameId} {
  tier: "ghost",
  orgId: string,          // owning org
  teamId: string,         // owning team
  opponentName: string,   // text only — no opponentOrgId
  tournamentId: null,     // never linkable to a hosted tournament
  ...
}
```

### Tier 2 — Exhibition / Linked Game

Two teams agree to share a game record. Host team initiates; opponent joins via invite.

- One game record, two stat books permanently attached
- Either team can run full stat tracking at their own depth
- No finalization authority dispute — both teams own their own stat book;
  the shared record is the score and period data only
- If opponent is not on the app, host manually enters players as anonymous entities
  (same anonymous player pattern as claim codes — claimable later if opponent joins)
- Opponent gets a share link to view and export their stats after the game

```js
scorebookGames/{gameId} {
  tier: "exhibition",
  hostOrgId: string,
  hostTeamId: string,
  guestOrgId: string | null,    // null if opponent not on app
  guestTeamId: string | null,
  guestIsAnonymous: boolean,    // true if opponent players were manually entered
  linkedStatBooks: [
    { orgId, teamId, statBookId }   // host
    { orgId, teamId, statBookId }   // guest (if linked)
  ],
  ...
}
```

**Exhibition invite flow:**
```
Host HC → "Invite Opponent Org" → generates game invite token
  → Opponent HC receives link → Google OAuth → accepts
  → Opponent roster auto-populates as real entities in the game
  → Both stat books initialized
  → Game record shared — both orgs see it in their History

If opponent not on app:
  → Host manually enters opponent player names
  → Anonymous player stubs created (orgId = null, claimable)
  → Share link generated for opponent to view/export stats post-game
```

### Tier 3 — Tournament Official Record

Tournament organizer creates and owns the game. Teams are registered participants.

- Organizer (or assigned scorekeeper) finalizes the official record
- Official record covers: score, periods, fouls, timeouts, game metadata
- Each team's full stat tracking is a subordinate stat book — attached, not merged
- **Finalized record is immutable.** Corrections require a formal request to the
  organizer — no team can unilaterally edit the official record after finalization
- Both teams' player stats are permanently linked to the official game record
  regardless of org association — stat history follows the player UID

```js
scorebookGames/{gameId} {
  tier: "tournament",
  tournamentOrgId: string,      // org that owns/hosts the tournament
  tournamentId: string,
  homeOrgId: string,
  homeTeamId: string,
  awayOrgId: string | null,     // null if away team not on app
  awayTeamId: string | null,
  awayIsAnonymous: boolean,
  finalized: boolean,
  finalizedBy: string,          // UID of organizer/scorekeeper who finalized
  finalizedAt: timestamp,
  linkedStatBooks: [
    { orgId, teamId, statBookId, side: "home" }
    { orgId, teamId, statBookId, side: "away" }
  ],
  officialRecord: {
    homeScore: number,
    awayScore: number,
    periods: Period[],
    homeFouls: number,
    awayFouls: number,
    homeTimeouts: number,
    awayTimeouts: number,
  }
  ...
}
```

---

## Part 2 — Dual Scorebook Architecture

### Write Domain Partitioning

Each tablet owns one team's events. Write domains never overlap — this eliminates
merge conflicts by design rather than resolving them after the fact.

```js
scorebookGames/{gameId} {
  // Home tablet writes only to homeEvents and homeObservedScore
  homeEvents: GameEvent[],
  homeObservedScore: number,    // away tablet's running score as seen by home tablet

  // Away tablet writes only to awayEvents and awayObservedScore  
  awayEvents: GameEvent[],
  awayObservedScore: number,    // home tablet's running score as seen by away tablet
}
```

The game lock system is extended to support two simultaneous locks — one per side.
Home scorekeeper claims a `home` lock; away scorekeeper claims an `away` lock.
Both can hold locks simultaneously — this is the only case where two active locks
are valid on a single game.

```js
scorekeeperAssignments/{gameId} {
  home: { uid, displayName, claimedAt, lastActivity },
  away: { uid, displayName, claimedAt, lastActivity }
}
```

### Conflict Detection

At any point, the official score is:
- Home score: derived from `homeEvents` (authoritative)
- Away score: derived from `awayEvents` (authoritative)

Conflict is detected by comparing:
- `homeObservedScore` (what home tablet thinks away scored) vs. derived away score
- `awayObservedScore` (what away tablet thinks home scored) vs. derived home score

If either comparison diverges beyond a threshold (0 for strict, configurable):
- Both tablets surface a non-blocking alert: "Score discrepancy detected"
- Scorers can reconcile mid-game without stopping play
- Discrepancy is logged but does not block continued scoring

### The "Opposing Team at the Bottom" UI Pattern

The away team appears at the bottom of the home tablet's scorebook — and vice versa.
This is not a full parallel scorebook. It is a minimal running score entry:

```
HOME TABLET VIEW
────────────────────────────────
  HOME TEAM — Eagles 6U
  [full player rows, all stat buttons]

────────────────────────────────
  AWAY TEAM — Wildcats (observed)
  [ - ]  Score: 18  [ + ]       ← manual increment only, no player breakdown
  ⚠ Discrepancy: your record shows 18, their tablet shows 20
```

Discrepancy alert is surfaced inline — not a modal, not blocking. Scorers communicate
and tap to acknowledge resolution. Acknowledged discrepancies are logged with timestamp
and the UID of whoever acknowledged.

### Stat Profile on the Opposing Team

The observed (non-owned) team only tracks running score. No per-player data. No fouls
per player. Team-level timeouts and technicals optionally tracked for conflict resolution
purposes.

The owning team tracks at whatever stat profile was configured for the game:
- **Full** — all stats (default for travel basketball)
- **Standard** — points, personal fouls, technical fouls per player; team timeouts
  and technicals (default for parks and rec)

Stat profile is set at game creation by the organizer or host coach. Both tablets
use the same profile for the owned team.

### Finalization Flow (Dual Scorebook)

```
Both tablets complete their period
  → Each tablet taps "End Game"
  → System compares final scores for discrepancy
  → If scores agree → both stat books finalized simultaneously
  → If scores disagree → resolution screen presented to both tablets
      → Shows: Home tablet home score vs. Away tablet home score
      → Shows: Away tablet away score vs. Home tablet away score
      → Organizer or HC with authority taps "Accept Official Score"
      → Official score locked; both stat books finalized against it
  → Game record marked finalized: true
  → Official record written to scorebookGames/{gameId}.officialRecord
  → Both teams' player stats permanently linked
```

---

## Part 3 — Use Cases

### Tournament Hosting (NTBA / Big Shots style)

- Tournament organizer creates the tournament and all scheduled games on the app
- Each game is Tier 3 (tournament official record)
- Organizer assigns scorekeepers per game (existing scorekeeper assignment flow,
  extended to dual assignment)
- Each scorekeeper gets one side — home or away
- Organizer has override authority to finalize in case of dispute
- Both teams' coaching staff can optionally run their own stat tracking in parallel
  (separate stat book, does not affect official record)

### Parks & Rec Cross-District Games

- District Director creates the game schedule
- Games are Tier 3 with district org as the tournament organizer
- District-assigned scorekeepers handle both tablets
- Both teams' head coaches can run parallel stat tracking if they want deeper data
- Official record finalized by district scorekeeper or district director

### Exhibition Between Two App Orgs

- Tier 2 (linked game)
- Host HC sends invite, guest HC accepts
- Each coach scores their own team on their own device
- No formal finalization authority — both stat books are co-equal
- Conflict resolution is advisory — both coaches agree on final score before closing

### Exhibition Against a Non-App Team

- Tier 2, guest is anonymous
- Host manually enters opponent player names
- Anonymous player stubs created (claimable later)
- Host scores both teams — single tablet, single scorekeeper
- Share link generated for opponent to view/export stats
- If opponent joins the app later, they claim their players and the game appears
  in their history retroactively

---

## Part 4 — Open Questions (Resolve in Planning Session)

### Game Ownership & Authority

- [ ] **Exhibition finalization authority:** With two co-equal stat books and no
  organizer, how does the game get marked "final"? Mutual confirmation (both HCs
  tap Finalize)? Or host has final say?
- [ ] **Orphaned stat books:** A coach tracks a game internally (Tier 1) and later
  discovers the opponent had the same game in the app. Is there a retroactive
  linking flow, or is this permanently a ghost record?
- [ ] **Correction request flow:** For Tier 3 finalized records, what does a
  correction request look like? In-app form to the organizer? What can be corrected
  vs. what is permanently locked?
- [ ] **Non-app opponent claiming stats:** When an opponent joins the app after a
  game and claims their anonymous players, does the game automatically appear in
  their org's history? Does their org owner need to approve this?

### Dual Scorebook Implementation

- [ ] **Score discrepancy threshold:** Zero tolerance (any divergence triggers alert)
  or a small buffer (±1 or ±2 points before alerting)? Zero is safer for official
  records; a small buffer reduces noise from timing differences.
- [ ] **Heartbeat on dual locks:** Same 15-minute stale detection as single
  scorekeeper? What happens if one tablet goes offline — does the other tablet
  continue unilaterally?
- [ ] **HC override on dual game:** Can a head coach break one side's lock and take
  over, same as current single-scorekeeper flow? Or does dual-lock require organizer
  intervention?
- [ ] **Period sync:** Do both tablets need to agree on the current period before
  scoring can continue, or is period tracked independently per side?

### Stat Profiles

- [ ] **Profile configurability:** Is stat profile set per game (at game creation)
  or per org (org-level default that can be overridden per game)?
- [ ] **Profile on linked games:** If home team uses Full and away team uses Standard,
  do they each track at their own profile for their owned team? (Almost certainly yes)
- [ ] **Future profiles:** Are there other profiles beyond Full and Standard worth
  defining now? (Youth recreational Basic — score only, no per-player tracking —
  may still be useful for very young age groups)

### Tournament Hosting as a Product

- [ ] **Tournament organizer account type:** Does hosting a tournament on the app
  require an org account, or is there a standalone tournament organizer tier?
  (Relevant if NTBA or Big Shots wants to use the app without being a "team org")
- [ ] **Cross-org visibility:** After a tournament game is finalized, can both teams
  see the full official record in their History tab? Or only their own stat book?
- [ ] **Bracket management:** Is bracket progression (seeding, advancement) in scope
  for the tournament hosting feature, or is the app only responsible for individual
  game records within a tournament?

---

## Summary

| Tier | Ownership | Dual Scorebook | Finalization Authority |
|---|---|---|---|
| Ghost | Single org | No | N/A — internal only |
| Exhibition | Host org | Optional | Mutual (both HCs) or host |
| Tournament | Tournament org | Yes | Organizer / assigned scorekeeper |

**Implementation order within this gate (TBD in planning session):**
1. Game tier field + schema additions (non-breaking, additive)
2. Exhibition invite flow (reuses invite token pattern)
3. Dual lock system (extends existing scorekeeper lock)
4. Write domain partitioning (homeEvents / awayEvents split)
5. Conflict detection + observed score UI
6. Finalization flow for dual scorebook
7. Stat profiles (Full / Standard)
8. Tournament official record + organizer finalization authority

**Do not begin implementation planning until:**
- Gate 9 (Sub-Org) is complete
- A dedicated full planning session has been held to resolve the open questions above
- The dual scorebook planning session produces its own implementation tasking document
