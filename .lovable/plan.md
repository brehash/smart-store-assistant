

## Add Retry Countdown Reasoning Messages

### Problem
When the Colete Online API returns 429 and the system retries, the user only sees a loading state with no indication of what's happening.

### Solution
Update `fetchWithRetry` in `supabase/functions/chat/index.ts` to emit a `reasoning` SSE event before waiting, telling the user: "Rate limited by Colete Online. Retrying in X seconds..."

### Changes

**File: `supabase/functions/chat/index.ts`**

1. Modify `fetchWithRetry` to accept `sendSSE` as a parameter
2. Before the `await new Promise(...)` delay, emit a reasoning event:
   ```typescript
   sendSSE({ type: "reasoning", text: `Rate limited by Colete Online. Retrying in ${waitSec} seconds...` });
   ```
3. If the final attempt still returns 429, emit another reasoning message with the error
4. Update both call sites to pass `sendSSE`

Single file change, ~5 lines modified.

