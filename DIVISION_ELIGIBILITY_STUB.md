# WE-TRACK — Division & Eligibility Architecture Planning
**Document Type:** Architecture Stub — Deferred Feature
**Status:** Stub — Full planning session required before implementation
**Created:** April 2026
**Author:** Whitt's End LLC

> **Do not begin implementation until a dedicated planning session has been held to resolve the open questions in this document.** This stub captures the mental model, schema direction, and known open questions. It is not a tasking document.

---

## Overview

Divisions are ruleset entities that define eligibility criteria for competition. A team is permanently assigned to a division by its org owner. Players are evaluated against the division's rules using their date of birth and grad year. Players age out of teams over time — the team never changes divisions.

This model serves two distinct markets:

**Travel ball organizations:**
A team is stood up for a specific age group ("Eagles 10U") and locked to that division permanently. As players age out, they move to new teams. The org creates new age-group teams each season as needed.

**Recreational leagues (sub-orgs enabled):**
A league org defines divisions that span multiple districts. Teams within each district are assigned to divisions. The league generates season schedules and playoff brackets within each division.

---

## Locked Architectural Principles

These decisions are final and must not be revisited during implementation.

| Principle | Detail |
|---|---|
| **Team is locked to division** | Once an org owner assigns a team to a division, that assignment is permanent. The team does not change divisions. Players age out and move to new teams. |
| **Division is a ruleset, not a bucket** | A division defines eligibility criteria. The system evaluates players against those criteria — divisions do not "contain" players directly. |
| **Two tiers of divisions** | Platform divisions (superadmin-owned, standard governing body rules) and org divisions (org-owner-created, custom rules). Teams reference either type. |
| **Date of birth + grad year are the eligibility inputs** | These two fields on the player profile are sufficient for the eligibility engine. Both are collected at player creation (self-reported, unverified) and later confirmed via document verification. |
| **Self-reported data runs the engine** | Eligibility evaluation runs on self-reported DOB/grad year immediately. Results are flagged as unverified until a birth certificate is confirmed. Verified status is permanent metadata on the evaluation result. |
| **Tournament overrides are non-destructive** | A tournament can apply different cutoff dates without modifying the division's base ruleset. Override lives on the tournament-division relationship, not on the division itself. |

---

## Collection Hierarchy

```
/divisions/{divisionId}/                    ← top-level — not under any org
  profile/
  tournamentOverrides/{tournamentId}/
  teams/{teamId}/                           ← teams competing in this division

/orgs/{orgId}/teams/{teamId}/
  divisionId: string | null                 ← stub field, Gate 7 (already added)
```

---

## Schema

### Division Profile

```js
/divisions/{divisionId} = {
  id:           string,
  name:         string,         // "10U Boys", "8U Coed", "JV Girls", "Varsity"
  sport:        string,         // "basketball" — one division per sport

  // Ownership
  ownedByOrgId: string | null,  // null = platform-level (superadmin-owned)
                                // string = org-level (org-owner-created)
  createdAt:    timestamp,
  createdByUid: string,

  // Eligibility ruleset — all fields nullable; null = no constraint on that dimension
  eligibility: {
    gender:         "male" | "female" | "coed" | null,

    // Age-based constraints — evaluated as of ageCutoffDate
    maxAge:         number | null,        // e.g. 10 — player must be <= this age
    minAge:         number | null,        // e.g. 8  — player must be >= this age
    ageCutoffDate:  string | null,        // "YYYY-MM-DD" — "as of" date for age calc
                                          // e.g. "2026-08-01" = must be 10U as of Aug 1

    // Birth date range — alternative to age-based (some orgs use this directly)
    minBirthDate:   string | null,        // "YYYY-MM-DD" — born on or after
    maxBirthDate:   string | null,        // "YYYY-MM-DD" — born on or before

    // Grade-based constraints — optional, used alongside or instead of age
    minGradYear:    string | null,        // "2031" — graduates no earlier than
    maxGradYear:    string | null,        // "2034" — graduates no later than

    // Evaluation priority — which constraint system to apply if multiple are set
    // "age" = use maxAge/minAge + ageCutoffDate
    // "birthdate" = use minBirthDate/maxBirthDate directly
    // "gradyear" = use minGradYear/maxGradYear
    // "any" = player must satisfy ALL non-null constraints
    evaluationMode: "age" | "birthdate" | "gradyear" | "any",
  },

  // Soft delete
  archivedAt:   timestamp | null,
  archivedBy:   string | null,
}
```

### Tournament Eligibility Override

```js
/divisions/{divisionId}/tournamentOverrides/{tournamentId} = {
  tournamentId:   string,
  tournamentName: string,     // snapshot at time of creation
  orgId:          string,     // tournament org

  // Partial override — only fields that differ from division base ruleset
  // System merges: override fields take precedence over division defaults
  // Unset fields inherit from division base
  eligibility: {
    ageCutoffDate:  string | null,    // e.g. tournament uses July 31 instead of Aug 1
    maxBirthDate:   string | null,
    maxGradYear:    string | null,
    // ... any field from the base eligibility shape
  },

  createdAt:    timestamp,
  createdByUid: string,
}
```

### Division-Team Relationship

```js
/divisions/{divisionId}/teams/{teamId} = {
  teamId:   string,
  orgId:    string,
  orgName:  string,     // snapshot
  teamName: string,     // snapshot
  sport:    string,
  season:   string,     // "2025-2026"
  joinedAt: timestamp,
}
```

### Team Doc Addition (Already Stubbed in Gate 7)

```js
// orgs/{orgId}/teams/{teamId}
{
  // ... all existing fields unchanged ...
  divisionId: string | null,    // null = no division assigned (default)
}
```

### Player Profile Fields (Already in Gate 7)

```js
// Required at player creation — collected in Manage → Roster creation form
// Self-reported initially; verified: true after birth certificate confirmed
dateOfBirth:  string | null,    // "YYYY-MM-DD" — required for eligibility engine
gradYear:     string | null,    // "2031" — required for eligibility engine
gender:       "male" | "female" | null,   // ADD THIS — needed for gender-gated divisions
```

> **Note:** `gender` is not currently in the player profile schema. It needs to be added before the eligibility engine can evaluate gender-gated divisions. Collect at player creation alongside DOB and grad year.

---

## Eligibility Engine

### Function Signature

```js
evaluateEligibility(playerProfile, divisionId, tournamentId = null)

→ {
  eligible:       boolean,
  division:       string,           // division name
  reason:         string | null,    // null if eligible; human-readable if not
  cutoffUsed:     string | null,    // which ageCutoffDate was applied
  ageAtCutoff:    number | null,    // player's age as of cutoff date
  verified:       boolean,          // true only if DOB confirmed via birth certificate
  overrideApplied: boolean,         // true if tournament override was used
}
```

### Evaluation Logic

```
1. Load division profile
2. If tournamentId provided: load override, merge with base ruleset
   (override fields take precedence; unset override fields inherit from base)
3. Apply evaluationMode:
   - "age":       calculate player age as of ageCutoffDate; check minAge/maxAge
   - "birthdate": check minBirthDate <= player.dateOfBirth <= maxBirthDate
   - "gradyear":  check minGradYear <= player.gradYear <= maxGradYear
   - "any":       evaluate ALL non-null constraints; player must satisfy all
4. Check gender constraint if set
5. Return result with verification status
```

### Auto-Population at Registration

When a player registers through an org portal:

```
Player provides: name, dateOfBirth, gradYear, gender
    ↓
System runs evaluateEligibility() against all active divisions in the org
    ↓
One match:      Suggest division + list teams competing in it
                "Your child is eligible for 10U Boys.
                 Teams: Eagles 10U, Wildcats 10U.
                 Contact your coach to be added to a roster."

Multiple match: Prompt selection
                "Your child is eligible for 10U Boys or 8U Boys.
                 Please select which division they will compete in."

No match:       Flag for org admin review
                "No active divisions match. Contact your org administrator."
    ↓
Player entity created with suggestedDivisionId stored
Coach notified → approves roster placement
```

### Roster Add Eligibility Warning

When a coach adds a player to a team that is assigned to a division:

```
Coach adds player to Eagles 10U (divisionId: "div_10u_boys")
    ↓
System runs evaluateEligibility(player, "div_10u_boys")
    ↓
Eligible + verified:    Silent pass — no warning
Eligible + unverified:  Yellow warning — "Eligible based on self-reported DOB.
                         Birth certificate not yet confirmed."
Ineligible:             Red warning — "This player does not meet 10U Boys
                         eligibility requirements. [reason]
                         Add anyway?" (coach override with audit log entry)
```

### Tournament Roster Check

When a team registers for a tournament or a coach views tournament eligibility:

```
For each player on the roster:
  Run evaluateEligibility(player, team.divisionId, tournamentId)
    ↓
All eligible:     Green — team is tournament-ready for this division
Any ineligible:   Red — list affected players with reasons
                  "3 players do not meet tournament cutoff requirements."
                  Coach must remove or replace those players before entry.
```

---

## Platform vs Org Divisions

| | Platform Division | Org Division |
|---|---|---|
| **Owner** | Superadmin | Org owner |
| **Created by** | Whitt's End superadmin account | Org owner in app |
| **Example** | "AAU 10U Boys", "NTBA 12U" | "8U Recreational", "HS JV Girls" |
| **Who can reference it** | Any org or tournament | Only that org's teams |
| **Ruleset editable by** | Superadmin only | Org owner |
| **Tournament overrides** | Allowed | Allowed |

Tournament organizers (future Tier 3 game model) reference platform divisions to ensure cross-org eligibility consistency. Org owners reference either type when assigning a team to a division.

---

## Integration Points with Existing Systems

| System | Integration | Gate |
|---|---|---|
| Player profile | DOB + gradYear + gender as required creation fields | Gate 7 (adjust) |
| Team doc | `divisionId: null` stub field | Gate 7 (already added) |
| Org registration / claim flow | Auto-population suggestion at sign-up | Division gate |
| Roster add (Manage → Roster) | Eligibility warning on player add | Division gate |
| Tournament hosting (Tier 3) | Tournament override + roster eligibility check | Dual scorebook gate |
| Coach approval flow | Ineligibility flag surfaces in approval UI | Division gate |
| Recruiting profile | Display division history on player public page | Post-Gate 8 |
| PDF exports / reports | Include division on game records and stat reports | Division gate |
| Bracket generation | Query all teams where divisionId == X + tournamentId == Y | Division gate |
| Season schedule generation | Round-robin for all teams in a division | Division gate |

---

## Implementation Order (Within Division Gate)

1. Superadmin UI — create and manage platform divisions
2. Org owner UI — create org divisions, assign teams
3. Eligibility engine (`src/utils/eligibilityEngine.js`)
4. Roster add warning (Manage → Roster)
5. Auto-population at registration
6. Tournament override creation (org owner or tournament organizer)
7. Tournament roster eligibility check
8. Bracket generation (depends on dual scorebook gate)
9. Season schedule generation (depends on sub-org Phase B)

---

## Open Questions (Resolve in Planning Session)

| Question | Options | Notes |
|---|---|---|
| Can a team belong to multiple divisions? | Yes / No | Unlikely but edge case: team plays recreational and competitive simultaneously |
| Who can override an ineligibility flag? | HC only / Owner only / Any coach | Needs audit log regardless |
| Does division appear on player stat records as metadata? | Yes / No | Useful for recruiting — "competed at 10U AAU level" |
| Are platform divisions seeded at launch or created on demand? | Seed common ones / Create as needed | NTBA, AAU standard divisions could be pre-seeded |
| What happens to division assignment when a team is archived? | Preserve / Clear | Division-team relationship should probably be archived with the team |
| Can an org owner modify a platform division's rules for their org? | Yes (org override) / No | Tournament override pattern could extend here |
| How does gender work for coed divisions? | Any gender eligible / Must be declared coed | Some youth leagues are coed by default |
| Grace period for age cutoffs? | None / Configurable | Some leagues allow players within 1-2 months of cutoff |
| Does the engine re-evaluate automatically when DOB is verified? | Yes / No / Coach-triggered | Auto-re-eval could trigger notifications |
| How are divisions displayed on the public recruiting profile? | Division name only / Full ruleset / Age group only | Privacy consideration for DOB |

---

## Gate 7 Adjustments Required Now

The following small changes should be made in Gate 7 before this feature ships — they are additive and do not require the full division feature to be built:

1. **`divisionId: null`** added to `writeTeamDoc()` — already captured in Gate 7 tasking
2. **`dateOfBirth` and `gradYear` as required fields** in the player creation form (Manage → Roster → Add Player) — self-reported, unverified at creation
3. **`gender: "male" | "female" | null`** added to player profile schema — collected at player creation alongside DOB and grad year

These three fields are the minimum the eligibility engine needs to operate. Collecting them now means zero backfill work when the division feature ships.

---

## Related Documents

| Document | Relationship |
|---|---|
| `MASTER_PLAN.md` | Canonical reference — division gate will add entries to the build phase table |
| `PLAYER_ENTITY_SCHEMA.md` | Player profile schema — DOB, gradYear, gender fields |
| `SUB_ORG_ARCHITECTURE.md` | Sub-org (district) grouping — works alongside divisions for league orgs |
| `DUAL_SCOREBOOK_GAME_OWNERSHIP_STUB.md` | Tournament hosting — tournament override and bracket generation depend on both |

---

*Whitt's End LLC | We-Track | Division & Eligibility Stub | April 2026*
*Next step: Full planning session before implementation. Do not begin building until open questions are resolved.*
