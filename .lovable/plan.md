

# Fix Chart Tooltip Visibility + Add Top Customers Tool

## Issues Identified

1. **Chart tooltips unreadable**: The `<Tooltip />` in `ChatChart.tsx` uses Recharts defaults (white background, dark text), but on your dark-themed UI the tooltip container blends in or text is hard to read. The screenshot confirms the tooltip appears as a floating white box with poor contrast.

2. **No "top customers" capability**: None of the existing tools aggregate orders by customer. When you ask "top 5 clienti", the AI has no tool to call — `get_product_sales_report` only aggregates by product. A new tool is needed.

## Changes

### 1. Fix Chart Tooltip — `src/components/chat/ChatChart.tsx`

Add custom `contentStyle` and `labelStyle` to all `<Tooltip />` instances so they match the dark theme:

```tsx
<Tooltip
  contentStyle={{
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--foreground))',
  }}
  labelStyle={{ color: 'hsl(var(--foreground))' }}
/>
```

Apply to all 4 chart types (grouped_bar, bar, line, pie).

### 2. Add `get_top_customers` Tool — `supabase/functions/chat/index.ts`

**Tool definition**: New tool `get_top_customers` with params `date_min`, `date_max`, `limit` (default 5).

**Execution logic**: Fetches orders for the date range (same pagination pattern as `get_product_sales_report`), aggregates by `billing.first_name + billing.last_name`, computing:
- Total revenue per customer
- Order count per customer
- Average order value

Returns sorted by revenue descending, limited to `limit`.

Also returns a `richContent` bar chart showing the top customers.

**System prompt update**: Add instruction that for "top customers" / "top clienti" / "best customers" queries, the AI must call `get_top_customers`.

## Files Modified
1. `src/components/chat/ChatChart.tsx` — Themed tooltip styles
2. `supabase/functions/chat/index.ts` — New `get_top_customers` tool definition, execution case, pipeline step label, summary, and system prompt instruction

