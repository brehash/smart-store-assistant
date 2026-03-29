

# Fix: Checkbox increments collected by 1, not jumping to full quantity

## Problem
Two bugs causing the checkbox to mark items as fully collected in one click:

1. **Checkbox `onCheckedChange`** currently sets collected to `totalQty` (all at once) instead of incrementing by 1
2. **Row `onClick`** also calls `collectOne`, so even with `stopPropagation` on the `TableCell`, clicking anywhere on the row adds +1 — but the checkbox handler overrides to full qty anyway

## Fix — `src/pages/PackageSlips.tsx`

### Row click (line 519)
Remove the row `onClick` entirely. Clicking the row should NOT collect — only the checkbox should increment. This avoids accidental collections from tapping anywhere on the row.

### Checkbox handler (lines 522-531)
Change `onCheckedChange` to increment by 1 each click (using `collectOne`), and only allow unchecking (reset to 0) when fully collected:

```tsx
<TableRow
  key={item.key}
  className={finished ? "opacity-50" : ""}
>
  <TableCell className="px-2 py-1">
    <Checkbox
      className="h-3.5 w-3.5"
      checked={finished}
      onCheckedChange={() => {
        if (finished) {
          uncollectOne(item.key);
        } else {
          collectOne(item.key, item.totalQty);
        }
      }}
    />
  </TableCell>
```

This way:
- Each checkbox click adds +1 to collected count
- Only shows as "checked" when `collectedQty >= totalQty`
- Unchecking (when finished) decrements by 1
- No row click interference

