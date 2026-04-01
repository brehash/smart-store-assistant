

# Two Features: Admin Impersonation + Cron Log Display Fix

## 1. Admin User Impersonation

### Concept
Admins can click "Impersonate" on any user in the admin panel. This generates a temporary session for that user via `serviceClient.auth.admin.generateLink`, allowing the admin to see the app exactly as that user sees it. A floating banner shows who they're impersonating with a "Stop" button to return to their admin session.

### Backend — `supabase/functions/admin/index.ts`
Add route `POST /users/:id/impersonate`:
- Use `serviceClient.auth.admin.generateLink({ type: 'magiclink', email })` to get a token
- Return the token/link properties so the frontend can sign in as that user

### Frontend — `src/pages/Admin.tsx` / `src/components/admin/UsersTable.tsx`
- Add "Impersonate" button (Eye icon) per user row
- On click: save current admin session to `sessionStorage`, call the impersonate endpoint, use `supabase.auth.signInWithOtp` or `verifyOtp` with the returned token
- Redirect to `/` as the impersonated user

### Frontend — `src/pages/Index.tsx` or `src/App.tsx`
- On mount, check `sessionStorage` for saved admin session
- If present, show a floating banner: "Impersonating [user] — Stop"
- "Stop" restores the admin session from storage and navigates back to `/admin`

### Frontend — `src/components/admin/ImpersonationBanner.tsx` (new)
- Fixed top banner with user info and stop button
- Calls `supabase.auth.setSession()` with saved admin tokens to restore

## 2. Cron Job Log Display Fix

### Problem
The latest orchestrator log format (after fan-out refactor) no longer has `orders_scanned` in the summary — it has `workers_dispatched` / `workers_failed`. But the CronJobLogs UI expects `orders_scanned`. This makes the latest run appear to have "scanned 0" when it actually dispatched workers that did the scanning.

The actual last run was **successful** — the worker log shows 17 orders scanned, 14 with AWB. The only real error was on March 30 (HTTP 429 rate limiting from Colete Online API).

### Fix — `src/components/admin/CronJobLogs.tsx`
- Update the `CronLog` summary interface to include optional `workers_dispatched`, `workers_failed` fields
- In the UI, when rendering orchestrator logs (identified by having `workers_dispatched` in summary), show "Workers: X dispatched, Y failed" instead of "Orders scanned: 0"
- Link orchestrator logs to their corresponding worker logs visually (same timestamp group)

### Fix — `src/components/admin/CronJobLogs.tsx` (summary display)
- Show orchestrator-specific stats when `summary.workers_dispatched` exists
- Show worker-specific stats when `summary.orders_scanned` exists
- This handles both old-format (single log) and new-format (orchestrator + worker) entries

---

## Files Summary

| File | Changes |
|------|---------|
| `supabase/functions/admin/index.ts` | Add `POST /users/:id/impersonate` route |
| `src/components/admin/UsersTable.tsx` | Add impersonate button |
| `src/components/admin/ImpersonationBanner.tsx` | New — floating banner component |
| `src/App.tsx` | Render ImpersonationBanner when impersonating |
| `src/components/admin/CronJobLogs.tsx` | Handle orchestrator vs worker log formats |

