

## Semantic Pipeline Experience

### Problem
The current pipeline is reactive — it just echoes tool names as they execute. The user wants a proactive, intent-aware pipeline that feels like watching the AI think, similar to ChatGPT's reasoning display.

### What changes

**Single file: `supabase/functions/chat/index.ts`**

1. **Add an intent-to-pipeline mapper** — a function that takes the list of tool calls + their args and generates semantic step labels instead of raw tool names:
   - `compare_sales` with date args → ["Resolving date ranges", "Fetching orders for Mar 1–26", "Fetching orders for Feb 1–26", "Comparing periods", "Building dashboard"]
   - `get_sales_report` → ["Resolving date range", "Fetching orders", "Calculating metrics", "Building dashboard"]
   - `search_products` → ["Searching product catalog", "Rendering results"]
   - `search_orders` → ["Searching orders", "Rendering results"]
   - `create_order` / `update_order_status` → ["Preparing order action", "Awaiting approval"]

2. **Emit "Understanding request" immediately** before the first AI call, so the pipeline appears instantly when the user sends a message.

3. **Replace the current plan generation** — instead of just mapping tool names, use the semantic mapper after the first AI response returns tool calls. Emit the full semantic plan at that point, with details (e.g., "Period: Mar 1–26, 2026 vs Feb 1–26, 2026").

4. **Add timed progression for post-tool steps** — after all tools finish, emit "Analyzing received data" and "Crafting dashboard" / "Writing explanation" as separate steps that tick to `done` as the final AI content streams.

5. **Include resolved date ranges in step details** — when emitting steps for sales tools, include the normalized date range as the `details` field so users see exactly what dates are being queried.

### Pipeline example for "sales report this month compared to last month same period"

```text
✓ Understanding request
✓ Resolving date ranges
    Period: Mar 1–26, 2026 vs Feb 1–26, 2026
✓ Fetching orders for This Month
✓ Fetching orders for Last Month
✓ Comparing periods
● Building dashboard
○ Writing explanation
```

### No frontend changes needed
`PipelineStep.tsx` already renders `details` under the title (fixed in a prior update). `Index.tsx` already handles dynamic step appending.

