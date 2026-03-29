

# Fix: `get_sales_report` missing first days of month

## Root cause

The tool fetches orders with `per_page=100` and makes a **single API call** (line 92, 110). WooCommerce returns orders sorted by date descending by default. So for a month with more than 100 orders, only the **most recent 100** are returned — the earliest days of the month are cut off.

Your screenshot confirms this: 100 orders total, chart starts around March 4 with gaps at the beginning, and a spike of ~14,000 on March 1 showing `value: 0` on hover — that date was backfilled by the gap-filling loop (lines 118-126) but has no actual order data.

## Fix

Paginate through all orders in `get_sales_report` — loop with `page=1,2,3...` fetching 100 per page until a page returns fewer than 100 results (or a safety cap of 10 pages = 1000 orders).

### Changes in `supabase/functions/chat/tool-executor.ts` (lines 90-147)

Replace the single `callWooProxy` call with a pagination loop:

```typescript
case "get_sales_report": {
  const baseParams = new URLSearchParams();
  baseParams.set("per_page", "100");
  if (defaultOrderStatuses.length) baseParams.set("status", defaultOrderStatuses.join(","));
  
  // ... existing date logic (lines 94-108) ...
  
  if (startDate) baseParams.set("after", `${startDate}T00:00:00`);
  if (endDate) baseParams.set("before", `${endDate}T23:59:59`);

  // Paginate through all orders
  let allOrders: any[] = [];
  for (let page = 1; page <= 10; page++) {
    baseParams.set("page", String(page));
    const endpoint = `orders?${baseParams.toString()}`;
    const pageOrders = await callWooProxy(supabaseUrl, authHeader, { endpoint });
    if (!Array.isArray(pageOrders)) break;
    allOrders = allOrders.concat(pageOrders);
    if (pageOrders.length < 100) break; // last page
  }
  
  // Use allOrders instead of orders for all calculations
  // ... rest of existing logic unchanged ...
}
```

Also apply the same pagination fix to `compare_sales` `fetchPeriod` helper (lines 150-160), which has the same `per_page=100` single-call problem.

### Summary

| File | Change |
|------|--------|
| `supabase/functions/chat/tool-executor.ts` | Add pagination loop to `get_sales_report` and `compare_sales` to fetch all orders, not just first 100 |

