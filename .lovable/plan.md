

## Two Fixes: Pipeline Disappearing on Tab Switch + New Product Sales Tool

### Issue 1: Pipeline disappears when switching tabs

**Root cause**: The pipeline UI state lives only in React state (`useState`). When you switch tabs and come back, React doesn't re-render — but the streaming assistant message (without an `id`) is identified by `!last.id` in `updateLastAssistant`. The real problem is that during streaming, the message has no `id` (it's not yet persisted). When the browser tab loses focus and regains it, React's state is intact, so this shouldn't cause disappearance on its own.

The actual cause is likely the SSE connection being interrupted by the browser throttling background tabs. When the tab is backgrounded, Chrome throttles timers and may close idle connections. The stream dies silently, but `onDone`/`onError` may not fire cleanly, leaving `isStreaming = true` and the partial message without persistence.

**Fix**:
- Add a `visibilitychange` listener that, when the tab becomes visible again while `isStreaming` is true, checks if the stream is still alive. If the connection died, call `onError` to persist the partial message and show a toast.
- In `onDone`, always persist the assistant message (currently it persists correctly, but the pipeline metadata should also be saved even if content is empty).
- Add a `useRef` to track whether the stream is still active, so the visibility handler can detect stale streams.

**Files**: `src/pages/Index.tsx`

---

### Issue 2: New `get_product_sales_report` tool

**Problem**: `get_sales_report` returns only aggregate revenue + daily breakdown. It does NOT return per-product data (revenue per product, units sold per product). The AI has no single tool to answer "which products dominate" without calling `get_product_sales` for each product individually (which wastes iterations).

**Fix**: Add a new tool `get_product_sales_report` that fetches all orders for a period and aggregates by product, returning for each product:
- `product_id`, `product_name`
- `total_revenue` (valoric)
- `total_quantity` (cantitativ / units sold)
- `order_count` (how many orders contained it)
- `average_price` per unit

This is built from the same orders data as `get_sales_report` but aggregates by line item instead of by date.

**Implementation** (in `supabase/functions/chat/index.ts`):

1. Add tool definition:
```
name: "get_product_sales_report"
description: "Get per-product sales breakdown for a date range. Returns each product with its total revenue, units sold, and order count. Use for product dominance, top sellers, and product-level analysis."
parameters: date_min, date_max, period (same as get_sales_report), limit (default 50)
```

2. Add tool execution in `executeTool`:
   - Fetch orders for the period (same pagination as `get_product_sales`, up to 3 pages)
   - Iterate `order.line_items`, aggregate by `product_id`
   - Sort by `total_revenue` descending
   - Return array of `{ product_id, product_name, total_revenue, total_quantity, order_count, average_price }`
   - Rich content: product table or chart

3. Add to `TOOL_LABELS`, `generateSemanticPlan`, `generateReasoningBefore/After`, `truncateForAI`

4. Update system prompt to instruct AI to use this tool for product dominance questions

**Files**: `supabase/functions/chat/index.ts`

---

### Summary of changes

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add `visibilitychange` listener to detect dead streams when tab regains focus; persist partial messages |
| `supabase/functions/chat/index.ts` | Add `get_product_sales_report` tool (definition, execution, semantic plan, reasoning, truncation, system prompt update) |

