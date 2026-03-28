

## Fix: Pipeline Steps, Invoice Detection, External Links, Token Optimization

### Issues

1. **Pipeline steps not completing** -- Steps like "Parsing metadata", "Building dashboard", "Writing explanation" stay pending because the post-tool synthesis code (line ~1964-1985) only checks for exact title matches. When `get_orders_with_meta` is used, its semantic plan has 3 steps: "Fetching orders with metadata", "Parsing metadata", "Building dashboard". The tool execution only marks step 1 ("Fetching orders with metadata") as done. The post-tool loop at line 1934-1959 skips "Parsing metadata" and "Building dashboard" because they match the break conditions (`ss.title.startsWith("Fetching")` breaks). Then the post-response loop at line 1964-1985 does match "Parsing metadata" and "Building dashboard" but uses `stepIndex` tracking that can skip them if already iterated past.

2. **Orders listed without invoices** -- The LLM is told to look for invoice meta_data keys, but the actual data shows invoices come from Oblio plugin with keys like `_oblio_invoice_*` or similar. The LLM is classifying all orders as having invoices when `av_facturare` exists (billing type info, not an actual invoice). The system prompt needs to clarify what constitutes an actual invoice vs. billing preferences.

3. **External link icons** -- When meta_data contains URLs (e.g., Oblio invoice links, tracking URLs), the dashboard table should show clickable external link icons.

4. **Token usage too high** -- `get_orders_with_meta` returns ALL meta_data keys per order (attribution, billing addresses, etc.), most of which are irrelevant. We should filter meta_data to only invoice/AWB/tracking-related keys before sending to AI context.

---

### Changes

#### 1. Fix pipeline step completion
**File: `supabase/functions/chat/index.ts`** (lines ~1934-1985)

The intermediate step auto-advancement loop (line 1934) breaks on `ss.title.startsWith("Fetching")`, which prevents "Parsing metadata" from being auto-advanced during tool execution. Fix the break conditions to also not break on post-processing steps like "Parsing metadata", "Calculating burn rate", "Aggregating by product".

More importantly, the post-response synthesis loop (line 1964-1985) checks step titles but tracks them by array index, not by whether they were already marked done. Fix: track which semantic step indices have already been completed, and in the post-response loop, only process steps that are still pending.

#### 2. Filter meta_data to reduce tokens
**File: `supabase/functions/chat/index.ts`** -- in the `get_orders_with_meta` executor (line ~1308)

Before returning, filter each order's `meta_data` to only keep relevant keys:
```
const RELEVANT_META_PREFIXES = [
  'invoice', 'factura', 'facturi', 'oblio', 'awb', 'tracking', 'colet', 
  'curier', 'fan_courier', 'sameday', 'cargus', 'dpd', 'gls',
  'av_facturare', 'av_invoice', 'wc_invoice', 'billing_invoice'
];
```
Strip out `_wc_order_attribution_*`, `_meta_event_id`, `_billing_city_state`, `_billing_street`, `_shipping_*`, `is_vat_exempt`, `_coleteonline_*`, `_automatewoo_*`, `_gla_*`, `_googlesitekit_*`, `_meta_purchase_*`, and other irrelevant keys. This should reduce token count by ~70-80%.

Also update `truncateForAI` for `get_orders_with_meta` to cap at 30 orders and strip already-filtered meta.

#### 3. Improve invoice detection in system prompt
**File: `supabase/functions/chat/index.ts`** -- system prompt section

Clarify in the ORDER META-DATA ANALYSIS section:
- `av_facturare` is NOT an invoice -- it's billing type preference (pers-fiz/pers-jur). Do NOT treat it as having an invoice.
- An actual invoice is indicated by keys containing: `oblio`, `invoice_number`, `invoice_series`, `factura_seria`, `factura_numar`, `wc_invoice_number`, or meta values that contain invoice serial numbers (e.g., "KSF 0817").
- AWB/tracking is indicated by keys containing: `awb`, `tracking`, `fan_courier`, `sameday`, `cargus`, `coleteonline_awb`.

#### 4. Add external link icons in dashboard tables
**File: `src/components/chat/DashboardView.tsx`**

In the table cell renderer (line ~87-89), detect if a cell value looks like a URL (starts with `http://` or `https://`), and render it as an external link icon (`ExternalLink` from lucide-react) that opens in a new tab. Also detect if the cell value matches a pattern like "KSF 0817" (invoice number) -- these could have associated URLs if the LLM includes them.

Update the dashboard table schema to support cell objects: `{ text: string, url?: string }` in addition to plain strings. The LLM can then emit cells with URLs when it finds them in meta_data.

---

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/chat/index.ts` | Filter meta_data keys, fix pipeline step completion, improve system prompt |
| `src/components/chat/DashboardView.tsx` | Add external link icon rendering for URL cells |

