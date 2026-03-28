

## Four Improvements: Caching, Language, Payment Methods, Order Statuses

### 1. Cache Products & Payment Methods

**New DB table `woo_cache`**: stores cached WooCommerce data per user with a cache key.

```sql
CREATE TABLE public.woo_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cache_key text NOT NULL, -- 'products', 'payment_methods', 'order_statuses'
  data jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cache_key)
);
ALTER TABLE public.woo_cache ENABLE ROW LEVEL SECURITY;
-- Users can read/write their own cache
CREATE POLICY "Users manage own cache" ON public.woo_cache FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**Populate cache**:
- On Settings save / test connection: fetch products (all pages), payment gateways, order statuses → upsert into `woo_cache`
- Add a "Refresh Cache" button in Settings > Connection section
- In the chat edge function: detect "update products" / "actualizeaza produsele" intent → call woo-proxy to fetch all products and payment methods, upsert cache, respond with confirmation

**Use cache in OrderFormCard**: product search queries the cached data first (client-side filter), falling back to live API. Payment methods loaded from cache on mount.

### 2. Language Already Sent — Verify

The backend already reads `response_language` from `woo_connections` and injects it into the system prompt. This works. No change needed unless the user reports it's not working after testing.

### 3. Payment Method Select in Order Form

**File: `src/components/chat/OrderFormCard.tsx`**:
- Add `paymentMethods` prop (array of `{id, title}`)
- Add a `<Select>` between Status and Note for payment method
- Include `payment_method` and `payment_method_title` in the order body sent to woo-proxy

**File: `src/pages/Index.tsx`**:
- On mount, fetch payment methods from `woo_cache` table
- Pass them down through `ChatMessage` → `OrderFormCard`

**File: `src/components/chat/ChatMessage.tsx`**:
- Add `paymentMethods` prop, pass to `OrderFormCard`

### 4. Order Status Select — All Statuses, Selected First

**File: `src/pages/Index.tsx`**:
- On mount, fetch ALL order statuses from `woo_cache` (key: `order_statuses`) and user's selected statuses from `woo_connections.order_statuses`
- Pass both `allOrderStatuses` and `selectedStatuses` through ChatMessage → OrderFormCard

**File: `src/components/chat/OrderFormCard.tsx`**:
- Sort statuses: selected ones first, then the rest
- Show all statuses in the dropdown, with a visual separator or bold for the preferred ones

### Files to modify

| File | Change |
|------|--------|
| DB migration | Create `woo_cache` table |
| `src/pages/Settings.tsx` | Add "Refresh Cache" button, populate cache on save/test |
| `src/pages/Index.tsx` | Fetch cached payment methods + order statuses on mount, pass as props |
| `src/components/chat/ChatMessage.tsx` | Add `paymentMethods` prop, forward to OrderFormCard |
| `src/components/chat/OrderFormCard.tsx` | Add payment method select, sort order statuses |
| `supabase/functions/chat/index.ts` | Add "update cache" intent detection |

