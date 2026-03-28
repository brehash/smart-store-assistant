

## Add Retry-After Handling for Colete Online 429 Responses

### Overview
Add a retry mechanism to the Colete Online API calls (both token and status endpoints) that respects the `Retry-After` header when receiving a 429 response.

### Changes

**File: `supabase/functions/chat/index.ts`**

Add a helper function `fetchWithRetry` that wraps `fetch` and handles 429s:
- If response is 429, read the `Retry-After` header (seconds)
- Wait that many seconds (cap at ~30s to avoid edge function timeout)
- Retry the request once after waiting
- If still 429 on retry, return a user-friendly error with the wait time

Apply this to both API calls in the `check_shipping_status` handler:
1. Token endpoint (`https://auth.colete-online.ro/token`) — line ~1575
2. Status endpoint (`https://api.colete-online.ro/v1/order/status/{uniqueId}`) — line ~1592

### Implementation Detail

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const resp = await fetch(url, options);
    if (resp.status === 429) {
      const retryAfter = parseInt(resp.headers.get("Retry-After") || "5", 10);
      const waitSec = Math.min(retryAfter, 30);
      await new Promise(r => setTimeout(r, waitSec * 1000));
      continue;
    }
    return resp;
  }
  return fetch(url, options); // final attempt
}
```

Replace the two `fetch()` calls with `fetchWithRetry()`. Update the error messages for 429 to say "Rate limited by Colete Online. Please try again in X seconds."

