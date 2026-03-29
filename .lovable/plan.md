

# Fix `get_product_sales_report` + add invoice breakdown table

## Problems identified

1. **Total revenue is wrong**: Line 341 computes `totalRevenue` by summing the already-sliced `products` array. If there are more products than `limit`, the grand total excludes them.
2. **Sorting**: Currently sorted by `total_revenue` descending. User wants sorting by `total_quantity` (most sold units first).
3. **Missing feature**: No invoiced vs non-invoiced quantity breakdown per product.

## Solution

### Changes in `supabase/functions/chat/tool-executor.ts` — `get_product_sales_report` case (lines 276-362)

1. **Fix total revenue**: Compute `totalRevenue` and `totalQuantity` from `productMap` values BEFORE slicing.

2. **Sort by quantity**: Change `.sort((a, b) => b.total_revenue - a.total_revenue)` → `.sort((a, b) => b.total_quantity - a.total_quantity)`.

3. **Add invoice detection per product**: While iterating orders, check each order's `meta_data` for invoice keys (reusing the same pattern from `get_orders_with_meta`: keys containing `invoice`, `factura`, `serie`, `numar`, `fiscal`, `oblio`, `wc_invoice`, `billing_invoice` — excluding `av_facturare`). Track per-product `invoiced_qty` and `not_invoiced_qty`.

4. **Return enriched data**: Each product in the response gets `invoiced_qty` and `not_invoiced_qty` fields. Add a new `invoice_summary` to the result with `total_invoiced_qty` and `total_not_invoiced_qty`.

### Pseudocode for invoice detection per order

```typescript
const INVOICE_META_KEYS = ['invoice','factura','oblio','wc_invoice','billing_invoice','serie','numar','fiscal'];

function orderHasInvoice(order: any): boolean {
  const meta = order.meta_data || [];
  return meta.some((m: any) => {
    const k = (m.key || '').toLowerCase();
    if (k === 'av_facturare') return false;
    return INVOICE_META_KEYS.some(ik => k.includes(ik)) && m.value;
  });
}
```

Then in the order loop, for each line item, increment either `invoiced_qty` or `not_invoiced_qty` based on the order's invoice status.

### Updated result shape

```typescript
{
  period, total_revenue, total_orders, product_count, 
  total_quantity,
  invoice_summary: { total_invoiced_qty, total_not_invoiced_qty },
  products: [
    { product_id, product_name, total_revenue, total_quantity, 
      invoiced_qty, not_invoiced_qty, order_count, average_price }
  ]  // sorted by total_quantity desc
}
```

Single file change: `supabase/functions/chat/tool-executor.ts`.

