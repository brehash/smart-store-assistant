

# GEO (Generative Engine Optimization) Feature Implementation

## Overview
Add three new AI tools (`audit_geo`, `generate_geo_content`, `bulk_geo_audit`) to the chat edge function, extend existing update tools with `meta_data`/`meta` support, and create a `GeoReportCard` UI component for rendering audit results.

## Changes

### 1. Edge Function — New GEO Tools (`supabase/functions/chat/index.ts`)

**Add 3 new tool definitions to the `TOOLS` array:**

- **`audit_geo`** — Accepts `product_id` or `page_id` + `type` (product/page/post). Fetches the entity via existing `callWooProxy`, then builds a GEO readiness prompt and sends it to the AI gateway for analysis. Returns a scored report (0-100) with category breakdowns: content length, heading structure, FAQ presence, structured data, meta description quality. Result emitted as `geo_report` rich content.

- **`generate_geo_content`** — Accepts `product_id` or `page_id` + `type` + `active_plugins` (from connection data). Fetches current content, sends to AI with a GEO optimization prompt. Returns: optimized description HTML (with inline FAQ as `<details>/<summary>` tags), JSON-LD FAQ schema (appended as `<script>` tag in description), and SEO meta description. If Yoast/RankMath detected in plugins, also returns appropriate meta keys. Result shown via approval card so user reviews before applying.

- **`bulk_geo_audit`** — Accepts `product_ids` array (or "all" to use cached products). Runs a lightweight version of audit_geo on each, returns a summary table sorted by priority (lowest score first). Result emitted as `geo_report` rich content with a table view.

**Add GEO intent regex** for token optimization (like shipping intent):
```
/(geo|seo.*ai|optimiz.*ai|optimize.*search|ai.*search|generative.*engine|structured.*data|faq.*schema|json-ld)/i
```

**Extend `update_product` tool schema** — Add `meta_data` parameter:
```typescript
meta_data: { type: "array", items: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } } } }
```
The handler already uses `const { product_id, ...rest } = args` and spreads `rest` to the API, so `meta_data` will be forwarded automatically.

**Extend `update_page` and `update_post` tool schemas** — Add `meta` parameter:
```typescript
meta: { type: "object", description: "Custom meta fields (key-value pairs)" }
```
Same `...rest` spread pattern already handles forwarding.

**Update supporting maps**: Add entries to `TOOL_LABELS`, `WRITE_TOOLS` (for `generate_geo_content` since it modifies content), `generateReasoningBefore`, `generateReasoningAfter`, `generateSemanticPlan`, and `truncateForAI`.

**Add GEO instructions to system prompt** explaining when/how to use the GEO tools and the plugin-aware injection strategy.

**`audit_geo` handler logic (inside `executeTool`)**:
1. Fetch product/page via `callWooProxy`
2. Extract: description, short_description, name/title, meta_data
3. Build analysis prompt asking AI to score 0-100 across categories
4. Call AI gateway (non-streaming) with structured output via tool calling
5. Return as `{ type: "geo_report", data: { score, categories, recommendations, entity } }`

**`generate_geo_content` handler logic**:
1. Fetch product/page current content
2. Load `active_plugins` from `woo_connections` table
3. Build optimization prompt with plugin-awareness rules
4. Call AI gateway to generate optimized content
5. Return optimized content + approval card for user review
6. On approval, call `update_product`/`update_page` with new description + meta_data/meta

### 2. New UI Component — `src/components/chat/GeoReportCard.tsx`

A card component that renders GEO audit results:
- **Header**: Entity name + overall score (circular progress, color-coded: red <40, yellow 40-70, green >70)
- **Category breakdown**: Mini progress bars for each category (Content, Structure, Schema, Meta, FAQs)
- **Recommendations list**: Actionable items with priority badges
- **Bulk mode**: Table view with entity name, score, top issue columns
- Uses existing `Card`, `Progress`, `Badge` components from the UI library

### 3. ChatMessage Updates — `src/components/chat/ChatMessage.tsx`

- Add `"geo_report"` to the `RichContent` type union
- Import and render `GeoReportCard` when `rc.type === "geo_report"`
- Style container with `max-w-3xl` for geo reports

### 4. Stream Parser — `src/lib/chat-stream.ts`

No changes needed — the existing `rich_content` handler already forwards any `contentType` + `data` generically.

## Files Modified
1. `supabase/functions/chat/index.ts` — GEO tools + meta_data support in update schemas + system prompt
2. `src/components/chat/GeoReportCard.tsx` — New component
3. `src/components/chat/ChatMessage.tsx` — Render geo_report type

## How It Works (User Flow)
```text
User: "audit GEO for product 42"
  → AI calls audit_geo(product_id: 42, type: "product")
  → Fetches product → AI analyzes → Returns scored report
  → GeoReportCard renders with score + recommendations

User: "optimize product 42 for AI search"
  → AI calls generate_geo_content(product_id: 42, type: "product")
  → Generates optimized description + FAQ schema + meta
  → Shows approval card with summary
  → User approves → calls update_product with description + meta_data

User: "audit GEO for all products"
  → AI calls bulk_geo_audit with cached product IDs
  → Returns table of scores sorted by priority
  → GeoReportCard renders in table/bulk mode
```

