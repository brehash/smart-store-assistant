

# Wrap Product Names & Remove SKU

## Changes to `src/pages/PackageSlips.tsx`

### 1. Pick List — wrap names, remove SKU, keep qty visible
- Line 406: Change `truncate` to `break-words` / remove truncate so product name wraps
- Lines 407-409: Remove the SKU `<p>` block entirely
- Ensure the Qty column (`w-16`) stays visible by keeping `flex-shrink-0` on qty cell

### 2. Order Slips — wrap names, remove SKU reference
- Line 462: Change `truncate` to `break-words` on the item name `<span>` so it wraps instead of cutting off
- The slips don't currently show SKU separately, but the print function does — remove SKU from `printSlip` output too (line 261)

### 3. Confirmation dialog — wrap names
- Line 519: Change `truncate` to `break-words` on confirmation dialog item names

### Summary of changes
All in one file (`src/pages/PackageSlips.tsx`):
- Remove `truncate` class, add wrapping on product names in pick list, slips, and confirmation dialog
- Remove SKU display from pick list rows
- Remove SKU from print slip HTML

