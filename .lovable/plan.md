

# Fix: Team members see ConnectionSetupCard after accepting invite

## Root cause

There's a race condition in `Auth.tsx`. When a user with an `invite_token` logs in:

1. `handleSubmit` calls `signInWithPassword`, succeeds, then immediately calls `navigate("/")`  (line 96)
2. The useEffect that accepts the invite (lines 63-84) watches `[user, inviteToken]` — but the component unmounts due to the navigation before (or just as) it fires
3. The user lands on `/` where `checkConnection` queries `team_members` — but the invite hasn't been accepted yet, so no row exists
4. `hasConnection` is set to `false` → ConnectionSetupCard appears

## Fix

### 1. `src/pages/Auth.tsx` — Don't navigate away when invite token is present

In `handleSubmit`, when `inviteToken` exists, do NOT call `navigate("/")` after login. Instead, let the existing invite-acceptance useEffect handle the navigation after the invite is fully processed.

```typescript
// Line 96: change from
navigate("/");
// to
if (!inviteToken) navigate("/");
```

This way, after login with an invite token, the component stays mounted, `user` becomes non-null, the useEffect fires, accepts the invite (creating the `team_members` row), and only then navigates to `/`.

### 2. `src/pages/Index.tsx` — Add a safety re-check (belt-and-suspenders)

After the initial `checkConnection` runs, if `hasConnection` is still `false`, add a short delayed retry (e.g. 2 seconds) to handle edge cases where the invite acceptance is still in-flight:

```typescript
// After checkConnection(), if no connection found, retry once after a delay
if (!ownConn && !membership) {
  setTimeout(() => checkConnection(), 2000);
}
```

This is a fallback only — the Auth.tsx fix is the primary solution.

## Files changed

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` | Skip `navigate("/")` when `inviteToken` is present |
| `src/pages/Index.tsx` | Add delayed retry for connection check as fallback |

