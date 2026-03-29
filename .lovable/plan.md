

# Package Slips: Auto-load, Realtime Orders, Persist Collection State

## 1. Auto-load orders on page open when preferences exist

In the `useEffect` that loads preferences (lines 105-123), after setting `sourceStatuses` and `targetStatus`, trigger `loadOrders` automatically if both values are present.

- Add a `useRef` flag (`autoLoadDone`) to prevent repeated auto-loads
- After `setPrefsLoaded(true)`, if `sourceStatuses` and `targetStatus` are set, call `loadOrders` via a separate `useEffect` that watches `prefsLoaded`

## 2. Persist collected state across refresh (localStorage)

Use `localStorage` keyed by user ID to persist `collectedByKey`, `orders`, and `packedIds`:

- On every change to `collectedByKey`, save to `localStorage` (`ps_collected_{userId}`)
- On every change to `orders`, save to `localStorage` (`ps_orders_{userId}`)  
- On every change to `packedIds`, save to `localStorage` (`ps_packed_{userId}`)
- On mount, restore from `localStorage` before/instead of clearing state
- In `loadOrders`, merge new orders with existing rather than replacing — keep `collectedByKey` intact for items that still exist, remove entries for items no longer present
- Add a "Clear Session" button to manually reset everything

## 3. Realtime: auto-add new orders via webhook events

Subscribe to the `webhook_events` table using Supabase Realtime (already enabled per memory). When a new `order.created` or `order.updated` event arrives with a matching status:

- Extract the order data from the webhook payload
- If the order ID already exists in `orders`, update it
- If new, append it to `orders`
- Recalculate the pick list (already derived from `orders`)
- For pick items that already exist, keep `collectedByKey` values — only the `totalQty` changes via the derived `pickList`
- Show a toast notification: "New order #X added"

## Technical Details

### File: `src/pages/PackageSlips.tsx`

**New imports**: none needed (already has supabase, useEffect, useRef)

**State changes**:
- Remove the clearing of `collectedByKey` in `loadOrders` (line 181) — instead, prune keys that no longer exist in the new pick list
- Initialize state from localStorage on mount

**New effects**:
1. **Restore from localStorage** — runs once on mount, restores `orders`, `collectedByKey`, `packedIds`
2. **Auto-load** — watches `prefsLoaded` + `sourceStatuses.length > 0`, calls `loadOrders` once
3. **Persist to localStorage** — watches `collectedByKey`, `orders`, `packedIds` and saves
4. **Realtime subscription** — subscribes to `webhook_events` INSERT events, filters by `user_id`, checks if order status matches `sourceStatuses`, fetches full order via woo-proxy if needed and merges into state

**loadOrders changes**:
- Instead of `setOrders([])` and `setCollectedByKey({})`, merge: set new orders, then prune `collectedByKey` to only keep keys present in the new pick list (preserving collected counts for items that still exist)

**Clear Session button**: Add next to "Load Orders" — clears localStorage and resets all state

