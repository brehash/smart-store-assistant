

## Enable Order Meta-Data Parsing for Invoices, AWBs, and Custom Fields

### Problem
The LLM cannot search within order meta_data because:
1. `search_orders` truncates results to only `id, status, total, date_created, billing` — stripping `meta_data`, `line_items`, and all custom fields
2. There is no tool to fetch full order details (including `meta_data`) for a batch of orders
3. The system prompt has no instructions about parsing meta_data for invoices, AWBs, or similar attributes
4. `search_orders` has a `per_page` limit of 10 by default, too few for period-based analysis

### Solution

#### 1. New tool: `get_orders_with_meta`
**File: `supabase/functions/chat/index.ts`**

Add a new tool designed for meta-data analysis. It fetches orders for a date range with full `meta_data` included (unlike `search_orders` which strips it). Key parameters:
- `after`, `before` (ISO dates) — required date range
- `per_page` (default 100) — fetch in bulk for analysis
- `status` — optional filter

The tool returns orders with: `id, status, total, currency, date_created, billing, meta_data, line_items[].name`. This gives the LLM the raw data to parse and identify invoices, AWBs, tracking numbers, etc.

#### 2. Update `truncateForAI` for the new tool
Ensure `meta_data` is preserved in the AI context (not stripped). Truncate only `line_items` to name+quantity. Cap at ~30 orders in AI context but pass all to rich content.

#### 3. Update system prompt with meta-data parsing instructions
Add a section to the system prompt:

```
ORDER META-DATA ANALYSIS:
- When the user asks about invoices (facturi), AWBs, tracking numbers, or any custom order attributes:
  1. Call get_orders_with_meta for the requested period
  2. Parse the meta_data array on each order looking for keys like: _invoice, _factura, invoice_number, _awb, awb_number, tracking_number, and similar patterns
  3. Classify orders as having/not having the requested attribute
  4. Present results as a dashboard with cards (invoiced amount vs non-invoiced) and a table of matching orders
- If orders are already in context from a previous tool call, parse them directly without re-fetching
- Common meta_data keys for Romanian stores: _factura, _invoice, _awb, _tracking, factura_seria, factura_numar
```

#### 4. Add semantic plan and reasoning for the new tool
Add entries in `TOOL_LABELS`, `generateSemanticPlan`, `generateReasoningBefore`, and `generateReasoningAfter`.

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/chat/index.ts` | Add `get_orders_with_meta` tool definition, executor, truncation, semantic plan, reasoning, and system prompt instructions |

### How It Works End-to-End

User says: "arata-mi facturile din ultimele 10 zile"
1. LLM calls `get_orders_with_meta` with `after: 10 days ago, before: today`
2. Tool returns full orders with `meta_data` arrays
3. LLM parses each order's `meta_data` for invoice-related keys
4. LLM emits a dashboard with: invoiced orders table, non-invoiced orders, totals

User says: "arata-mi veniturile cu factura si fara factura in luna curenta"
1. LLM calls `get_orders_with_meta` for current month
2. LLM classifies orders by invoice presence in meta_data
3. LLM emits dashboard with: "Invoiced Revenue" card, "Non-Invoiced Revenue" card, breakdown table

