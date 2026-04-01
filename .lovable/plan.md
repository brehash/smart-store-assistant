

# Fix: Owner Still Seeing "Connect Website" Card

## Root Cause

The `checkConnection` query at line 109-114 silently returns `null` when the auth session has stale/expired tokens (e.g., after stopping impersonation, or after a long idle period). Supabase RLS queries don't throw errors on auth failure — they just return empty results. The code then falls through all checks and sets `hasConnection(false)`.

The DB confirms the connection exists (`is_active: true`, user_id matches). The query itself is correct — the problem is transient auth failures causing silent empty results.

## Fix Strategy

Make the connection check more resilient by adding error detection and a simple guard:

### 1. `src/pages/Index.tsx` — Add error checking to the connection query

Instead of ignoring query errors, check for them. If the query returns an error, don't set `hasConnection(false)` — keep it as `null` (loading) and retry after a session refresh:

```typescript
const { data: ownConn, error: connError } = await supabase
  .from("woo_connections")
  .select("id, order_statuses")
  .eq("user_id", user.id)
  .eq("is_active", true)
  .maybeSingle();

if (connError) {
  // Auth might be stale — refresh and retry once
  await supabase.auth.refreshSession();
  const { data: retryConn } = await supabase
    .from("woo_connections")
    .select("id, order_statuses")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (retryConn) {
    setHasConnection(true);
    setCachedSelectedStatuses(retryConn.order_statuses || []);
    fetchCachedData(user.id);
    return;
  }
}
```

### 2. `src/pages/Index.tsx` — Never show ConnectionSetupCard if conversations exist

The existing guard `messages.length === 0` only checks the currently loaded messages array. Add a check against the conversation list: if the user has ANY conversations in the database, they clearly had a working connection before and should never see the setup card.

```typescript
// Before setting hasConnection(false), check if user has any conversations
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
```

This is the ultimate safety net — if you've ever chatted, you had a connection.

## Files

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Add error handling + session refresh retry on connection query; add conversation-count safety net before showing setup card |

