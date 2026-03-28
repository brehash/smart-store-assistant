

## Optimize Token Usage for Shipping Status Checks

### Root Cause
The 10K+ tokens aren't from the shipping result itself (already well-truncated at ~100 tokens). The cost comes from **fixed overhead sent on every AI call**:
- System prompt: ~2,500 tokens (huge prompt with CRUD rules, invoice detection, stock analysis, etc.)
- Tool definitions: ~2,000 tokens (16+ tools always sent)
- Conversation history: variable (up to 20 messages)

A shipping check triggers **2 AI calls** (tool call + response), each carrying the full overhead.

### Changes

**File: `supabase/functions/chat/index.ts`**

1. **Send only relevant tools per intent** — Before calling the AI, detect if the conversation is about shipping and pass only `check_shipping_status` and `update_order_status` tools (instead of all 16+). This alone saves ~1,500 tokens per call.

   Add a lightweight intent classifier that selects a tool subset:
   ```typescript
   function selectToolsForIntent(lastUserMsg: string, hasToolResult: boolean): typeof TOOLS {
     // If we're in a tool-result iteration, send minimal tools
     if (hasToolResult) {
       // Only keep tools the AI might chain (e.g. update_order_status after shipping)
       return TOOLS.filter(t => ["update_order_status", "check_shipping_status"].includes(t.function.name));
     }
     // For shipping queries, limit tools
     const shippingRe = /(shipping|tracking|delivery|livrare|colet|awb|status.*comand|comand.*status|unde.*comand)/i;
     if (shippingRe.test(lastUserMsg)) {
       return TOOLS.filter(t => ["check_shipping_status", "update_order_status", "search_orders"].includes(t.function.name));
     }
     return TOOLS; // full set for general queries
   }
   ```

2. **Trim conversation history more aggressively for follow-up iterations** — During the tool-result loop (iterations 2+), reduce history to last 6 messages instead of 20, since the AI only needs the current context to interpret the tool result.

3. **Shorten the system prompt for shipping-only queries** — Extract a minimal system prompt variant for shipping checks that excludes the lengthy sections about invoice detection, stock analysis, dashboard formatting, etc. This saves ~1,500 tokens.

   ```typescript
   const SHIPPING_PROMPT_SUFFIX = `
   SHIPPING STATUS TRACKING:
   - Do NOT list tracking history as text. The visual timeline handles it.
   - After showing shipping status, if is_delivered=true but order_status!="completed", ask to mark as completed.
   Be conversational. Currency is RON.`;
   ```

   Use the short prompt when the intent is purely shipping.

### Expected Savings
| Component | Before | After | Saved |
|-----------|--------|-------|-------|
| Tool definitions | ~2,000 | ~300 | ~1,700 |
| System prompt | ~2,500 | ~800 | ~1,700 |
| History (iteration 2) | ~2,000 | ~600 | ~1,400 |
| **Total per check** | **~10K+** | **~5-6K** | **~40-50%** |

### Files
1. `supabase/functions/chat/index.ts` — add intent-based tool selection, conditional prompt trimming, and tighter history in follow-up iterations

