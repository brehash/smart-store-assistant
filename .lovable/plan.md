

# Implement Team System with Shared Credits and Email Notifications

## Overview
Add a team/invitation system where users can invite team members by email. All team members share the same credit pool (both monthly and top-up credits). Invitation and acceptance notification emails are sent via the existing Brevo integration.

## Database Changes (Migration)

### New table: `teams`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Team name |
| owner_id | uuid | References auth.users, the team creator |
| created_at | timestamptz | |

### New table: `team_members`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| team_id | uuid FK → teams | |
| user_id | uuid | The member's auth user id |
| role | text | 'owner' / 'member' |
| joined_at | timestamptz | |

### New table: `team_invitations`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| team_id | uuid FK → teams | |
| invited_by | uuid | Who sent it |
| email | text | Invitee email |
| token | text UNIQUE | Random invite token |
| status | text | 'pending' / 'accepted' / 'expired' |
| created_at | timestamptz | |
| expires_at | timestamptz | Default now() + 7 days |

### Modify `credit_balances`
- Add `team_id uuid` column (nullable FK → teams)
- Credits become team-level: when a user belongs to a team, their credit operations reference the team's shared balance row

### RLS Policies
- Team members can SELECT their own team and team members
- Only team owner can INSERT invitations and manage members
- Invitations: owner can CRUD, invited user can view by email match

### Trigger
- On `team_members` INSERT → auto-link the user's `credit_balances` to the team's shared balance (or merge into team balance)

## Edge Function Changes

### New: `supabase/functions/team/index.ts`
Handles all team operations (authenticated, JWT-verified):

- **POST /team** — Create team (auto-add creator as owner, create shared credit balance)
- **POST /team/invite** — Send invitation: insert into `team_invitations`, call Brevo API to send branded invitation email with accept link
- **GET /team/accept?token=xxx** — Accept invitation: validate token, create auth user if needed, add to `team_members`, merge credits into team balance, call Brevo to notify the inviter
- **GET /team** — Get current user's team, members, and pending invitations
- **DELETE /team/members/:userId** — Remove team member (owner only)
- **DELETE /team/invitations/:id** — Cancel pending invitation (owner only)

### Email templates (inline HTML, same branded style as brevo-email-hook)

**Invitation email:**
- Subject: "You've been invited to join [Team Name]"
- Body: Branded template with accept button linking to `/auth?invite_token=xxx`
- Sent via Brevo API using existing `BREVO_API_KEY`

**Acceptance notification email:**
- Subject: "[Member Name] has joined your team"
- Body: Branded template notifying the team owner
- Sent via Brevo API

## Frontend Changes

### New Settings tab: "Team" (between Integrations and Credits)
- Icon: `Users` from lucide-react
- Add to `TABS` array in `Settings.tsx`

### Team tab content:
- **No team state**: "Create a Team" card with name input and create button
- **Team exists (owner view)**:
  - Team name display
  - Members list (avatar, name, email, role, remove button)
  - Pending invitations list (email, status, cancel button)
  - "Invite Member" form: email input + send button
- **Team exists (member view)**:
  - Team info (read-only)
  - Members list (no management actions)
  - "Leave Team" button

### Auth page update (`src/pages/Auth.tsx`)
- Check URL for `invite_token` query param
- If present, show acceptance flow: auto-accept after login/signup, call team accept endpoint

### Credit display update
- When user is in a team, credit balance queries reference the team's shared balance
- All team members see the same balance

## Route Addition
- Add `/auth` route handling for `invite_token` query parameter (no new route needed, just query param handling in Auth.tsx)

## Technical Details

- Invitation tokens: `crypto.randomUUID()` stored in `team_invitations`
- Accept link format: `{SITE_URL}/auth?invite_token={token}`
- Brevo emails reuse the same branded HTML wrapper from `brevo-email-hook`
- Credit sharing: when a team is created, the owner's balance row gets `team_id` set; when members join, their individual balance is merged into the team balance and their row points to the same team
- The `chat` edge function's credit check should resolve through team membership to find the shared balance

