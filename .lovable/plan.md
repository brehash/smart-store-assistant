

# Fix: Owner Seeing "Connect Website" Card

## Root Cause

The `checkConnection` flow in `Index.tsx` has two paths:
1. Check `woo_connections` for `user.id` with `is_active = true`
2. If not found, check `team_members` for `user.id`

The team owner is NOT in `team_members` (only invited members are). So if the owner's `woo_connections` query fails silently (e.g. after impersonation session restore with stale tokens, or any transient auth issue), the flow falls through to `setHasConnection(false)` and the ConnectionSetupCard appears.

Additionally, after impersonation: `stopImpersonation()` calls `setSession()` with saved tokens that may be expired after 1 hour, causing all subsequent queries to silently return empty results.

## Fix — `src/pages/Index.tsx`

1. **Add team owner check**: After the `team_members` check fails, also check if the user owns a team that has a connection. Query `teams` where `owner_id = user.id`, then check if that team has any `woo_connections`:

```typescript
// No own connection, not a team member — check if user OWNS a team
const { data: ownedTeam } = await supabase
  .from("teams")
  .select("id")
  .eq("owner_id", user.id)
  .maybeSingle();

if (ownedTeam) {
  // Owner has a team but their woo_connections query might have failed
  // Re-check without is_active filter as fallback
  const { data: anyConn } = await supabase
    .from("woo_connections")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (anyConn) {
    setHasConnection(true);
    fetchCachedData(user.id);
    return;
  }
}
```

2. **Don't show ConnectionSetupCard when conversations exist**: If the sidebar shows conversations, the user clearly has used the app before. Add a guard: only show ConnectionSetupCard when `hasConnection === false` AND there are no conversations loaded. This prevents the card from flashing even if the connection check transiently fails.

3. **Improve session restoration after impersonation**: In `ImpersonationBanner.stopImpersonation()`, after `setSession()`, call `supabase.auth.refreshSession()` to ensure the tokens are valid before navigating.

## Fix — `src/components/admin/ImpersonationBanner.tsx`

Add `refreshSession()` after restoring the admin session:
```typescript
await supabase.auth.setSession({ access_token, refresh_token });
await supabase.auth.refreshSession(); // ensure fresh tokens
```

## Files

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Add team-owner fallback check; guard ConnectionSetupCard with conversation count |
| `src/components/admin/ImpersonationBanner.tsx` | Refresh session after restore |

