> **SUPERSEDED — Do not use as primary reference.**
> This document is preserved for historical context. Communication features (Group Chat, Direct Messages, Team Calendar) are specified in `MASTER_PLAN.md §3` and sequenced in `MASTER_PLAN.md §6`. Where this document and `MASTER_PLAN.md` conflict, `MASTER_PLAN.md` takes precedence. The data schema in §7 of this document is not yet implemented and may differ from the final schema in `MASTER_PLAN.md §2.7`.

# StatTracker — Communication Feature Planning Document

**Status:** Superseded by MASTER_PLAN.md
**Date:** March 2026
**Covers:** Group Chat · Direct Messages · Team Calendar
**Prerequisites:** Google OAuth for coaches (in progress) · Parent/Player invite + verification flow

---

## Table of Contents

1. [Overview & Design Philosophy](#1-overview--design-philosophy)
2. [User Roles & Access](#2-user-roles--access)
3. [Player Entity & Account Linking](#3-player-entity--account-linking)
4. [Group Chat](#4-group-chat)
5. [Direct Messages](#5-direct-messages)
6. [Team Calendar](#6-team-calendar)
7. [Firestore Data Schema](#7-firestore-data-schema)
8. [Security Rules Approach](#8-security-rules-approach)
9. [Notifications](#9-notifications)
10. [UI/UX Architecture](#10-uiux-architecture)
11. [Implementation Sequencing](#11-implementation-sequencing)
12. [Open Questions](#12-open-questions)

---

## 1. Overview & Design Philosophy

Communication in StatTracker covers three interconnected features: group team chats, direct messages between coaches and players/parents, and team calendars with a unified personal view. These features share a common data model and are gated behind verified team membership.

**Core principles driving the design:**

- **Team is the top-level context** for all communication. Navigation is organized around teams, not around individual children or roles. This unifies the coach and parent experience and avoids separate implementations for each persona.
- **One DM thread per user pair, ever.** Regardless of how many teams connect two people, there is exactly one direct message conversation between any two UIDs. Team context is carried by a tag on individual messages, not by separate threads.
- **Coaches are power users, parents are casual users.** The same underlying data supports both, but the UI rendered for each is tuned to their needs — coaches get a flat filterable view across all teams, parents get a clean scoped view per team.
- **Communication enrollment is automatic.** When a coach approves a parent/player account link, they are automatically added to that team's group chat and calendar. No separate opt-in required.
- **No anonymous participation.** All communication features require a verified, authenticated account. Anonymous player entities are placeholders only and cannot participate in chat or calendar until claimed by a real user.

---

## 2. User Roles & Access

| Role | Group Chat | Direct Messages | Calendar |
|---|---|---|---|
| Org Admin | All teams in org | Anyone in org | All team calendars |
| Coach | Create + post in own teams | Message any player/parent across all their teams | Create + edit events for own teams |
| Player | Read + reply in own team chats | Receive DMs from coach only | View own team calendar |
| Parent | Read + reply in own team chats | Receive DMs from coach only | View + subscribe to child's team calendars |

**Notes:**
- Parents and players cannot initiate DMs — coaches initiate all direct conversations
- Parents cannot message other parents
- Players cannot message other players through the app
- A coach running multiple teams has unified access across all of them without switching context

---

## 3. Player Entity & Account Linking

The player entity acts as the universal join point for all communication, calendar, and stat access. This model persists across team and org changes.

**The lifecycle:**

```
Coach creates anonymous player entity (name, jersey, team)
    ↓
Coach sends invite code to parent/player
    ↓
Parent/player creates account via Google OAuth, claims player entity
    ↓
Coach reviews and approves the link
    ↓
UID is permanently bound to that player entity
    ↓  (automatic side effects on approval)
User added to team group chat memberUids
User added to team calendar subscription
Push notification: "You've been added to Eagles 6U"
```

**On team/org transfer:**

When a player moves to a new org, the new coach creates a fresh anonymous player entity. The player/parent claims it using the same account. The system merges the two entities, preserving full stat history. The UID carries forward unchanged — all prior associations (old DM threads, old team chat read receipts) remain accessible but read-only. The player is enrolled in the new team's group chat and calendar automatically on approval.

**Parent → multiple players:**

A parent account can be linked to multiple player entities across multiple teams and orgs. Each link goes through the same coach-approval flow. The parent's team list in the UI reflects all active team memberships across all their children.

---

## 4. Group Chat

### Structure

Each team has exactly one group chat, created automatically when the team is created. The coach owns it. All verified members of that team roster are enrolled automatically.

Group chats support:
- Coach broadcast messages (schedule changes, announcements)
- Member replies
- Optional `allowReplies: false` flag for announcement-only threads (coach's choice per message or per conversation)

### Enrollment & Removal

- **Enroll:** Triggered automatically on coach approval of a player/parent account link
- **Remove:** Triggered when a player is removed from a roster. Prior message history is preserved in the conversation but the removed user loses write access and stops receiving new messages
- **Re-enroll:** If a player returns to the team, re-approval re-adds them

### Multi-child in same team

If two siblings are on the same team, their parent is enrolled once in that team's group chat — not twice. The system deduplicates by UID when processing enrollment.

---

## 5. Direct Messages

### One Thread Per User Pair

There is exactly one DM conversation between any two UIDs, regardless of how many teams they share. This is a deliberate UX decision — coaches should never wonder which thread a prior conversation happened in.

**Deterministic conversation ID:**
```js
const dmId = [uid1, uid2].sort().join('_')
```

This allows direct document lookup (no query needed) and prevents duplicate thread creation from race conditions.

### Team Context Tagging

Since a single DM thread may span multiple teams and seasons, individual messages carry an optional `teamContext` field:

```js
{
  senderUid: "uid_coach",
  text: "Practice moved to 6pm Friday",
  sentAt: timestamp,
  teamContext: "Eagles 6U"   // set at send time, displayed as a label in thread
}
```

When a coach composes a message, the UI pre-selects the most recently active shared team as the default context tag, with an option to change it. This gives both parties immediate clarity on which team/child the message concerns without fragmenting the thread.

### Coach Initiates Only

Parents and players cannot start new DM threads. They can only reply to threads a coach has opened. This keeps communication coach-managed and reduces noise.

---

## 6. Team Calendar

### Team Calendar vs. Personal Calendar

**Team calendars** are owned by the coach/org. Events live on the team and are the single source of truth. When a coach updates an event, all subscribers see the change immediately — there is no copying of events into personal calendars.

**Personal calendar** is a unified parent-facing view that aggregates events from all subscribed team calendars. Parents toggle which teams' calendars are visible. Color-coding distinguishes teams at a glance.

### Event Types

- Practice
- Game (links to `scheduledGame` entity where applicable)
- Tournament (links to `tournament` entity)
- Team meeting
- Custom

### Subscription Model

- Parents are auto-subscribed to a team calendar on the same approval event that enrolls them in group chat
- Each subscription is a toggle (on/off) — parents can hide a team's calendar temporarily without losing the subscription
- Coaches see all their teams' calendars simultaneously by default, with the same per-team toggle available

### Calendar ↔ Scheduled Games Integration

When a `scheduledGame` is created in the Manage tab, it automatically generates a corresponding calendar event on the team's calendar. Updates to the scheduled game (time change, location change, status) propagate to the calendar event. This avoids coaches having to enter the same information twice.

---

## 7. Firestore Data Schema

### Conversations

```js
// Group chat
conversations/{conversationId} {
  type: "group",
  orgId: string,
  teamId: string,
  name: string,                  // e.g. "Eagles 6U Team Chat"
  allowReplies: boolean,
  memberUids: string[],
  members: [                     // denormalized for UI rendering — no joins needed
    {
      uid: string,
      displayName: string,
      role: "coach" | "player" | "parent",
      teamName: string | null,   // null for coach (they own the team)
      playerName: string | null  // for parents: which child this membership is via
    }
  ],
  lastMessage: string,
  lastMessageAt: timestamp,
  createdBy: string              // coach UID
}

// Direct message
conversations/{uid1_uid2} {     // deterministic ID — sorted UIDs joined by underscore
  type: "direct",
  memberUids: [uid1, uid2],
  members: [                     // denormalized
    { uid: string, displayName: string, role: string, teamNames: string[] }
  ],
  lastMessage: string,
  lastMessageAt: timestamp
  // NO teamId — DMs are person-to-person, not team-scoped
}
```

### Messages

```js
conversations/{conversationId}/messages/{messageId} {
  senderUid: string,
  senderName: string,            // denormalized
  text: string,
  sentAt: timestamp,
  teamContext: string | null,    // DMs only — which team this message concerns
  readBy: { [uid]: timestamp }   // read receipts map
}
```

### Calendar Events

```js
orgs/{orgId}/teams/{teamId}/calendarEvents/{eventId} {
  type: "practice" | "game" | "tournament" | "meeting" | "custom",
  title: string,
  startAt: timestamp,
  endAt: timestamp,
  location: string | null,
  notes: string | null,
  scheduledGameId: string | null,   // links to scheduledGames collection if applicable
  tournamentId: string | null,
  createdBy: string,                // coach UID
  updatedAt: timestamp
}
```

### Calendar Subscriptions

```js
users/{uid}/calendarSubscriptions/{teamId} {
  teamId: string,
  teamName: string,              // denormalized
  orgId: string,
  color: string,                 // hex — assigned on enrollment, user can override
  visible: boolean,              // toggle — default true
  subscribedAt: timestamp
}
```

### Standard Query Pattern

Both coaches and parents use the same base query for conversations — the UI layer handles rendering differences:

```js
// Fetch all conversations for current user
db.collection('conversations')
  .where('memberUids', 'array-contains', currentUid)
  .orderBy('lastMessageAt', 'desc')

// Result separation in UI:
// type === "group"  → render under Team Chats
// type === "direct" → render under Direct Messages
```

---

## 8. Security Rules Approach

All communication features require authenticated, non-anonymous users. The role model stored at `users/{uid}/roles/{orgId}` is the enforcement foundation.

**Key rules to implement:**

- A user can only read a conversation if their UID is in `memberUids`
- A user can only write a message to a conversation if their UID is in `memberUids`
- Only a coach (verified via role) can create group conversations for a team within their org
- Only a coach can initiate a new DM thread
- A parent/player can reply to an existing DM thread they are a member of
- Calendar events can only be created/edited by a coach role within the correct orgId
- Calendar subscriptions are private to the owning UID
- Removed roster members lose write access to group chat but retain read access to history up to their removal date

---

## 9. Notifications

Push notifications are handled via Firebase Cloud Messaging (FCM). Every notification payload must carry enough context to deep-link the user directly to the correct conversation or calendar event without requiring manual navigation.

**Required payload fields:**

```js
{
  conversationId: string,   // for chat notifications
  teamId: string,           // for context switching
  type: "group_message" | "direct_message" | "calendar_event",
  eventId: string | null    // for calendar notifications
}
```

**Behavior on notification tap:**

- **Coach:** Opens directly to the relevant conversation in their unified view. No context switch needed.
- **Parent:** App switches to the correct team context automatically using `teamId`, then opens the conversation or calendar event.

Notification badges on the team switcher indicate unread activity across all contexts so a parent knows to check another team without having to switch manually first.

---

## 10. UI/UX Architecture

### Team Switcher (Shared — Coach and Parent)

A persistent team switcher at the top of the communication section is the primary navigation element for both coaches and parents. The component renders identically for both roles — only the list contents differ.

```
[ 🏀 Eagles Travel 6U ▾ ]
```

**Coach dropdown:**
```
Eagles Travel 6U
Wildcats JV
Lincoln Varsity
```

**Parent dropdown:**
```
Eagles Travel 6U   (Jake + Emma)
Wildcats Travel    (Sophie)
Lincoln Middle     (Jake)
```

The child identifier badge on parent entries provides at-a-glance context for which child links them to that team, without requiring a child-first navigation layer.

### Coach Chat Layout (Discord-inspired)

```
Left sidebar (persistent, filterable):
├── TEAM CHATS
│   ├── # Eagles Travel 6U  🔴2
│   ├── # Wildcats JV
│   └── # Lincoln Varsity
└── DIRECT MESSAGES
    ├── Jake M.  •  Eagles          🔴1
    ├── Sophie's Mom  •  Wildcats
    ├── Emma (Jake's Parent)  •  Eagles
    └── ...

[Filter/search bar at top of sidebar]
```

DM labels always include a team identifier. Coaches with large contact lists across multiple teams need this at a glance — a name alone is insufficient.

Coaches do not need to switch team context to reply to a DM. The sidebar gives them full cross-team visibility at all times.

### Parent Chat Layout (Team-scoped)

Within a selected team context, the parent sees only what's relevant to that team:

```
[ Eagles Travel 6U ▾ ]
├── 💬 Team Chat
└── ✉️  Coach Rivera
```

Simple, uncluttered, no cross-team noise. Switching teams in the top switcher updates the entire view.

### Personal Calendar View

The parent's calendar aggregates all subscribed team calendars into a single view. Per-team toggles and color-coding allow selective visibility:

```
📅  My Calendar
    ☑ 🔵 Eagles Travel 6U
    ☑ 🟢 Wildcats Travel
    ☐ 🟠 Lincoln Middle    ← toggled off for this week
```

Events from active teams appear in the calendar color-coded by team. Tapping an event shows team context, location, and any linked game details.

---

## 11. Implementation Sequencing

Communication cannot be built until the following prerequisites are complete:

| # | Prerequisite | Status |
|---|---|---|
| 1 | Google OAuth — Super Admin | ✅ Complete |
| 2 | Google OAuth — Coach | 🔲 In progress |
| 3 | Parent/Player invite + verification flow | 🔲 Pending |
| 4 | Coach approval of player/parent account link | 🔲 Pending |
| 5 | `authUid` field on player entities | 🔲 Pending |
| 6 | Real role-based Firestore security rules | 🔲 Pending |

**Recommended build order once prerequisites are met:**

| Phase | Feature | Notes |
|---|---|---|
| Comm 1 | Team group chat | Auto-enrollment on approval. Coach + member messaging. |
| Comm 2 | Team calendar | Auto-subscription on approval. scheduledGame integration. |
| Comm 3 | Personal calendar view | Unified view with per-team toggles. |
| Comm 4 | Coach-initiated DMs | One thread per user pair. Team context tagging. |
| Comm 5 | Push notifications (FCM) | Deep-link routing by teamId + conversationId. |
| Comm 6 | Read receipts | Optional — confirm priority before building. |
| Comm 7 | Announcement-only mode | allowReplies flag on group chat messages. |

---

## 12. Open Questions

These require decisions before or during implementation. To be revisited when development context is updated.

### Authentication & Roles
- [ ] **Player-initiated DMs:** Can players (not just parents) DM a coach? If so, do they initiate or only reply? Does this differ by age group?
- [ ] **Org Admin in chat:** Does the org admin appear in team chats and DM lists, or do they have a separate oversight-only view?
- [ ] **Coach cross-org:** Can a coach who works with multiple orgs (e.g. school + travel) have a unified view across both, or is each org a separate login context?

### Group Chat
- [ ] **Sibling edge case — multi-team same org:** If a parent has two kids on two *different* teams within the same org, does each team chat appear separately in their switcher? (Assumed yes — confirm.)
- [ ] **Message deletion:** Can coaches delete messages in their team chat? Can org admins delete any message?
- [ ] **Roster removal read access:** Confirmed that removed members retain read-only history — should there be a cutoff date displayed in the UI ("You left this team on Oct 3")?
- [ ] **Announcement-only:** Is this a per-conversation setting (set by coach on creation) or a per-message toggle? Or both?

### Direct Messages
- [ ] **Parent can have multiple coaches:** If a parent has two kids with two different coaches, they could accumulate many DM threads over time. Is there a need to archive or mute old threads?
- [ ] **Player age threshold:** Should player-direct DMs have any age gate or require parental visibility? Important for liability/safeguarding in youth sports context.
- [ ] **Coach leaves org:** What happens to DM history when a coach's account is removed from an org? Threads should likely be preserved but marked as inactive.

### Calendar
- [ ] **Event RSVP:** Do parents/players need to confirm attendance for events, or is the calendar view-only? RSVPs significantly increase schema and UI complexity.
- [ ] **External calendar sync:** Should team calendar events be exportable to Google Calendar / Apple Calendar via iCal feed? High parent value but adds backend complexity.
- [ ] **Game result on calendar event:** When a `scheduledGame` is finalized, does the linked calendar event update to show the final score?
- [ ] **Recurring events:** Do practices need a recurring event pattern (every Tuesday + Thursday), or are all events entered individually?
- [ ] **Color assignment:** Who controls the per-team color in the parent's personal calendar — the system (auto-assigned) or the parent (user preference)?

### Notifications
- [ ] **Notification preferences:** Can parents mute a specific team's notifications (e.g. during a vacation) without unsubscribing from the calendar?
- [ ] **Quiet hours:** Should the app respect a quiet hours window and batch non-urgent notifications?
- [ ] **Coach notification load:** A coach with 3 teams and 40+ contacts could get a high notification volume. Is there a digest/batching option for low-urgency messages?

### Data & Privacy
- [ ] **Message retention policy:** How long are messages stored? Is there an auto-delete policy after a season ends or a player leaves?
- [ ] **Safeguarding compliance:** Youth sports communication platforms often have safeguarding requirements (e.g. no private adult-to-minor messaging without a guardian copied). Confirm what obligations apply to your user base and jurisdiction.
- [ ] **Data portability:** If a coach or parent deletes their account, what happens to their sent messages in group chats?
