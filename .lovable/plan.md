

# Fix: Team Members Can View Cron Logs

## Problem
`cron_job_logs` stores only the integration owner's `user_id`. The RLS policy `auth.uid() = user_id` blocks team members from seeing logs for their shared store.

## Solution
Add an RLS policy mirroring the pattern used on `woo_connections` — allow team members to view logs where `user_id` belongs to their team owner.

### Database Migration

```sql
CREATE POLICY "Team members can view owner cron logs"
ON public.cron_job_logs
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT t.owner_id
    FROM teams t
    WHERE t.id IN (SELECT get_user_team_ids(auth.uid()))
  )
);
```

This reuses the existing `get_user_team_ids` security definer function, avoiding recursion issues.

### Files
| File | Change |
|------|--------|
| Migration | Add team-aware SELECT RLS policy on `cron_job_logs` |

No code changes needed — the Connections/ColeteOnline pages already query `cron_job_logs` and will automatically show results once the policy allows access.

