

# Package Slips — Mobile-First Redesign + Images + Checkboxes + Confirmation

## Changes to `src/pages/PackageSlips.tsx`

### 1. Add product images
- Extend `LineItem` interface to include `image?: { src: string }` 
- Extend `PickItem` to include `image?: string`
- Show thumbnail (32x32) next to product name in both Pick List and Order Slips

### 2. Add checkboxes to Pick List items
- Track checked/picked items via `Set<string>` state (`pickedKeys`)
- Each pick list row gets a checkbox; checked items show strikethrough on product name and reduced opacity (like the reference screenshot's `2/2` pattern)
- Show picked count vs total: `{pickedCount} / {totalQty}` in the Qty column

### 3. Mobile-first condensed layout
- Remove Card wrapper from Pick List — render table directly for less padding
- Reduce config bar spacing: stack vertically on mobile, smaller text
- Make the tab bar + "Mark All" button stack vertically on small screens
- Use compact table cells (`py-1`, `text-xs`/`text-sm`)
- Order Slips: single column on mobile (already is), tighter padding

### 4. Confirmation dialog before marking as packed
- Import `AlertDialog` from existing UI components
- When user clicks "Mark as Packed" on an order, open a dialog showing:
  - Order number and customer name
  - List of line items with quantities
  - "Confirm" and "Cancel" buttons
- Store `confirmOrderId` in state; dialog opens when non-null
- On confirm, call `markAsPacked(confirmOrderId)` and close dialog
- Same for "Mark All as Packed" — show a summary dialog

### Files changed
- `src/pages/PackageSlips.tsx` — all changes in this single file

