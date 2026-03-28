

## Fix: Pipeline Disappearing on Multi-Turn Conversations

### Root Cause

The edge function uses `stream: false` for AI API calls (line 905). On multi-turn conversations, the accumulated context (system prompt + all previous messages + full tool results with 100+ orders as raw JSON) grows very large. This causes:

1. **AI API timeout**: The second/third AI call (after feeding tool results back) takes too long with a huge context, exceeding the edge function's execution limit (150s free / 400s paid).
2. **No keep-alive**: During the blocking `fetch()` to the AI API, no SSE data is sent to the client, so the browser or infrastructure may drop the connection.
3. **Large tool results**: Full order arrays and daily breakdowns are passed verbatim back into `aiMessages`, ballooning token usage on each iteration.

The "1433s thinking" in the screenshot is the frontend timer still counting after the connection silently died.

### Fix Strategy

#### 1. Truncate tool results before feeding back to AI (`chat/index.ts`)
After executing a tool, summarize/truncate the result before pushing it into `aiMessages`. The AI doesn't need 100 raw order objects — it needs the aggregated stats.

- For `get_sales_report`: keep `totalRevenue`, `orderCount`, and first/last 5 entries of `dailyBreakdown`
- For `search_orders`: keep only first 10 orders, with only key fields (id, status, total, date)
- For `search_products`: keep only first 10 products with key fields
- For `get_product_sales`: keep summary stats, drop `matching_orders` and truncate `daily_breakdown`
- Create a `truncateForAI(toolName, result)` function

#### 2. Add SSE keep-alive pings during AI calls (`chat/index.ts`)
Wrap the AI `fetch()` call in a race with periodic SSE comment pings (`:keepalive\n\n` every 15s) to prevent connection drops.

#### 3. Trim conversation history (`chat/index.ts`)
Before building `aiMessages`, limit the history to the last ~20 messages (plus system prompt). Old tool results from previous turns are the biggest context bloat.

#### 4. Add client-side inactivity handling (`chat-stream.ts`)
The 120s timeout already exists but the pipeline UI doesn't clean up properly when it fires. Ensure `onError` marks the pipeline as failed so the UI shows an error state instead of frozen steps.

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/chat/index.ts` | Add `truncateForAI()`, add keep-alive pings during AI fetch, trim conversation history to last 20 messages |
| `src/lib/chat-stream.ts` | No changes needed (timeout already exists) |

### Implementation Details

**`truncateForAI` function** (new, in edge function):
```typescript
function truncateForAI(toolName: string, result: any): any {
  try {
    const str = JSON.stringify(result);
    if (str.length < 3000) return result; // small enough
    // For sales reports, keep only summary
    if (toolName === "get_sales_report") {
      return { totalRevenue: result.totalRevenue, orderCount: result.orderCount, 
               dailyBreakdown: `${result.dailyBreakdown?.length || 0} days (truncated)` };
    }
    // For arrays (orders, products), keep first 5 items trimmed
    if (Array.isArray(result)) {
      return result.slice(0, 5).map(item => {
        const { id, name, status, total, date_created } = item;
        return { id, name, status, total, date_created };
      });
    }
    // Generic: stringify and cut
    return JSON.parse(str.slice(0, 3000) + '"}');
  } catch { return { summary: "Data received (truncated for context)" }; }
}
```

**Keep-alive wrapper**:
```typescript
async function fetchWithKeepalive(url, options, sendSSE) {
  const fetchPromise = fetch(url, options);
  const interval = setInterval(() => {
    sendSSE({ type: "reasoning", text: "Still processing..." });
  }, 15000);
  try { return await fetchPromise; } 
  finally { clearInterval(interval); }
}
```

**History trimming** (before line 881):
```typescript
const trimmedMessages = sanitizeAiHistory(messages).slice(-20);
let aiMessages = [{ role: "system", content: systemPrompt }, ...trimmedMessages];
```

