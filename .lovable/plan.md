

# Fix Team Invitation Acceptance + Team Member Store Access

## Problem Analysis

**Issue 1 — "Invalid or expired invitation" toast error:**
The invitation in the database is already `status: 'accepted'`. The `useEffect` in `Auth.tsx` fires the accept endpoint, but since it already ran successfully once (the invitation was accepted), the second firing finds no `pending` invitation and returns "Invalid or expired invitation". This happens because:
- The magic link signs the user in → `user` state updates → `useEffect` fires → accepts invitation
- React strict mode or re-renders cause the effect to fire again
- The invite_token stays in the URL, so any navigation back triggers it again

**Issue 2 — "Connect Your Store" shown to team members:**
`Index.tsx` checks `woo_connections` filtered by `user_id = user.id`. Team members don't have their own `woo_connections` row — only the team owner does. So team members always see the onboarding wizard.

## Plan

### 1. Fix invitation acceptance (edge function + frontend)

**`supabase/functions/team/index.ts`:**
- In `handleAcceptInvitation`, when the invitation is already `accepted`, return success instead of an error (idempotent acceptance)
- Check: if invitation status is `accepted` AND user is already a team member, return `{ success: true, already_accepted: true }`

**`src/pages/Auth.tsx`:**
- Add a guard to prevent the accept `useEffect` from firing multiple times (use a `useRef` flag)
- After successful acceptance, remove `invite_token` from URL params to prevent re-triggering

### 2. Fix store connection visibility for team members

**`src/pages/Index.tsx`:**
- Update the connection check: if the user has no `woo_connections` row, check if they're in a team and look up the team owner's connection instead
- Query: get user's `team_members.team_id` → get `teams.owner_id` → check `woo_connections` for owner

**`supabase/functions/chat/index.ts` + `tool-executor.ts`:**
- Update all `woo_connections` queries to resolve through team membership: if no connection found for user, find their team's owner and use that connection
- This ensures team members can actually chat and use the store

### Files to Change
- `supabase/functions/team/index.ts` — make accept idempotent
- `src/pages/Auth.tsx` — prevent double-fire, clean URL
- `src/pages/Index.tsx` — team-aware connection check
- `supabase/functions/chat/index.ts` — team-aware woo_connections lookup
- `supabase/functions/chat/tool-executor.ts` — team-aware woo_connections lookup

