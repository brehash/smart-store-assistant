

# Fix: Infinite RLS Recursion Logging User Out

## Problem

The `team_members` table SELECT policy references itself:
```sql
USING (user_id = auth.uid() OR team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid()))
```
To evaluate this policy, Postgres must SELECT from `team_members`, which triggers the same policy again — infinite recursion.

This cascades to `teams`, `woo_connections`, and `woo_cache` policies that all sub-query `team_members`.

The retry logic in `Index.tsx` then calls `refreshSession()` repeatedly, hitting 429 rate limits and eventually killing the session.

## Fix

### 1. Database migration — Create a security definer function + fix all policies

Create `is_team_member(_user_id uuid)` as `SECURITY DEFINER` (bypasses RLS, like `has_role`):
```sql
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id)
$$;

CREATE OR REPLACE FUNCTION public.get_user_team_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM public.team_members WHERE user_id = _user_id
$$;
```

Then drop and recreate all recursive policies:

- **team_members SELECT**: `USING (user_id = auth.uid() OR team_id IN (SELECT public.get_user_team_ids(auth.uid())))`
- **teams SELECT**: `USING (owner_id = auth.uid() OR id IN (SELECT public.get_user_team_ids(auth.uid())))`
- **woo_cache team SELECT**: use `get_user_team_ids` to find team → owner
- **woo_connections team SELECT**: same approach
- **team_invitations SELECT**: same approach
- **credit_balances SELECT**: same approach

### 2. `src/pages/Index.tsx` — Stop the retry storm

Remove the `refreshSession()` retry loop. Instead, on `connError`, just fall through to the conversations safety net without retrying auth. The single `checkConnection` call should either work or gracefully degrade:

```typescript
if (connError && !ownConn) {
  console.warn("Connection check error:", connError.message);
  // Don't retry — just check conversations as safety net
  const { count } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (count && count > 0) {
    setHasConnection(true);
    fetchCachedData(user.id);
    return;
  }
  setHasConnection(false);
  return;
}
```

## Files

| File | Change |
|------|--------|
| New migration SQL | Security definer functions + recreate all team-related RLS policies without self-references |
| `src/pages/Index.tsx` | Remove `refreshSession()` retry loop, use conversations fallback only |

