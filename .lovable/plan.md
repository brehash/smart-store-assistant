

## Fix Pipeline Steps, Meta Filtering, and Invoice Link Rendering

### Issues Identified

1. **Pipeline steps not completing (root cause found)**: After the tool execution phase marks "Parsing metadata" and "Building dashboard" as done at stepIndex 2 and 3, the post-response loop at line 1989 re-processes ALL semanticSteps and sends these same titles again at NEW stepIndex values (4, 5). The frontend creates ghost entries at those indices while the original plan entries (indices 2 and 3) remain "pending". The while loop at line 1954 does correctly auto-advance these steps during tool processing, but the post-response loop duplicates them.

2. **Meta-data still includes irrelevant fields**: The cleaned order object at line 1344 still includes `email` and `company` in billing. The `line_items` still include `total`. These waste tokens. The user wants only: `first_name`, `last_name`, `amount`, `status`, `order_id`, and invoice-related meta.

3. **Invoice detection too narrow**: The system prompt references Oblio-specific keys. Not all WooCommerce stores use Oblio. The detection should be generic — any meta key matching invoice/factura patterns with a non-empty value.

4. **No invoice links rendered**: The LLM is told to include URLs as cell values, but `DashboardView.tsx` already supports this. The issue is likely that the system prompt needs stronger guidance to emit `{text, url}` cell objects in dashboard tables, and the LLM needs to see URL values in the meta_data (currently they may be filtered out if the key doesn't match RELEVANT_META_KEYS).

---

### Changes

#### File: `supabase/functions/chat/index.ts`

**A. Fix pipeline step duplication (the actual bug)**

In the post-response loop (line 1989), track which stepIndex values have already been sent as "done" during the tool execution phase. Skip any semantic step whose title was already completed. Simplest fix: after the for-of tool calls loop, record `stepIndex` as `toolPhaseEndIndex`. In the post-response loop, only process steps that haven't been advanced yet (i.e., steps whose position in the semantic array is >= the number already processed).

Concrete approach: replace the post-response loop with one that only marks steps still pending. Since the while loop at 1954 already advances intermediate steps and increments both `stepIndex` and `semanticIdx`, track `semanticIdx` at the outer scope (move from line 1799 to line 1721 area) so the post-response loop knows where the tool phase left off. Then in the post-response block, only iterate from that saved index.

**B. Strip irrelevant billing fields from cleaned orders**

Change line 1338-1349 to only include:
```
{ id, status, total, currency, date_created, 
  billing: { first_name, last_name },
  meta_data: filteredMeta }
```
Remove `email`, `company`, `line_items` from the cleaned output to reduce tokens further.

**C. Broaden invoice detection in system prompt**

Replace the Oblio-specific guidance with generic rules:
- Any meta key containing `invoice`, `factura`, `serie`, `numar`, `fiscal` with a non-empty value = has invoice
- `av_facturare` is still NOT an invoice (billing preference only)
- If a meta value is a URL, instruct the LLM to emit it as `{"text": "View Invoice", "url": "..."}` cell object in dashboard tables — this is what `DashboardView` already renders with the ExternalLink icon

**D. Add URL-containing meta keys to RELEVANT_META_KEYS**

Add patterns that catch link/url-type keys: `link`, `url`, `pdf`, `download` so that invoice download URLs aren't filtered out before the LLM sees them.

#### File: `src/components/chat/DashboardView.tsx`

No changes needed — the `CellRenderer` already handles `CellWithUrl` objects and plain URL strings correctly. The fix is on the backend (making sure URL values reach the LLM and the system prompt tells it to use the `{text, url}` format).

---

### Summary of File Changes

| File | Changes |
|------|---------|
| `supabase/functions/chat/index.ts` | Move `semanticIdx` to outer scope; skip already-done steps in post-response loop; strip billing to first/last name only; remove line_items; add `link`/`url`/`pdf` to RELEVANT_META_KEYS; update system prompt for generic invoice detection and `{text, url}` cell format |

