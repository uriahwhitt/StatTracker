# WE TRACK — Implementation Status
**Date:** April 6, 2026 | **Branch:** `dev`

---

## Current Position in Build Sequence

**At:** Phase 2, Gate 5 — Scorekeeper Assignment + Game Lock (not yet started)
**Last completed:** Post-tournament stability fixes ✅ (April 6, 2026)
**Gate 4 completed:** Parent Join Codes + Live Read ✅ (April 2, 2026)

---

## Gate 0 — Foundation ✅ COMPLETE

All Phase 1 / 1.5 items shipped. See `MASTER_PLAN.md §7 Gate 0`.

| Item | Status |
|---|---|
| Scorebook UI fixes (pull-to-refresh, FlashButton, OpponentStrip, period selector, foul/timeout derivation, event log labels) | ✅ Done |
| GameSetup format step (foul rules, timeout, reset fields) | ✅ Done |
| Data migration v3 (orgId on players, new format fields, scheduledGames shape) | ✅ Done |
| Firebase Firestore + anonymous auth + offline persistence | ✅ Done |
| Transfer code device sync | ✅ Done |
| Manage tab — People segment (Orgs/Teams/Players CRUD, RosterModal) | ✅ Done |
| Manage tab — Schedule segment (TournamentModal, GameModal, phase/bracket fields) | ✅ Done |
| History tab (Games/Players/Teams sub-views, filter pills, detail modals) | ✅ Done |
| Reports tab (scope selector, all PDF/JSON exports wired) | ✅ Done |

---

## Phase 2 — Gate Status

### Gate 1 — OAuth Foundation ✅ COMPLETE

- Google OAuth sign-in in Settings (anonymous → Google account linking, UID preserved)
- Google profile avatar overlay on gear icon
- Settings page authenticated state (account card, sign out)
- Superadmin account (`superadmin: true` custom claim) + `isSuperadmin()` function

---

### Gate 2 — Org + Role Infrastructure ✅ COMPLETE

| Item | Status |
|---|---|
| `/orgs/`, `/users/{uid}/roles/` Firestore structure | ✅ Done |
| "Create Organization" flow in Settings (superadmin-only guard) | ✅ Done |
| One-time personal → org path data migration | ✅ Done |
| `storage.js` path routing (personal path vs. org path) | ✅ Done |
| `setActivePath` for deterministic routing after org creation | ✅ Done |
| Firestore security rules (org read/write by role) | ✅ Done |
| Settings → "My Teams" section (org membership + role badge) | ✅ Done |
| `handleSignIn` reloads db after Google sign-in so org data appears immediately | ✅ Done |

**Test condition:** ✅ Verified — org data loads correctly on two devices with same Google account.

---

### Gate 3 — Coach Invite Flow ✅ COMPLETE

| Item | Status |
|---|---|
| `src/utils/invites.js` — `createInvite`, `getInvite`, `markInviteUsed` | ✅ Done |
| `src/utils/roles.js` — full role CRUD: `writeRoleDoc`, `removeRole`, `updateMemberRole`, `getOrgMembers`, `getUserRole`, `canWrite`, `getOrgForUser`, `getRoleStatus` | ✅ Done |
| `storage.js` — `setPendingOrgPath` primes org path cache after invite acceptance | ✅ Done |
| `src/components/invite/InviteAcceptView.jsx` — standalone `/invite/{token}` route | ✅ Done |
| `src/components/manage/MembersModal.jsx` — member list, invite generation, Change Role, Remove/Leave | ✅ Done |
| `src/components/manage/PeopleView.jsx` — "Members ›" button per team | ✅ Done |
| `src/App.jsx` — `App` router wrapper (`/invite/{token}` vs main app); `userRole` + `isSuperadminUser` state | ✅ Done |
| `src/components/settings/SettingsView.jsx` — owner member doc on org creation; "Leave Team" button | ✅ Done |
| `firestore.rules` — `removedAt` check in helpers; invite, members, notifications rules | ✅ Done |
| Head Coach conflict detection → `pending_conflict` status + org owner notification | ✅ Done |
| Role transfer with HC warning + confirmation | ✅ Done |
| Soft-removal (removedAt/removedBy) — self-removal blocked if only HC | ✅ Done |

**Test condition:** ✅ Verified
- Superadmin generated Head Coach invite → personal account accepted → role written correctly
- Second HC invite → conflict detected → `pending_conflict` status shown in Members modal
- Org owner resolved via Change Role (demoted to Asst. Coach)
- All 3 accounts (owner, HC, Asst. Coach) see team data correctly

**Known gap:** No push/badge notification to alert the owner to a pending conflict. Owner must navigate to Manage → Team → Members to see the conflict banner. Notification UI is Gate 8.

---

### Gate 4 — Parent Join Codes + Live Read ✅ COMPLETE

| Item | Status |
|---|---|
| `src/utils/joinCode.js` — `createJoinCode`, `getActiveJoinCode`, `lookupJoinCode`, `redeemJoinCode` | ✅ Done |
| `src/utils/liveGame.js` — `publishLiveGame`, `clearLiveGame`, `subscribeLiveGame` | ✅ Done |
| `src/utils/roles.js` — `getAllUserRoles` added | ✅ Done |
| `src/utils/storage.js` — `setActiveOrgId`, `getActiveOrgId`, `getActivePath` multi-org routing | ✅ Done |
| `src/components/auth/AuthGate.jsx` — anonymous gate; Google sign-in + join code flow | ✅ Done |
| `src/components/manage/JoinCodePanel.jsx` — team join code sheet modal (display, copy, regenerate) | ✅ Done |
| `src/components/manage/ParentManageView.jsx` — read-only teams + rosters for parent role | ✅ Done |
| `src/components/live/LiveGameBanner.jsx` — pulsing banner shown when game is broadcasting | ✅ Done |
| `src/components/live/LiveGameView.jsx` — full-screen live box score + event feed (read-only) | ✅ Done |
| `src/components/layout/BottomNav.jsx` — `visibleTabs` prop for role-based nav | ✅ Done |
| `src/components/scorebook/LiveScorebook.jsx` — "Go Live" bar, `publishLiveGame` on state change | ✅ Done |
| `src/components/scorebook/ScorebookView.jsx` — passes `orgId` to LiveScorebook | ✅ Done |
| `src/components/manage/PeopleView.jsx` — "Join Code" button per team | ✅ Done |
| `src/components/settings/SettingsView.jsx` — join code entry + team preview + redeem flow | ✅ Done |
| `src/App.jsx` — role-based tabs, multi-team selector, team context banner, live game integration, anonymous gate | ✅ Done |
| `firestore.rules` — `/joinCodes/{code}` rules added | ✅ Done |

**Architecture decisions locked:**
- Anonymous users see only `AuthGate` (Google sign-in + join code entry)
- Track tab hidden for all org-linked users
- Parent visible tabs: `history`, `reports`, `manage` (read-only ParentManageView)
- Coach/Owner visible tabs: `scorebook`, `history`, `reports`, `manage`
- Multi-team users get a pill selector banner; switching re-scopes History + Reports
- Go Live is explicit (coach-controlled) — prevents accidental broadcast during re-entry
- liveGame path: `orgs/{orgId}/live/game` (4-segment Firestore doc path; covered by existing wildcard rule for org members)

---

### Post-Tournament Stability Fixes ✅ COMPLETE (April 6, 2026)

Implemented on branch `fix/tournament-issues`. Root causes and UX issues surfaced during first real-world tournament test (April 4–5, 2026).

**Root cause:** During the tournament, the 300ms live-game autosave generated hundreds of Firestore writes per game on unstable gym wifi. The Firestore write queue hit its maximum size and entered a permanent retry/backoff loop. 5 finalized games were not synced to Firestore and required manual recovery via Admin SDK script (data preserved in localStorage on the scoring tablet).

| Fix | Files Changed | Status |
|---|---|---|
| **Task 1 — Autosave throttling:** Live game autosave now uses a 45s debounce (was 300ms). Roster/manage edits remain at 300ms. localStorage is always written immediately as crash-safe backup. | `src/hooks/useAutosave.js` | ✅ Done |
| **Task 2 — Sync status indicator:** New `syncStatus.js` module tracks browser online/offline events. Go Live bar shows a colored dot (green/red) reflecting connectivity. Offline warning banner appears below the bar. `initSyncStatus()` called once in `App.jsx`. | `src/utils/syncStatus.js`, `src/App.jsx`, `src/components/scorebook/LiveScorebook.jsx` | ✅ Done |
| **Task 3 — Live feed stat derivation fix:** `publishLiveGame` now pre-derives all player stats from the full event log before publishing. `LiveGameView` consumes `liveGame.playerStats` directly instead of re-deriving from the 50-event truncated slice. Scoreboard uses `liveGame.homeScore`/`awayScore` (pre-computed). | `src/components/scorebook/LiveScorebook.jsx`, `src/components/live/LiveGameView.jsx` | ✅ Done |
| **Task 4 — Stale game safeguard + End Broadcast recovery:** `LiveGameView` shows "Possibly Ended" + last-update time if `updatedAt` is >3 hours old. `ScorebookView` shows an "End Broadcast" button on finalized games so a coach can manually clear a stuck live feed. `LiveGameBanner` was already using `onSnapshot` and auto-hides on doc delete. | `src/components/live/LiveGameView.jsx`, `src/components/scorebook/ScorebookView.jsx` | ✅ Done |
| **Task 5 — Sort roster by jersey number:** Active player rows in `LiveScorebook` sort ascending by jersey number on every render, including after substitutions. `activePlayers` array (used for game logic) is unchanged. | `src/components/scorebook/LiveScorebook.jsx` | ✅ Done |
| **Task 6 — Two-phase group sub standby queue:** Phase 1: tap bench players during live play → queued in amber ("STANDBY"), save via "Save & Close" without executing the sub. Amber badge dot on SUB button shows queue is pending. Phase 2: reopen modal → deselect active players going off → standby players auto-fill FIFO → "Confirm Lineup" executes. Queue clears after execution. | `src/components/scorebook/GroupSubModal.jsx`, `src/components/scorebook/LiveScorebook.jsx`, `src/components/scorebook/GameHeader.jsx` | ✅ Done |

**Data recovery note:** Raw localStorage backup from the scoring tablet is preserved in `local_store.md` in the project root. Do not delete until the next tournament confirms stable syncing with the 45s throttle in place.

---

### Gate 5 — Scorekeeper Role + Org Membership Management ⬜ NOT STARTED

**5a — Scorekeeper Assignment + Game Lock**
- `/scorekeeperAssignments/{gameId}` collection
- Assign Scorekeeper flow in Manage → Schedule
- "Start Keeping Score" button (assigned scorekeeper only)
- Lock banner for all other users
- `lastActivity` heartbeat (300ms debounce)
- 15-minute inactivity auto-release
- "Break Lock" for Head Coach and above
- Break lock notification to displaced scorekeeper

**5b — Org Membership Management + New Roles**
- `Org Staff` role (`role: 'orgstaff', teamId: null`) — org-level, no specific team
- `staffRole` sub-field for future specialization (finance, admin, operations, etc.)
- Org Members Panel in Manage → PeopleView: all org members grouped by team + org-level members
- Transfer Ownership flow: promote member to co-owner → original owner steps down to Org Staff or leaves
- Firestore rules: `orgstaff` handled by existing `hasOrgRole` helper (no changes needed)
- Foundation for future financial features (player dues, payment tracking) and non-coaching admin roles

---

### Gate 6 — Scorebook Game Clock ⬜ NOT STARTED

- `src/components/scorebook/GameClock.jsx` (new component)
- Configurable period length, Start/Stop toggle
- Edit mode with nudge buttons (+10s, -10s, +1s, -1s)
- `gameClockTime` field on each stat event

---

### Gate 7 — Player Profile System + Claim Codes ⬜ NOT STARTED

- `/players/{playerId}` and `/coaches/{coachId}` top-level collections
- "Generate Claim Link" in Manage → Roster
- `/claimCodes/{code}` collection
- Claim acceptance + coach approval flow
- Season archiving logic

---

### Gate 8 — Communication (Phase 3) ⬜ NOT STARTED

Prerequisites: Gates 3, 4, and 7 must be complete.

- Group team chat + coach-initiated DMs
- Team calendar (auto-subscribe on member approval)
- Firebase Cloud Messaging push notifications
- In-app notification badge/center (will also surface Gate 3 role-conflict notices)

---

## Features Deferred to Later Gates

| Feature | Where Defined |
|---|---|
| Welcome screen + first-launch onboarding | `MASTER_PLAN.md §3` |
| My Stats vs Official Stats toggle (History + Reports) | `MASTER_PLAN.md §3` |
| Multi-team / multi-player context selector | `MASTER_PLAN.md §3` |
| PWA install prompt | `MASTER_PLAN.md §3` |
| Google AdSense banner ads | `MASTER_PLAN.md §5` |
| Self-service org registration / approval flow | `MASTER_PLAN.md §4.5` |
| Org Admin console | `MASTER_PLAN.md §6` |
| Coach data scope enforcement in History/Reports (UI-level) | Gate 3 partial — Firestore rules enforce it; UI scoping deferred to Gate 4+ |

---

## Key Technical Debt / Known Issues

| Issue | Status |
|---|---|
| `storage.js` path routing: `getDocs` collection query lag fixed via `setActivePath` | ✅ Fixed |
| `migratePersonalDataToOrg` early-return guard removed | ✅ Fixed |
| Org creation UI superadmin guard | ✅ Fixed |
| Autosave flooding Firestore write queue during live games on unstable wifi | ✅ Fixed — 45s throttle in `useAutosave.js` |
| Live feed box score wrong for games >50 events (derived from truncated event slice) | ✅ Fixed — stats pre-derived on tablet, published as `playerStats[]` |
| Live broadcast not auto-clearing when game finalized — required manual intervention | ✅ Fixed — `LiveGameBanner` uses `onSnapshot` (auto-hides), "End Broadcast" recovery button added |
| `users/{uid}/profile` collection defined in §2.7 — nothing writes to it yet | Future — Gate 7 |
| Firebase Storage rules helpers (`isOrgCoach`, etc.) not yet in `firestore.rules` | Future — Phase 3 |
| `storage.js` multi-org routing: `rolesSnap.docs[0].id` is non-deterministic for multi-org users | ⚠️ Known — fix before any multi-org user exists |
| No owner notification badge for `pending_conflict` roles — owner must manually check Members modal | ⚠️ Known — Gate 8 |
| Coach data scope (History/Reports filtered to assigned teamId) not yet enforced in UI | ⚠️ Known — Gate 5+ |

---

## Reference Documents

| Document | Status | Purpose |
|---|---|---|
| `MASTER_PLAN.md` | ✅ Canonical | Single source of truth — architecture, data model, features, build phases |
| `IMPLEMENTATION_STATUS.md` | ✅ Current | This file — gate completion status |
| `CLAUDE.md` | ✅ Current | Branch workflow, coding constraints, style guide |
| `firestore.rules` | ✅ Current | Deployed security rules (deploy with `firebase deploy --only firestore:rules`) |
| `ARCHITECTURE.md` | ⚠️ Superseded | Phase 1/1.5 reference only |
| `PHASE2_ARCHITECTURE.md` | ⚠️ Superseded | Phase 2 auth/role reference only |
| `COMMUNICATION_PLAN.md` | ⚠️ Superseded | Phase 3 communication pre-planning — see `MASTER_PLAN.md §4` |
| `PLANNING_SUMMARY.md` | ⚠️ Superseded | March 23, 2026 session notes |
