

# Fix: Team Invitation Acceptance for Users Without Passwords

## Problem
The invitation link goes to `/auth?invite_token=xxx`, which shows a login form requiring email + password. If the invited user doesn't have an account or doesn't know their password, they're stuck.

## Solution
Modify the invitation flow so that:
1. The **team edge function** creates the invited user's account automatically (using Supabase admin `createUser`) when they don't exist, with a magic-link style flow
2. The **invitation email** includes a one-click accept link that uses a **Supabase magic link** or a direct token-based acceptance
3. The **Auth page** handles `invite_token` for both logged-in and logged-out users

### Approach: Auto-create user + sign-in link

**Edge function (`team/index.ts`) — invite endpoint changes:**
- When sending an invitation, check if the invited email already has an account
- If not, create one via `serviceClient.auth.admin.createUser({ email, email_confirm: true })`
- Generate a magic link via `serviceClient.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: siteUrl + '/auth?invite_token=' + token } })`
- Include the magic link in the Brevo invitation email so the invitee can click once to sign in AND accept

**Edge function — accept endpoint changes:**
- Keep existing accept logic (works for already-logged-in users)

**Auth page changes:**
- When `invite_token` is present and user is NOT logged in, show a simplified UI: "You've been invited! Enter your email to sign in" with option to set a password (sign up) or use existing credentials
- Pre-fill the email from the invitation record if possible (add an unauthenticated endpoint to look up invite email by token)

### Detailed Steps

1. **Add public invite-info endpoint** in `team/index.ts`:
   - `GET /team?invite_info=<token>` (no auth required)
   - Returns `{ email, team_name, inviter_name }` so the Auth page can pre-fill the email and show context

2. **Update invite sending** in `team/index.ts`:
   - After creating the invitation, generate a magic link via `admin.generateLink({ type: 'magiclink', email, options: { redirectTo: origin + '/auth?invite_token=' + token } })`
   - Use the generated `action_link` as the button URL in the Brevo email instead of the plain `/auth?invite_token=...` URL
   - This way, clicking the email link auto-signs in the user AND redirects to `/auth?invite_token=...`

3. **Update Auth page** (`Auth.tsx`):
   - When `invite_token` is present and user is not logged in, fetch invite info from the public endpoint
   - Show invitation context: "You've been invited to join [Team Name] by [Inviter]"
   - Show sign-up form (pre-filled email) so new users can set a password
   - The magic link from the email will auto-sign them in, so the `useEffect` that calls accept will fire

4. **Handle edge case**: If user clicks magic link and gets signed in automatically, the existing `useEffect` in Auth.tsx already handles acceptance — no change needed there.

### Files to Change
- `supabase/functions/team/index.ts` — add invite-info public endpoint, generate magic link on invite
- `src/pages/Auth.tsx` — show invitation context, pre-fill email, handle invite UX for logged-out users

