

## Simplify Shipping Timeline & Remove Text History

### Problem
1. The AI outputs a full text-based shipping history in addition to the visual timeline — redundant
2. The visual timeline shows all events (including repeated "In depozit" entries) — should show only key milestones

### Changes

**1. `src/components/chat/ShippingTimeline.tsx`** — Filter history to key milestones only

Before rendering, filter the history array to show only these milestone events:
- "Comanda trimisa la curier" (code ~20050 or by name match)
- "Iesire din depozit" (only the first/latest occurrence)
- "In livrare la curier" (transit)
- "Colet livrat" (delivered, code 20800)
- COD status (code 30500)

Strategy: Define a set of milestone status codes/names. Filter the reversed history to keep only matching events, and deduplicate "Iesire din depozit" to show only one.

```typescript
const MILESTONE_NAMES = [
  "Comandă trimisă la curier",
  "Comanda trimisa la curier",
  "Iesire din depozit",
  "Ieșire din depozit",
  "In livrare la curier",
  "În livrare la curier",
  "Colet livrat",
];
const MILESTONE_CODES = [20800, 30500]; // delivered + COD delivered

// Filter + deduplicate
const milestones = history.filter(e => 
  MILESTONE_CODES.includes(e.code) || 
  MILESTONE_NAMES.some(n => e.name.toLowerCase().includes(n.toLowerCase()))
);
// Deduplicate "Iesire din depozit" — keep only first (newest) occurrence
const seen = new Set<string>();
const filtered = milestones.filter(e => {
  const key = e.name.toLowerCase().includes("iesire") || e.name.toLowerCase().includes("ieșire") ? "iesire" : e.name;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
```

Then render `filtered` instead of `history`.

**2. `supabase/functions/chat/index.ts`** — Remove text history from AI prompt

Update the system prompt line 1908 to tell the AI NOT to list the text history since the visual timeline handles it:
```
- Do NOT list the tracking history as text. The visual shipping timeline component shows the history automatically. Just provide a brief summary (status, courier, AWB).
```

Also update the `generateShortSummary` for `check_shipping_status` (line 845-848) to keep it minimal — no history text, just status.

### Files
1. `src/components/chat/ShippingTimeline.tsx` — filter to milestones only
2. `supabase/functions/chat/index.ts` — instruct AI to skip text history

