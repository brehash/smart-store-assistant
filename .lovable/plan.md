

# Package Slip Tool with Saved Preferences

## Overview
Create a dedicated Package Slips page accessible from the sidebar. Users select source order statuses and a target "after packing" status; these choices are persisted to `user_preferences` so the tool remembers them on next use.

## Files to Create

### `src/pages/PackageSlips.tsx`
Main page with three sections:
1. **Configuration bar** — multi-select for source statuses, single-select for target status, "Load Orders" button. On mount, load saved preferences from `user_preferences` (type `package_slip_config`, key `default`). On change, upsert back to `user_preferences`.
2. **Pick List tab** — aggregated table: product name, SKU, total quantity across all orders. Sorted by name.
3. **Order Slips tab** — per-order cards: order #, customer name/address, line items + quantities, checkbox to mark as packed. "Mark Selected as Packed" button calls `woo-proxy` to PUT each order to the target status.

Data fetched via `supabase.functions.invoke("woo-proxy", { body: { endpoint: "orders", method: "GET", ... } })` with `status=processing,on-hold` (from selected statuses) and `per_page=100`.

### Preference persistence
- Uses existing `user_preferences` table with `preference_type = 'package_slip_config'`
- Value shape: `{ sourceStatuses: ["processing"], targetStatus: "completed" }`
- Need to add `'package_slip_config'` to the CHECK constraint on `preference_type`

## Files to Modify

### `src/App.tsx`
Add protected route: `/package-slips` → `<PackageSlips />`

### `src/components/chat/ConversationSidebar.tsx`
Add "Package Slips" nav link with `Package` icon, linking to `/package-slips`

## Database Migration
```sql
ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_preference_type_check;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_preference_type_check
  CHECK (preference_type IN ('product_alias','shortcut','pattern','meta_definition','package_slip_config'));
```

## Technical Details
- Reuses `woo-proxy` for all WooCommerce API calls (fetch orders, update status)
- Order statuses list comes from `woo_connections.order_statuses` (already cached)
- Uses existing UI: `Table`, `Card`, `Checkbox`, `Select`, `Button`, `Tabs`, `Badge`
- Team members resolve connection through team owner (already handled by `woo-proxy`)
- Preferences auto-save on selection change (debounced upsert)

