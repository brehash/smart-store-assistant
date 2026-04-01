

# Add Return Shipment Detection + Configurable Order Status Mapping

## Problem
1. The cron worker only detects delivered shipments (codes 20800, 30500) but not returned ones (24300, 9512).
2. The WooCommerce status to set on delivery/return is hardcoded to "completed" — users can't choose which status to apply.

## Changes

### 1. Settings UI — `src/pages/Settings.tsx`

Add two dropdowns to the Colete Online integration card (below Client Secret), populated from the existing `orderStatuses` list already fetched for the connection tab:

- **Status la livrare** (Delivered status) — default: `completed`
- **Status la retur** (Returned status) — default: `refuzata` or user's choice

Store these in the integration config alongside `client_id`/`client_secret`:
```json
{
  "client_id": "...",
  "client_secret": "...",
  "delivered_status": "completed",
  "returned_status": "refuzata"
}
```

New state vars: `coleteDeliveredStatus`, `coleteReturnedStatus`. Load from config on mount, save via existing `handleSaveIntegration`. The dropdowns reuse the `orderStatuses` array (fetched when a WooCommerce connection exists).

### 2. Worker Edge Function — `supabase/functions/colete-online-worker/index.ts`

- Read `config.delivered_status` (default `"completed"`) and `config.returned_status` (default `"refuzata"`) from the integration config.
- Expand delivery detection to also check for return codes:
  ```
  isDelivered = history.some(h => h.code === 20800 || h.code === 30500)
  isReturned = history.some(h => h.code === 24300 || h.code === 9512)
  ```
- When `isReturned`, update WooCommerce order to `returned_status` instead of `delivered_status`.
- Add `ordersReturned` counter to logging, and log action as `"returned"`.

### 3. CronJobLogs UI — `src/components/admin/CronJobLogs.tsx`

- Display the new `orders_returned` summary field in the worker detail cards.

## Files

| File | Change |
|------|--------|
| `src/pages/Settings.tsx` | Add delivered/returned status dropdowns to integration card, persist in config |
| `supabase/functions/colete-online-worker/index.ts` | Detect return codes 24300/9512, use configurable statuses |
| `src/components/admin/CronJobLogs.tsx` | Show returned orders count |

