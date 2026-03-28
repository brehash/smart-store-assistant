

# Expand Intent-Based Tool Filtering

## Problem
Currently, only shipping queries get filtered tools (3 out of 22). All other queries send the full 22-tool array to the LLM, wasting ~2,000+ tokens per request on irrelevant tool definitions.

## Design

Categorize all 22 tools into 6 intent groups. Use regex to detect intent from the user's message, then send only the relevant subset. For ambiguous or multi-intent queries, union the matched groups. Fallback to full tool set if no intent matches.

```text
Intent Group        Tools                                          Regex Patterns
─────────────────── ────────────────────────────────────────────── ──────────────────────────────
SHIPPING (3)        check_shipping_status, update_order_status,    shipping|tracking|livrare|
                    search_orders                                  colet|awb|status.*comand...

ANALYTICS (5)       get_sales_report, compare_sales,               vânzări|sales|revenue|report|
                    get_product_sales, get_product_sales_report,    top.*produs|top.*client|
                    get_top_customers                               raport|cifra|analytics...

PRODUCT_MGMT (4)    search_products, get_product,                  produs|product|stoc|stock|
                    create_product, update_product, delete_product  SKU|categor...

ORDER_MGMT (5)      search_orders, create_order, update_order,     comand|order|factură|invoice|
                    delete_order, get_orders_with_meta              AWB|meta_data...

CONTENT (6)         create_page, update_page, delete_page,         page|pagină|post|blog|articol|
                    create_post, update_post, delete_post           conținut|content...

GEO (3)             audit_geo, generate_geo_content,               geo|seo|optimiz|structured.*
                    bulk_geo_audit                                  data|json-ld|faq.*schema...

UTILITY (1)         save_preference                                (always included)
```

## Rules
- **save_preference** is always included (lightweight, universally useful)
- **Multi-intent**: e.g. "top 5 produse si top 5 clienti" matches both ANALYTICS + PRODUCT_MGMT → union
- **No match**: falls back to full tool set (safe default)
- **Follow-up iterations** (hasToolResult=true): keep only tools from the matched groups (no expansion)
- Existing shipping-specific history trimming logic stays unchanged

## Changes

### `supabase/functions/chat/index.ts`

1. **Replace** the current `selectToolsForIntent` function and related constants with:
   - Intent group definitions: map of group name → Set of tool names + regex
   - New `selectToolsForIntent(msg, hasToolResult, allTools)` that:
     - Tests message against each group's regex
     - Unions matched tool name sets + always adds `save_preference`
     - If no groups matched → return all tools
     - Filters `allTools` by the computed name set

2. **Update call site** (~line 2646): Remove the `shippingQuery ?` conditional — the new function handles all intents including shipping, so it should always be called.

3. **Keep** the `isShippingIntent` function for the history-trimming logic that uses it separately.

## Token Savings Estimate
- Full tool definitions: ~2,200 tokens
- Average filtered set (5-6 tools): ~500-600 tokens
- Savings: ~1,500 tokens per request (~70%) for most queries

## Files Modified
1. `supabase/functions/chat/index.ts` — Expanded intent classification and tool filtering

