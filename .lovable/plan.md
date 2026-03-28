

## Fix Credit Management + Add Loading States and Toast Messages

### Root Cause

The admin edge function uses `auth.getClaims()` which may not be reliably available in the Supabase JS client version used in edge functions. This could silently fail, causing the auth check to reject the request with a 401. The frontend also doesn't properly handle or display error responses from the backend.

### Changes

#### 1. Fix admin edge function auth (`supabase/functions/admin/index.ts`)
- Replace `userClient.auth.getClaims()` with `userClient.auth.getUser()` which is the standard, reliable method
- Extract `userId` from `user.id` instead of `claims.sub`
- Add error logging for credit operations to help debug

#### 2. Improve UserDetail UI (`src/components/admin/UserDetail.tsx`)
- Add proper loading states with spinners/disabled states on all buttons (Save Limits, Save Allowance, Apply Credits)
- Add detailed toast messages for success AND error cases with descriptive text
- Show loading skeleton while credits data is being fetched
- Handle non-OK responses by reading the error body and displaying it in the toast
- Add loading state for initial data fetch (conversations, messages, credits)

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/admin/index.ts` | Fix auth: replace `getClaims` with `getUser` |
| `src/components/admin/UserDetail.tsx` | Add loading states, error handling, detailed toasts |

### Technical Details

**Auth fix:**
```typescript
// Before (broken):
const { data: claimsData } = await userClient.auth.getClaims(token);
const userId = claimsData.claims.sub;

// After (correct):
const { data: { user }, error } = await userClient.auth.getUser();
const userId = user.id;
```

**Toast improvements:**
- Success: "Added 1000 credits to user. New balance: 1100"
- Error: "Failed to adjust credits: {error message from server}"
- Loading: Button text changes to "Saving..." with disabled state

