# WE TRACK — Sub-Org Architecture Planning
**Created:** April 14, 2026
**Status:** Partial — schema prep ready for Gate 7; full feature deferred to Phase 3
**Author:** Whitt's End LLC

---

## Overview

Sub-orgs are an opt-in feature that allows a large organization to create named divisions
or districts underneath the top-level org. This is not needed for travel basketball orgs
(the initial market), but is a confirmed requirement for the second target client: county
parks and recreation programs, which are typically divided into geographic districts each
containing multiple teams across age groups.

Sub-orgs are **disabled by default**. An org owner must explicitly enable the feature,
which unlocks sub-org creation and the District Director role.

---

## Target Use Case

**County Parks & Recreation:**
```
Org — County Parks & Rec (Commissioner / Org Owner)
  ├── District 1 (District Director)
  │     ├── 8U Red
  │     ├── 8U Blue
  │     └── 10U A
  ├── District 2 (District Director)
  │     ├── 8U Gold
  │     └── 10U B
  └── District 3 (District Director)
        └── ...
```

**Travel Basketball (sub-orgs disabled — no change to current behavior):**
```
Org — Eagles Travel (Owner)
  ├── 6U Team
  ├── 8U Team
  └── 10U Team
```

---

## Two-Phase Implementation

### Phase A — Schema Prep (Gate 7 or earlier)

> **Schema update:** The sub-org collection and field definitions in this document are consistent with PLAYER_ENTITY_SCHEMA.md §4. If there is any conflict, PLAYER_ENTITY_SCHEMA.md takes precedence.

**Do this now while the database is small and a clean reseed is trivial.**

Two additive nullable fields only. No UI. No new roles. No rule changes. No migration
required for existing data.

#### Team doc addition
```js
// orgs/{orgId}/teams/{teamId}
{
  // ... all existing fields unchanged ...
  subOrgId: string | null,   // null = team belongs directly to org (default)
}
```

#### Org doc addition
```js
// orgs/{orgId}
{
  // ... all existing fields unchanged ...
  subOrgsEnabled: boolean,   // false by default; owner-toggled
}
```

#### New top-level sub-org collection
```js
// orgs/{orgId}/subOrgs/{subOrgId}
{
  id: string,
  orgId: string,
  name: string,              // e.g. "District 1", "North District"
  createdAt: timestamp,
  createdBy: string,         // owner UID
}
```

**Claude Code task (Gate 7 or 7.5):**
- Add `subOrgId: null` to `writeTeamDoc()` default shape
- Add `subOrgsEnabled: false` to org creation doc in `writeOrgDoc()`
- Define `orgs/{orgId}/subOrgs/{subOrgId}` collection in `firestore.rules` with
  owner-only write, org-member read
- No UI changes required

---

### Phase B — Full Feature (Phase 3, post-Gate 8)

**Prerequisites:** Gate 7.5 (App Shell Restructure) and Gate 8 (Communication) must be
complete. The sidebar team switcher grouping and district-level comms channels both
depend on those foundations.

**Suggested gate label:** Phase 3, Gate 9 (or Gate 3 if phase numbering resets)

---

## Full Feature Scope (Phase B)

### Sub-Org Management UI

Org owner UI (in sidebar → Org Settings):
- Toggle to enable sub-orgs (`subOrgsEnabled: true`)
- Create / rename / delete sub-orgs
- Assign existing teams to a sub-org (sets `subOrgId` on team doc)
- Unassigned teams remain visible at the org level with no sub-org grouping

### District Director Role

New role scoped to `orgId + subOrgId`. Sits between Org Owner and Head Coach in the
hierarchy.

```
Org Owner
  └── District Director  (new — scoped to one subOrgId)
        └── Head Coach   (scoped to one teamId)
```

**District Director permissions:**

| Permission | Access |
|---|---|
| Scorebook | None — no scoring access |
| Roster | Read-only across all teams in their sub-org |
| Schedule | Read-only across all teams in their sub-org |
| Members | View only — cannot invite or remove |
| Compliance | Full — compliance dashboard across all teams in sub-org |
| Reports | Full — can generate reports across all teams in sub-org |
| Messaging | Full — district-level comms channels |
| Financials | Read-only if enabled |
| Equipment | None |
| Season Config | None |
| Org Settings | None |

District Director is **not** a team member on any specific team. Their `teamId` is null;
their `subOrgId` is set.

**Role doc shape:**
```js
// users/{uid}/roles/{orgId}
{
  role: "districtdirector",   // new role value
  orgId: string,
  teamId: null,               // not team-scoped
  subOrgId: string,           // scoped to one sub-org
  permissions: { ... }        // computed from defaultPermissions("districtdirector")
}
```

**`defaultPermissions("districtdirector")`** (to be added to `roles.js`):
```js
{
  scorebook:    false,
  roster:       false,   // read enforced at query level, not write gate
  schedule:     false,
  members:      false,
  documents:    true,
  tasks:        true,
  compliance:   true,
  reports:      true,
  messaging:    true,
  financials:   false,
  equipment:    false,
  seasonConfig: false,
  orgSettings:  false,
}
```

### Sidebar Team Switcher — Grouped View

When `subOrgsEnabled: true`, the team switcher dropdown groups teams under their
sub-org name. Teams with `subOrgId: null` appear under "Other" or directly under the
org name.

```
[ County P&R ▾ ]
─────────────────────────
District 1
  8U Red
  8U Blue
  10U A
District 2
  8U Gold
  10U B
─────────────────────────
(no sub-org)
  Admin Team
```

When `subOrgsEnabled: false` (travel orgs), the dropdown renders as a flat list —
identical to current behavior. No UI change for unaffected orgs.

### District-Level Communications

District Directors get a district-scoped section in the ORG area of the sidebar:

```
ORG
  📢 Announcements          ← org-wide, all members
  🏆 District Directors     ← custom org channel (owner-created)

DISTRICT — District 1       ← new section, visible to district director + owner only
  💬 District Chat          ← auto-created on sub-org creation
  [custom district channels]
```

District channels are group conversations with:
```js
conversations/{conversationId} {
  type: "group",
  orgId: string,
  subOrgId: string,    // scoped to district
  teamId: null,
  scope: "district",   // new scope value (add to §3.22 when Gate 9 is planned)
  ...
}
```

District chat `memberUids` is populated by:
- The district director(s) of that sub-org
- The org owner
- Head coaches of all teams in the sub-org (auto-enrolled on team assignment to sub-org)

### Firestore Security Rules Additions

```js
// Sub-org collection — owner write, org member read
match /orgs/{orgId}/subOrgs/{subOrgId} {
  allow read: if hasOrgRole(orgId);
  allow write: if isOwner(orgId) || isSuperadmin();
}

// District director data access helper
function isDistrictDirector(orgId, subOrgId) {
  return getRoleDoc(orgId).role == "districtdirector"
      && getRoleDoc(orgId).subOrgId == subOrgId;
}

// Team reads: district director can read any team in their sub-org
match /orgs/{orgId}/data/db {
  allow read: if hasOrgRole(orgId)
              || isDistrictDirector(orgId, getTeamSubOrgId(teamId))
              || isSuperadmin();
}
```

---

## Billing Consideration

Sub-org support is a premium feature. Recommended tier gate: **Org Standard or above**.

Free and Org Basic tiers have `subOrgsEnabled` locked to `false` regardless of owner
toggle. The toggle in Org Settings is either hidden or shows a paywall prompt on those
tiers.

This is a natural upsell for parks and rec programs — they are institutional customers
who expect to pay for administrative tools.

---

## Impact on Existing Architecture

| Area | Impact |
|---|---|
| `roles.js` | Add `districtdirector` to role enum, labels, colors, invite selector |
| `defaultPermissions()` | Add `districtdirector` case |
| `firestore.rules` | Add sub-org collection rules + `isDistrictDirector()` helper |
| `storage.js` | No change — sub-org is metadata, not a data path |
| Sidebar team switcher | Grouped rendering when `subOrgsEnabled: true`; flat list otherwise |
| Conversations schema | Add `subOrgId` and `scope: "district"` to group conversation doc |
| Bottom nav / tabs | No change |
| Existing team docs | `subOrgId: null` by default — fully backward compatible |
| Existing org docs | `subOrgsEnabled: false` by default — fully backward compatible |

No existing functionality is affected when `subOrgsEnabled: false`. The feature is
entirely additive.

---

## Open Questions (Resolve Before Phase B Gate Planning)

- [ ] **District director invite flow:** Same invite link pattern as coach invites, or a
  separate org-admin-only flow? District directors are institutional hires, not
  community members — likely the latter.
- [ ] **Multiple district directors per sub-org:** Is one director per district the rule,
  or can a sub-org have co-directors? Conflict handling parallel to HC conflict?
- [ ] **Team reassignment:** If a team is moved from District 1 to District 2, what
  happens to the head coach's district chat membership? Auto-update on `subOrgId` change?
- [ ] **District director and team chat:** Does a district director get read access to
  individual team chats within their district, or only the district-level channel?
  (Probably read-only access — they need visibility but shouldn't be posting in team chats)
- [ ] **Org announcements reach:** Do org announcements reach district directors and their
  teams the same way? (Almost certainly yes — announcements are org-wide by definition)
- [ ] **Billing enforcement:** At what billing tier does sub-org unlock? Confirm before
  building paywall gate logic.
- [ ] **Sub-org deletion:** What happens to teams assigned to a deleted sub-org? Revert
  to `subOrgId: null` (unassigned) or block deletion if teams exist?

---

## Summary

| What | When | Effort |
|---|---|---|
| Add `subOrgId` to team doc, `subOrgsEnabled` to org doc, define subOrgs collection in rules | Gate 7 or 7.5 | Trivial — 1 Claude Code session, < 1 hour |
| Full sub-org feature: UI, District Director role, grouped sidebar, district comms | Phase 3, Gate 9 | Full gate — multiple sessions |

The schema prep in Gate 7/7.5 costs almost nothing and eliminates any future migration
risk. The full feature waits until travel basketball is validated in production and the
parks and rec relationship is ready to convert.
