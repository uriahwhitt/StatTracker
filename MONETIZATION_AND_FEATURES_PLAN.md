# StatTracker — Monetization, Org Management & Feature Planning
*Planning session summary — April 2026*

---

## 1. Monetization Strategy

### Goal
Cost recovery only — cover development costs, server/Firebase usage, and minor scaling. Not profit-driven.

### Estimated Monthly Costs to Cover
- Firebase (Firestore + Auth) — free to ~$25/month at early scale
- Firebase Hosting — free tier
- Domain — ~$12/year
- Storage growth over time
- **Target: $50–100/month covered**

### Why Subscriptions Over Ads
- Ad banner CPMs ($0.50–$2.00) require massive volume to be meaningful
- Niche youth sports audience is too small for ad revenue to matter
- Subscription model scales cleanly with user growth
- No SDK overhead, no UX compromise
- Competing apps (Heja, SportsYou, TeamSnap) already condition coaches to pay

### Pricing Tiers

| Tier | Price | Inclusions |
|---|---|---|
| Free | $0 | 1 team, basic stat tracking, standard reports |
| Coach Pro | $4.99/month | Multiple teams, communication features, advanced PDF exports, historical data |
| Org Basic | $19.99/month | Up to 5 teams, org admin dashboard, communication |
| Org Standard | $39.99/month | Up to 15 teams, document vault, tournament readiness |
| Org Elite | $69.99/month | Unlimited teams, document vault, priority support |

### Payment Processing
- **Stripe** — no Play Store cut (15–30%), ~97 cents on the dollar
- Works for PWA or native distribution
- Firebase + Stripe Extension is the implementation path
- New orgs self-register and start on free tier
- Stripe checkout triggered when hitting a paid feature gate

### Grandfathering (Beta Orgs)
Beta testing organization(s) receive free-for-life access. Implemented via a flag in Firestore:

```
orgs/{orgId}
    billingTier: "free" | "coach_pro" | "org_basic" | "org_standard" | "org_elite"
    billingStatus: "active" | "past_due" | "canceled"
    grandfathered: true
    grandfatheredReason: "beta_founder"
    grandfatheredAt: timestamp
```

Grandfathered orgs bypass all paywall checks in security rules and app logic. Super admin sets this manually via operator dashboard — no Stripe involvement.

---

## 2. Organizational Hierarchy & Roles

### Ownership Chain
```
Super Admin (platform operator only — owns no orgs or teams)
    └── Org Admin (paying customer, owns the org)
            └── Coaches (manage teams, execute org compliance)
                    └── Players / Parents
```

### Super Admin
- Pure platform operator role
- No org or team ownership
- Manages: billing tiers, grandfather status, org suspension, platform health metrics
- Console needs: org list with tier/status/team count, billing overrides, user lookup, audit tools

### Org Admin
- Paying customer
- Self-registers (no super admin provisioning needed)
- Invites coaches to teams
- Invites parents directly if no coach is assigned yet
- Configures season settings, compliance requirements, grade minimums
- Can also hold a coach role simultaneously (additive roles, not exclusive)
- Grants eligibility exceptions with logged reason

### Coach
- Invited by org admin
- Manages team roster, schedule, game entry
- Executes org compliance requirements (verifies documents on org's behalf)
- Creates team-level tasks (not org-level)
- Can see all players across the org (for pickup/transfer purposes)
- Can invite players to their team (UID linking to existing player entity)
- Cannot see other teams' communication or stats

### Dual Role (Org Admin + Coach)
- Same authenticated user, additive roles
- UI surfaces both contexts — org admin console + team-switcher coach view
- Common in NC travel basketball (club directors who also coach)

### Role Storage
```
users/{uid}
    roles: ["org_admin", "coach"]  // additive array
    orgMemberships: [{ orgId, role, teamIds[] }]
```

---

## 3. Self-Registration Flow

New orgs self-register without super admin involvement:

```
Org admin → "Create Organization"
    → Google OAuth
    → Org created:
        billingTier: "free"
        grandfathered: false
        status: "active"
        createdAt: timestamp
        createdBy: uid
    → Org admin lands in dashboard
    → Soft paywall on paid features
```

Free tier limits (abuse prevention):
- 1 team maximum
- Basic stat entry and reports
- No communication features
- Communication and document vault are the primary paid feature gates

---

## 4. Invitation System

### Org Admin → Coach
```
invites/{inviteId}
    orgId
    teamId (optional)
    invitedEmail
    role: "coach"
    status: "pending" | "accepted" | "expired"
    createdAt
    expiresAt
    createdBy: uid
```

### Org Admin → Parent (coachless team)
```
invites/{inviteId}
    orgId
    teamId
    invitedEmail
    role: "parent"
    playerId  // links parent to existing player entity
    status: "pending" | "accepted" | "expired"
    createdAt
    expiresAt
    createdBy: uid
```

### Coach → Player (UID linking)
- Player entity already exists as anonymous placeholder
- Coach invites player to team — this is just UID linking, not a new record
- Communication enrollment triggers automatically on link

### Cross-org coach scenario
A coach already active in another org accepts an invitation — no new account created, additional org/team association added to existing user record.

---

## 5. Player Entity & Transfers

Player is the universal join point. Starts as anonymous placeholder created by coach or org admin, later claimed by verified user. UID persists across transfers.

### On Transfer (within org)
- Org-level compliance (birth cert, grade report) transfers with player — verified status preserved
- New coach inherits verified status, does not re-verify
- Only org admin can invalidate a verification
- Team-level tasks from previous team do not transfer
- New team's active, non-expired tasks auto-apply on join

### On Transfer (between orgs)
- Open question — see Section 10

---

## 6. Jersey Number Management

### Rules
- One number per player
- Coach selects number at team level
- System validates against org-wide registry in real time
- No two players in the org share a number

### Firestore Structure
```
orgs/{orgId}
    jerseyRegistry/
        "23": playerId
        "11": playerId
        "4":  playerId
```

### Assignment Flow
```
Coach enters jersey number for player
    → Query org jerseyRegistry
    → Available → assigned, registry updated
    → Taken → "Number 23 is assigned to Marcus J. 
                on 12U Team A — choose another"
```

### On Transfer
- Player's number freed from old team
- Coach of new team assigns/requests number
- Registry updated accordingly

---

## 7. Task & To-Do System

### Two-Layer Architecture

**Org-Level Tasks** — owned by org admin, apply to all players org-wide
- Birth certificate upload
- Grade report upload
- Academic eligibility verification
- Season-reset tasks
- Exceptions granted by org admin with audit log

**Team-Level Tasks** — owned by coach, apply to specific team roster only
- Tournament waivers
- Team-specific signups
- Equipment requirements
- Event-specific forms
- Jersey size survey (can also be org-level)

### Task Schema
```
tasks/{taskId}
    orgId
    teamId (null for org-scope tasks)
    createdBy: coachUid | orgAdminUid
    assignedTo: "player" | "parent" | "both"
    scope: "individual" | "team" | "org"
    taskCategory: "system" | "custom"
    taskType: "document_upload" | "external_link" | "acknowledgement" | "form"
    
    title
    description
    externalUrl (optional)
    requiresUpload: boolean
    requiresVerification: boolean
    
    // timing
    dueDate: timestamp (optional — visible to parents)
    expiresAt: timestamp (controls auto-apply cutoff)
    
    // persistence
    taskPersistence: "season" | "permanent" | "one_time"
    
    // state
    status: "active" | "expired" | "archived"
    autoApplyToNewMembers: boolean
```

### Auto-Apply Logic
When a player is added to a team:
```
Query team tasks where:
    status == "active"
    expiresAt > now() (or no expiration)
    autoApplyToNewMembers == true
→ Fan out to new player only
→ Skip expired tasks
```

### Task Persistence Types
- **Permanent** — birth certificate (verified once, done forever unless player transfers orgs)
- **Season** — grade report (resets each season via season rollover)
- **One-time** — tournament waivers, specific events (expires after event)

### Season Rollover (org admin action)
```
Org Admin → Start New Season
    → Set season dates
    → Configure grade requirements / GPA minimums
    → System resets "season" tasks to pending for all players
    → Permanent tasks remain verified
    → One-time tasks stay archived
    → All coaches notified
    → All parents get startup task banner
```

### Parent App Experience
```
App open → check incomplete tasks
    → Tasks exist:
        Startup banner: "You have X items to complete"
        → Task list with org tasks and team tasks separated
    → All complete:
        Clean home screen, no banner
```

### Task List Display (Parent)
```
Devon's To-Do List

    Season Requirements (from [Org Name])
    ──────────────────────────────────────
    🔴 Grade Report — upload needed

    Team Tasks (from Coach Marcus)
    ──────────────────────────────
    🔴 Big Shots Waiver — due March 3
    ✅ Jersey Size Survey — complete
```

### Coach Task Management View
```
Team To-Do Overview
    [ + Create New Task ]

    "Big Shots Waiver"
        12 assigned → 4 complete, 8 pending
        [ Notify Incomplete ]  ← targeted DM to pending parents

    "Grade Report"
        12 assigned → 10 complete, 2 need verification
        [ Review Uploads ]
```

### Eligibility Exception Grant
```
playerCompliance/{playerId}
    exceptions/{exceptionId}
        grantedBy: orgAdminUid
        grantedAt: timestamp
        documentType: "birthCertificate"
        reason: string
        expiresAt: timestamp (optional)
        status: "active" | "expired" | "revoked"
```

Exception visibility:
- Org admin — can grant, revoke, see all
- Coach — can see exceptions for their players, cannot grant/revoke
- Parent — sees "Eligibility approved by org admin" only

---

## 8. Document Vault

### Paid Feature
Available on Org Standard ($39.99/month) and Org Elite tiers.

### Supported Document Types (initial)
- Birth certificate (permanent, verified once)
- Grade report (season-scoped, resets each season)
- Physical clearance (one-time, calendar expiration)
- Custom documents (coach or org admin defined)

### Document Schema
```
players/{playerId}
    documents/{docType}
        uploadedBy: parentUid
        uploadedAt: timestamp
        fileUrl: string (Firebase Storage)
        
        status: "pending" | "verified" | "rejected"
        verifiedBy: coachUid
        verifiedAt: timestamp
        verificationMethod: "manual" | "ai_assisted"
        
        checksCompleted:
            nameMatch: boolean
            dobMatch: boolean
            documentValid: boolean
        checklistConfirmedBy: coachUid
        checklistConfirmedAt: timestamp
        
        rejectionReason: string (if rejected)
        
        expiresAt: timestamp (optional — for physicals etc.)
        
        // AI fields — null until Phase 2
        aiPrecheck:
            extractedName: null
            extractedDob: null
            confidence: null
            checkedAt: null
            modelVersion: null
```

### Firebase Storage Path
```
/orgs/{orgId}/players/{playerId}/documents/{docType}/{timestamp}.jpg
```

### Storage Security Rules
```javascript
match /orgs/{orgId}/players/{playerId}/documents/{allPaths=**} {
    allow read: if isOrgCoach(orgId) || isOrgAdmin(orgId) 
                   || isPlayerParent(playerId);
    allow write: if isPlayerParent(playerId) 
                    && isValidDocumentUpload();
    allow delete: if isOrgAdmin(orgId) 
                     || isPlayerParent(playerId);
}
```

### Camera Capture Flow
```
Parent taps "Upload [Document]"
    → Rear camera opens
    → Document frame overlay guide
    → Capture
    → Preview: [ Retake ] [ Upload ]
    → Upload to Firebase Storage
    → Firestore record created, status: "pending"
    → Coach notified
```

### Coach Verification UI (Phase 1 — Manual)
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

### Phase 2 — AI-Assisted Verification (future)
- Claude Vision API called via Firebase Function on document upload
- Extracts name and DOB, compares to player profile
- Pre-fills checklist items on high confidence match
- Coach still visually reviews and confirms document validity
- `verificationMethod` logged as "ai_assisted"

### Firebase Function Scaffold (Phase 1 — stub ready for Phase 2)
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
        // const aiResult = await runAiPrecheck(
        //     data.fileUrl,
        //     context.params.playerId,
        //     context.params.docType
        // );
        // await snap.ref.update({ aiPrecheck: aiResult });
    });
```

### Audit Trail
```
verificationLog/{playerId}/{docType}
    uploadedBy: parentUid
    uploadedAt: timestamp
    aiPrecheck: (populated in Phase 2)
    verifiedBy: coachUid
    verifiedAt: timestamp
    checklistConfirmed: boolean
    method: "manual" | "ai_assisted"
```

---

## 9. Tournament Readiness

### Placement
Lives within Player/Roster Management — not a separate feature area.

### Player Compliance Fields
```
players/{playerId}
    eligibilityStatus: "eligible" | "pending" | "ineligible"
    dateOfBirth: timestamp
    gradYear: string
    tournamentReady: boolean  // computed at read time
```

`tournamentReady` is true only when all required org documents are verified AND all active team tasks with a due date are complete.

### Roster Compliance View (Coach)
```
Team Roster — Tournament Ready

    ✅ Marcus J.    — Birth cert verified, grade report verified
    ⚠️  Devon S.    — Grade report pending
    ❌ Aaliyah T.  — Birth cert missing
    ❌ Jordan M.   — Jersey not assigned
```

### Org Tournament Readiness Dashboard
```
Org Tournament Readiness — [Season]

    8U Team A   — 12/12 players ready  ✅
    10U Team B  —  8/10 players ready  ⚠️
    12U Team C  —  5/12 players ready  ❌

    [ Export Eligibility Report ]
```

### Eligibility Report Export
One-tap export for tournament directors or league officials requiring proof of eligibility across all participating players.

### Tournament Readiness Checklist Per Player
```
✅ Birth certificate verified
✅ Grade report verified
✅ Big Shots waiver signed
✅ Jersey assigned
❌ [Any outstanding task with tournament due date]
```

---

## 10. Season Configuration (Org Level)

```
orgs/{orgId}
    seasonConfig/
        currentSeason: "2025-2026"
        seasonStartDate: timestamp
        seasonEndDate: timestamp
        requiredDocuments: [
            {
                type: "gradeReport"
                persistence: "season"
                minimumGpa: 2.0  // org configurable
                gradeLevel: null // null = all grades
            },
            {
                type: "birthCertificate"
                persistence: "permanent"
            }
        ]
```

---

## 11. Super Admin Console (to build)

- Platform-wide org list: tier, status, team count, created date
- Billing tier override
- Grandfather toggle with reason note + confirmation step
- User lookup and audit
- Org suspend / restore
- Platform health metrics (total orgs, teams, active users)
- Anomaly flagging (e.g. org on free tier with unusual team count)

---

## 12. Expansion Considerations

### Sport Expansion
- Document vault and compliance framework built generically
- `documents` subcollection accepts any document type a sport requires
- Task system works for any sport's compliance needs
- Football physicals, soccer age verification, baseball birth certs — same system

### Geographic Expansion
- Initial target: NC travel basketball (word of mouth in tight-knit community)
- Self-registration model supports rapid scaling without manual provisioning
- No bottleneck at super admin level when growth accelerates

---

## 13. Open Questions — Resolve Before Implementation

### Billing & Monetization
- [ ] Exact free tier player/roster limits per team
- [ ] Annual pricing discount offered? (e.g. 2 months free)
- [ ] What happens to org data when subscription lapses — grace period? data export?
- [ ] Does Coach Pro tier exist independently or only as part of org tiers?

### Org & Role Management
- [ ] Can an org admin remove a coach mid-season and what happens to their team assignments?
- [ ] If an org admin is also a coach and leaves, what is the succession process for org ownership?
- [ ] Can a coach belong to multiple orgs simultaneously?

### Player Transfers
- [ ] What happens to a player's verified documents when transferring between orgs (not just teams)?
- [ ] Does the receiving org need to re-verify or inherit the prior verification?
- [ ] Who initiates an inter-org transfer — both org admins? Player/parent request?

### Tasks & Compliance
- [ ] When a coach creates a team task scoped to a tournament, should it be linkable to a specific calendar event/game?
- [ ] Can org admins see and manage team-level tasks or is that strictly coach territory?
- [ ] Task notification cadence — how often do reminder notifications fire for incomplete tasks?
- [ ] Can parents dispute a rejection with a resubmission, and is there a resubmission limit?

### Document Vault
- [ ] Data retention policy — how long are documents stored after a player leaves an org or org cancels?
- [ ] Can parents delete their own uploads before verification?
- [ ] What is the process if a parent uploads the wrong document type?
- [ ] COPPA compliance review needed — minors' documents require specific privacy policy language
- [ ] Does verified document status need to be exportable in a format acceptable to tournament officials?

### Jersey Management
- [ ] What happens to a jersey number if a player is removed from the org entirely (not just transferred)?
- [ ] Should retired numbers be supported (honoring standout players)?
- [ ] Is there a maximum roster size per team that affects number range?

### Tournament Readiness
- [ ] Should tournament readiness be tied to specific calendar events, or is it always a general team status?
- [ ] Can org admin create org-wide tournaments that automatically populate team schedules?
- [ ] Should there be a way to mark a specific tournament as "completed" to archive its associated tasks?

### Notifications (general)
- [ ] Full notification preference controls for coaches and parents
- [ ] Push notification infrastructure — FCM assumed but not confirmed
- [ ] Should coaches be able to schedule task reminder notifications for a specific date/time?

### Communication (carry-forward from prior session)
- [ ] Safeguarding rules for adult-to-minor direct messaging
- [ ] Message retention policy
- [ ] Recurring calendar event support
- [ ] Event RSVP functionality
- [ ] External calendar sync (Google Calendar, Apple Calendar)

---

*End of planning session — April 2026*
