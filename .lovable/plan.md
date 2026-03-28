

## Fix Order Form: Missing Statuses & Cached Products

### Issues
1. **All order statuses not showing** — The `cachedAllStatuses` data is loaded from `woo_cache` but may be empty if the user hasn't refreshed cache recently, or the data format doesn't match. Need to verify it's being passed correctly and add a fallback.
2. **Cached products not used** — Products are saved to `woo_cache` with key `"products"` in Settings, but `Index.tsx` never loads them. The OrderFormCard always does a live API search instead of searching cached products first.

### Changes

**1. `src/pages/Index.tsx`** — Load cached products from `woo_cache`

- Add `cachedProducts` state alongside the existing cached data
- In the `woo_cache` fetch block, also extract `cache_key === "products"` 
- Pass `cachedProducts` down through `ChatMessage` to `OrderFormCard`

**2. `src/components/chat/ChatMessage.tsx`** — Pass `cachedProducts` prop through to `OrderFormCard`

**3. `src/components/chat/OrderFormCard.tsx`** — Use cached products for search

- Accept a new `cachedProducts` prop
- In the search handler, first filter cached products locally (by name/SKU) before falling back to the live API call
- Show cached results instantly, then optionally supplement with live results if needed
- This makes the product picker work offline/faster and uses the cached data

**4. Verify status data** — Ensure `allOrderStatuses` from cache is actually populated. If the cache row exists but is empty, the fallback hardcoded list (`pending`, `processing`, `on-hold`, `completed`) kicks in. The fix ensures the statuses dropdown always works by also loading from the connection's `order_statuses` field as a secondary source.

### Files
1. `src/pages/Index.tsx` — load cached products
2. `src/components/chat/ChatMessage.tsx` — pass cachedProducts prop
3. `src/components/chat/OrderFormCard.tsx` — search cached products first, fall back to API

