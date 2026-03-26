

# Pipeline UI Overhaul, Debug URIs, and Structured LLM Responses

## Overview

Four changes: restyle the pipeline to match the screenshot, add WooCommerce request URIs to the debug panel, instruct the LLM to return structured dashboard JSON for reports, and instruct it to return structured product JSON for sliders.

## Changes

### 1. Pipeline UI — Match Screenshot Style (`src/components/chat/PipelineStep.tsx`, `src/components/chat/PipelinePlan.tsx`)

Restyle to match the screenshot: a card with a subtle border, each step as a row with a spinner (running) or circle (pending) on the left, step title text, and the whole thing in a compact vertical list. Remove the vertical connecting line approach and use a simpler list layout. Running steps show a spinning indicator, done steps show a checkmark, pending steps show an empty circle.

### 2. Debug Panel — Show WooCommerce Request URI

**Edge function** (`supabase/functions/chat/index.ts`): In each `executeTool`, capture the full WooCommerce REST API endpoint string (e.g., `products?search=pasta&per_page=10`) and include it in the `debug_api` SSE event as `requestUri`.

**`woo-proxy`**: Return the constructed `wooUrl` (with credentials stripped) in the response so the chat function can capture it. Alternatively, reconstruct the URI in the chat function from the endpoint string — simpler approach: just include the `endpoint` value passed to `callWooProxy` in the debug event.

**`DebugPanel.tsx`**: Show a "Request URI" field displaying the WooCommerce REST endpoint path (e.g., `GET /wp-json/wc/v3/products?search=pasta&per_page=10`).

Update `DebugEntry` interface to include `requestUri?: string`.

### 3. System Prompt — Structured Dashboard JSON for Reports

Add instructions to the system prompt telling the LLM that after calling `get_sales_report` or `compare_sales`, it must include a structured JSON block in its response using a specific format. The frontend will parse this and render dashboard components.

The instruction will tell the LLM to wrap structured output in a ` ```dashboard ... ``` ` code block with this schema:

```text
{
  "cards": [{ "label": "Total Revenue", "value": "1,234 lei", "change": "+12%" }],
  "charts": [{ "type": "bar", "title": "...", "data": [...] }],
  "tables": [{ "title": "Top Products", "columns": [...], "rows": [...] }],
  "lists": [{ "title": "...", "items": [...], "collapsible": true }]
}
```

**Edge function**: After the AI responds, parse any ` ```dashboard ``` ` block from the content, emit it as a `rich_content` event with `type: "dashboard"`, and strip it from the text content.

**Frontend**: Create a new `DashboardView` component that renders the structured dashboard (stat cards, charts, tables, lists). Register it in `ChatMessage` for `richContent.type === "dashboard"`.

### 4. System Prompt — Structured Product JSON for Sliders

Add instructions to the system prompt telling the LLM that when presenting products, it should NOT describe them in text but instead rely on the `rich_content` SSE event that is already emitted by the `search_products` and `get_product` tools. The LLM should provide a brief text summary only.

The `rich_content` event for products already sends the full WooCommerce product objects (with `images`, `name`, `price`, etc.), so the `ProductSlider` already works — the issue is the LLM sometimes dumps product details as text. The system prompt update will say: "When products are found, do NOT list product details in text — they are displayed as interactive cards automatically. Just provide a brief summary like 'Found X products matching your search.'"

### 5. New Component: `DashboardView.tsx`

Renders a structured dashboard inside the chat:
- **Stat cards**: Row of cards with label, value, optional change percentage (green/red)
- **Charts**: Reuses existing `ChatChart` component
- **Tables**: Simple table with headers and rows
- **Lists**: Collapsible lists with titles and items

### Files Modified
- `supabase/functions/chat/index.ts` — system prompt updates, dashboard parsing, requestUri in debug events
- `src/components/chat/PipelineStep.tsx` — restyle to match screenshot
- `src/components/chat/PipelinePlan.tsx` — restyle container
- `src/components/chat/DebugPanel.tsx` — show request URI
- `src/components/chat/ChatMessage.tsx` — add DashboardView rendering
- `src/components/chat/DashboardView.tsx` — new component
- `src/lib/chat-stream.ts` — add requestUri to PipelineEvent

