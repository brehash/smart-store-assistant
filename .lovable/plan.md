

# Fix: Checkbox double-toggle in Pick List

## Problem
The `TableRow` has `onClick={() => togglePicked(item.key)}` and the `Checkbox` inside it has `onCheckedChange={() => togglePicked(item.key)}`. Clicking the checkbox triggers both handlers, so the item toggles on then immediately off — appearing as if nothing happened.

## Fix (`src/pages/PackageSlips.tsx`)

**Line 390-394** — Add `e.stopPropagation()` on the checkbox's wrapping `TableCell` to prevent the row click from also firing:

```tsx
<TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
  <Checkbox
    className="h-3.5 w-3.5"
    checked={picked}
    onCheckedChange={() => togglePicked(item.key)}
  />
</TableCell>
```

One line change — add `onClick={(e) => e.stopPropagation()}` to the `TableCell` wrapping the checkbox. The row click still works for clicking anywhere else on the row.

