

# Fix GEO Audit Tool — Data Structure Mismatches

## Problems Found

**1. Categories: object vs array**
The tool-executor builds `categories` as an **object** with named keys (`content_depth`, `structure`, etc.), each having `{ score, max, details }`. But `GeoReportCard` expects an **array** of `{ name, score, maxScore }`. Result: categories section renders empty.

**2. Recommendations: string[] vs object[]**
The tool-executor returns recommendations as a flat **string array** (`["Expand description..."]`). But `GeoReportCard` expects objects with `{ text, priority, category }`. Result: recommendations section renders empty.

**3. Missing reportData fields**
`entityType` and `entityId` are not included in the `reportData` object passed to `richContent`.

## Fix — in `supabase/functions/chat/tool-executor.ts` (audit_geo case, ~lines 922-934)

Transform the categories object into the array format the card expects, and convert recommendations strings into objects with priority levels:

```typescript
const categoriesArray = Object.entries(categories).map(([key, val]) => ({
  name: key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
  score: val.score,
  maxScore: val.max,
  details: val.details,
}));

const recsArray = recommendations.map((text, i) => ({
  text,
  priority: i < 2 ? "high" : i < 4 ? "medium" : "low",
  category: "general",
}));

const reportData = {
  mode: "single",
  entityName,
  entityType: entity_type,
  entityId: entity_id,
  score: totalScore,
  categories: categoriesArray,
  recommendations: recsArray,
};
```

## Files to modify
1. `supabase/functions/chat/tool-executor.ts` — fix the `audit_geo` case to transform data structures

No other files need changes.

