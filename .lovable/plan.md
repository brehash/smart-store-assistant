

# Optimize Tool Results for AI — Strip Unnecessary Data

## Problem
Most tools in `tool-executor.ts` return **raw WooCommerce/WordPress API responses** directly as `result`. These full objects contain massive amounts of irrelevant data (images arrays, HTML descriptions, `_links`, `meta_data`, `related_ids`, rendered content, etc.) that get sent to the AI as tool results, wasting tokens and slowing responses.

The existing `truncateForAI` in `utils.ts` only kicks in when results exceed 3000 chars, and even then only handles a few tools. Many tools have no stripping at all.

## Analysis — What's bloated

| Tool | Issue | Estimated waste |
|------|-------|----------------|
| `search_products` | Full product objects: images[], description HTML, meta_data[], _links, related_ids, tags, attributes | ~80% of payload |
| `get_product` | Same as above for single product | ~70% |
| `search_orders` | Full order objects: line_items with full product data, meta_data[], _links, payment details, fee_lines, tax_lines, shipping_lines, refunds | ~75% |
| `create_order` / `update_order` / `update_order_status` | Returns full updated order object back to AI | ~90% unnecessary |
| `delete_order` / `delete_product` | Returns full deleted object | ~95% unnecessary |
| `create_product` / `update_product` | Returns full product object | ~80% unnecessary |
| `create_page/post`, `update_page/post`, `delete_page/post` | Returns full WP object with rendered HTML content | ~85% unnecessary |
| `check_shipping_status` | Already handled well in truncateForAI |  |

## Solution — Add `stripResultForAI` in `utils.ts`

Create a new function that **proactively strips** tool results to only AI-relevant fields, applied in `tool-executor.ts` on the `result` property before it's returned. The `richContent` remains untouched (UI needs full data).

### File: `supabase/functions/chat/utils.ts`
Add `stripResultForAI(toolName, data)` function with per-tool field whitelists:

**Products** → keep: `id, name, sku, price, regular_price, sale_price, stock_quantity, stock_status, status, total_sales, categories[].name, short_description (first 200 chars)`

**Orders** → keep: `id, number, status, total, currency, date_created, billing.{first_name, last_name, email, phone}, shipping.{city, state, country}, line_items[].{name, quantity, total, product_id}, payment_method_title`

**CRUD write results** → return only confirmation: `{id, status, name/number, message: "success"}`

**Pages/Posts** → keep: `id, title (rendered), status, link, slug`

### File: `supabase/functions/chat/tool-executor.ts`
Wrap each tool's `result` through the strip function. The `richContent.data` stays full for UI rendering.

### File: `supabase/functions/chat/utils.ts` — `truncateForAI`
Update existing truncation to work with already-stripped data (mostly simplifying it since data will be pre-stripped).

## Estimated impact
- **50-70% token reduction** on tool-heavy conversations
- Faster AI response times (less input to process)
- `richContent` unaffected — UI still gets full data for tables, sliders, charts

## Files to modify
1. `supabase/functions/chat/utils.ts` — add `stripResultForAI` function
2. `supabase/functions/chat/tool-executor.ts` — apply stripping to `result` in each tool case

