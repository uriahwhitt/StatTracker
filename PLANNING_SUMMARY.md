> **SUPERSEDED — Do not use as primary reference.**
> This document is a session notes snapshot from March 23, 2026. All decisions recorded here have been incorporated into `MASTER_PLAN.md`. Operational state (e.g. "Mr. Jordan's organization already created") may be stale. Use `MASTER_PLAN.md` and `IMPLEMENTATION_STATUS.md` for current project state.

# StatTracker — Product Planning Summary
**Session Date: March 23, 2026**
This document summarizes product decisions and concepts discussed in this planning session, intended as a reference for the next development phase.

---

## 1. Monetization

- **Model:** Ad-supported only. No paywalls or subscription fees.
- **Ad format:** Small static banner ads only. No pop-ups, no interstitials, nothing requiring user interaction to dismiss.
- **Goal:** Modest revenue to cover hosting costs as the platform expands. Not a primary revenue driver.
- **Target audience awareness:** Many users are lower-income basketball families. Ad experience must be respectful.
- **Anti-pattern reference:** Heja — overly aggressive ads that frustrate users. This is the north star for what NOT to do.

### Placement Strategy

| Screen | Ad Allowed | Notes |
|---|---|---|
| Track tab (live) | ❌ No | Sacred — accidental taps during games would be infuriating |
| Scorebook (live) | ❌ No | Same as above |
| History tab | ✅ Yes | Passive browsing, bottom banner |
| Reports tab | ✅ Yes | Passive browsing, bottom banner |
| Tournament tab | ✅ Yes | Passive browsing, bottom banner |
| Calendar (future) | ✅ Yes | Users in reading/scrolling mode |
| Chat (future) | ✅ Yes | Between input bar and messages, subtle placement |

### Implementation Notes
- Google AdSense is the appropriate network for a PWA (not AdMob, which is native-only)
- Anchor ad format (fixed bottom banner) works well — users mentally filter it out vs surprise pop-ups
- As communication features and user base grow, ad value compounds naturally

---

## 2. PWA Installation UX

- The browser menu install flow loses users — most people don't know it exists.
- **Android:** Use the `beforeinstallprompt` event to trigger a native install dialog from a custom in-app button/banner. Service worker already registered in `main.jsx` — halfway there.
- **iOS:** Apple blocks `beforeinstallprompt`. Best option is a one-time visual guide (screenshot/icon showing Share → Add to Home Screen steps).
- Show a dismissable install prompt on first launch, plus a persistent "Install App" option in Settings.
- **Long term:** Bubblewrap (Google tool) can wrap the PWA as a proper Google Play Store listing — eliminates the browser menu confusion entirely on Android.

---

## 3. Welcome Screen & User Onboarding

### Two User Tiers

| Tier | Auth | Access | Data |
|---|---|---|---|
| **Solo / Anonymous** | None required | Individual tracker + personal history/reports | Stored in own Firebase path, fully private |
| **Team Member** | Google OAuth required | All of the above + team data, scorebook read, communication (future) | Personal stats never affect official team records |

### Onboarding Flow
- First launch detects auth state and routes accordingly
- New users see a welcome screen with two clear paths: "Get Started" (solo) and "Sign in with Google" (team access)
- Returning users (anonymous or authenticated) skip the welcome screen entirely
- **Tutorial mode** handles both use cases — solo orientation and team feature orientation
- When an anonymous user later joins a team, a transition moment notification explains: *"Your personally tracked games are still in My Stats. Official team records are separate."*

---

## 4. Stats Separation — Personal vs Official

This is a critical UX clarity problem as users gain access to both personal and team data.

### Three Data Buckets

| Type | Source | Editable By | Visible To |
|---|---|---|---|
| **Personal tracked stats** | User's own tap input during games | User only | User only |
| **Official team stats** | Scorekeeper via Scorebook | Scorekeeper + coaches | All team members (read) |
| **Team stats (read-only view)** | Official record | No one at this level | Parents, players |

### UI Solution
- **"My Stats" vs "Official Stats" toggle** at the top of History and Reports screens
- Never mix the two in a single view without explicit labeling
- Every game card in history shows a visual indicator — personal icon vs team badge
- A parent who tracked 18 points but official book shows 14 needs to understand this without the app feeling broken

---

## 5. Multi-Team / Multi-Player Navigation

### Problem
A parent with 2 kids on 2 teams, or 1 kid on 2 teams, needs clear context switching or the app becomes confusing.

### Solution: Context Toggle Hierarchy
Extending the existing player toggle pattern upward:

```
Team Selector → Player Selector → All screens scope to selection
```

- If user is on multiple teams, team selector appears first
- Player selector then scopes to the selected team
- History, Reports, and Communication all filter from that selection
- **App remembers last selected team and player between sessions** (persisted state)

### Edge Case: Parent Who Is Also a Coach
- They hold two different roles across two teams
- Team toggle handles the switch
- Available screens and permissions change based on which team is active
- Handled naturally by the existing role architecture

---

## 6. Organizational Handoff & Role Assignment

### Current State
- Single user (developer) holds superadmin + org owner + all team control
- Mr. Jordan's organization already created in the system

### Planned Handoffs

| Handoff | Who | When | Mechanism |
|---|---|---|---|
| Team Head Coach | Coach Corey | After Google OAuth is live | Role assignment in management screen |
| Org Ownership | Mr. Jordan | After Coach Corey + roster are established | Org ownership transfer |

### How It Works
- A role management screen (in Settings or Manage, gated to appropriate permission level) allows lookup by Google account
- Assigning org ownership to Mr. Jordan is a one-time transfer — he gains full control of all 15 teams
- Coach Corey gets Head Coach role on the specific team
- Either superadmin or Mr. Jordan (once onboarded) can assign Coach Corey

### Superadmin Role Philosophy
- **Invisible to all users** — no UI indicator, no visible presence
- Exists solely for: fixing issues, making adjustments, transferring ownership, viewing system-wide usage and stats
- Developer acts as one-man help desk for the platform
- Superadmin custom claim stored in Firebase Auth (not Firestore) to prevent tampering
- Superadmin has read access to all orgs system-wide without needing an explicit org role assigned

---

## 7. End-of-Season & Player Data Longevity

### The Core Problem
When a season ends and players move on, their stat history must not be lost or inaccessible.

### Solution: Player Profile as First-Class Entity

The player profile lives at the **top level of Firestore**, not nested under any org or team. Team membership is a relationship record, not ownership.

```
players/{playerId}
  - name
  - birthYear
  - createdAt
  - linkedAccounts: [
      { uid, relationship: "self" | "parent" | "guardian", approvedAt, approvedBy }
    ]
  - orgs: [
      { orgId, teamId, season, status: "active" | "archived" }
    ]
```

### How It Works
- Team membership is marked **archived** at season end — player entity and all stats remain intact
- When a player joins a new team next season, a new membership record points to the **same player entity**
- Career stats accumulate naturally across all seasons and teams
- If a player leaves for an org not using the app, their claimed profile and full history remain accessible through their personal account

### The Unclaimed Player Problem
- If no Google account has claimed a player profile, the stats live in the org's records but have no personal owner
- Org owners can generate a **claim code/link** for a specific player profile — triggerable even after the season ends
- This allows late claiming without data loss

### Independent Mode
- A claimed player profile can still receive personally tracked stats even without active org membership
- Keeps solo tracking alive at the player level, not just the user level

---

## 8. Player Profile Linking — Coach Approval Flow

Modeled after Heja's roster linking UX.

### Flow
1. Coach creates the player profile when building the roster
2. A unique claim code or link is generated for that player
3. Parent or player opens the app, signs into Google, finds the team via join code
4. Prompted to **link to a player on the roster** — selects "This is me" or "This is my child/family member"
5. Coach receives a notification and **approves the link**
6. Google account and player entity are permanently connected

### Why Coach Approval
- Prevents random accounts from claiming player profiles
- Allows multiple accounts per player (player + parent both approved)
- Coach sees all pending link requests and can approve or deny

### Key Rules
- Multiple Google accounts can be linked to one player (player + one or more family members)
- Removing a player from a team or org does **not** break the account link
- The link is permanent once approved — data persists regardless of future org changes
- Anonymous users cannot claim a player profile — Google account required

---

## 9. Open Questions for Next Planning Phase

- What does the tutorial mode look like in detail for each user type?
- How should the "My Stats vs Official Stats" toggle behave when a user has never used the team scorebook?
- Should the install prompt appear on first load or after a user has taken some action (showing intent)?
- What is the UX for a parent generating a claim code after their kid's season has already ended?
- When Mr. Jordan becomes org owner, does he need an onboarding flow to understand the platform, or is that handled manually?

---

*This document covers the planning session of March 23, 2026. For auth architecture details see PHASE2_ARCHITECTURE.md. For data model and component structure see ARCHITECTURE.md.*
