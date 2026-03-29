

# Fix Pick List: Per-Unit Collection Tracking

## Problem
Currently picking uses a boolean Set (`pickedKeys`) — one click marks the entire line as done regardless of quantity. Need per-unit counting where each click increments collected count, and only mark finished when `collected >= total`.

## Changes — `src/pages/PackageSlips.tsx`

### 1. Replace state
- Remove `pickedKeys` (Set\<string\>) state
- Add `collectedByKey` (Record\<string, number\>) state initialized to `{}`
- Reset it to `{}` in `loadOrders`

### 2. Replace toggle function
- Remove `togglePicked`
- Add `collectOne(key, totalQty)` — increments count by 1, capped at totalQty
- Add `uncollectOne(key)` — decrements count by 1, min 0

### 3. Update Pick List row rendering
- Derive `collectedQty = collectedByKey[item.key] ?? 0` and `finished = collectedQty >= item.totalQty`
- Checkbox `checked` = `finished`, `onCheckedChange` toggles: if checking → collectOne, if unchecking → uncollectOne
- Row click → `collectOne` (single increment per click, not toggle)
- Qty column shows `collectedQty / totalQty` instead of just totalQty
- Row opacity based on `finished`, line-through on name based on `finished`

### 4. Update Slips tab item display
- Keep as-is (slips show order line items, not pick aggregation)

