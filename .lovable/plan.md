

# Sort pick list by total quantity (descending)

## Change

In `src/pages/PackageSlips.tsx` line 335, change the sort from alphabetical to descending by `totalQty`:

```typescript
// Before
return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));

// After
return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
```

This is a one-line change. Items with the highest quantity to collect appear first. The sort runs once when the pick list is computed from orders — no re-sorting on interaction.

