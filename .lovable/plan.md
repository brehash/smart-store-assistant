

# Enhance Cron Job Logs with per-order details and Colete Online statuses

## Problem
Currently the tracker only logs `completedOrders` (orders that were marked completed). Orders that have AWBs but are still in transit are counted but not individually listed — you can't see which orders were checked or what their shipping status was.

## Solution

### 1. Edge function: log all checked orders with their status (`supabase/functions/colete-online-tracker/index.ts`)

Add a new `checkedOrders` array to `userLog` that captures every order with an AWB, including:
- `orderId`, `awb`, `uniqueId`
- `wooStatus` (current WooCommerce status, e.g. "processing")
- `shippingStatus` — the latest Colete Online status description from the history
- `shippingCode` — the latest status code (e.g. 20800 = delivered)
- `action` — what happened: `"completed"`, `"in_transit"`, `"no_history"`, or `"error"`

This replaces the limited `completedOrders` array with a full picture. Around line 184, after confirming an AWB exists, push an entry for every order regardless of delivery status.

### 2. Frontend: display order-level details (`src/components/admin/CronJobLogs.tsx`)

In the expanded detail section for each user/store, replace the simple "Completed Orders" list with a full table showing:

| Order # | AWB | Shipping Status | Action |
|---------|-----|----------------|--------|
| #1234 | RO123... | Delivered (20800) | ✅ Completed |
| #1235 | RO456... | In delivery (20400) | ⏳ In Transit |
| #1236 | RO789... | — | ❌ Error |

Color-code the action column: green for completed, yellow/muted for in transit, red for errors.

### Files changed

| File | Change |
|------|--------|
| `supabase/functions/colete-online-tracker/index.ts` | Add `checkedOrders` array with per-order shipping status and action |
| `src/components/admin/CronJobLogs.tsx` | Update interface + render a detailed orders table in the expanded section |

