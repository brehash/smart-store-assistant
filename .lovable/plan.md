

# Fix: Product Sliders, Charts, Sales Reports & Comparisons

## Issues Identified

1. **Products not showing as slider cards** — The `rich_content` SSE event is sent but the frontend `onToolCall` handler in `Index.tsx` overwrites `richContent` on each call. More critically, the rich content is sent as a generic SSE event and may not be properly attached to the assistant message when products are returned from `search_products`.

2. **Charts not displaying** — The `chart` rich content is sent via `rich_content` SSE event, but the `onToolCall` callback only sets the last rich content received. The chart data from `get_sales_report` is being overwritten by any subsequent content, or the AI is returning the data as text instead of triggering the tool.

3. **Missing days in sales report** — The `get_sales_report` tool only returns days that have orders. Days with zero sales are skipped because `byDate` only accumulates dates from actual orders. Need to fill in gaps.

4. **No period comparison** — There's no `compare_periods` tool. The AI has no way to fetch two date ranges and compare them.

## Changes

### 1. Edge Function (`supabase/functions/chat/index.ts`)

**Fix sales report date gaps**: In `get_sales_report`, after building `byDate`, iterate from `date_min` to `date_max` day by day and fill missing dates with `0` revenue.

**Add `compare_sales` tool**: New tool definition that takes two date ranges (`period_a_start`, `period_a_end`, `period_b_start`, `period_b_end`), fetches orders for both, and returns comparison data with a grouped bar chart rich content.

**Fix rich content for products**: Ensure the `rich_content` event for products is always emitted when `search_products` or `get_product` returns results.

### 2. Frontend — Support Multiple Rich Contents (`Index.tsx`)

Change `richContent` from a single object to an array (`richContents: RichContent[]`) on each message. The `onToolCall` callback appends instead of replacing. This way both a product slider AND a chart can appear in the same message.

### 3. Frontend — ChatMessage & Rendering

Update `ChatMessage` to render an array of `richContents` — iterating and rendering the appropriate component (ProductSlider, OrderTable, ChatChart) for each.

### 4. Edge Function — Fill Missing Dates in Sales Report

```text
// After building byDate from orders:
// Generate all dates between start and end
// For each date not in byDate, set value to 0
```

This ensures "sales report for this week" shows all 7 days, including days with 0 revenue.

### 5. New Tool: `compare_sales`

Parameters: `period_a_start`, `period_a_end`, `period_b_start`, `period_b_end`, `period_a_label`, `period_b_label`

Returns comparison stats (total revenue, order count for each period) plus a grouped bar chart showing both periods side by side.

### Files Modified
- `supabase/functions/chat/index.ts` — fix date gaps, add compare tool, update system prompt
- `src/pages/Index.tsx` — change richContent to array, append instead of replace
- `src/components/chat/ChatMessage.tsx` — render array of rich contents
- `src/components/chat/ChatChart.tsx` — support grouped bar chart for comparisons

