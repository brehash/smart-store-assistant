

## Add Streaming Reasoning Bubbles to Chat

### What it does
When the AI processes a request, small italic thought bubbles appear in real-time above the pipeline, showing what the AI is "thinking" (e.g., "Looking for products matching 'pasta bourbon'...", "Found 3 results, checking stock levels...", "Sales velocity is 1.6/day, calculating stockout..."). These fade/collapse into a summary once the response is complete.

### Architecture

**Backend** — emit a new SSE event type `reasoning` from the edge function at key decision points:

```text
data: {"type":"reasoning","text":"Searching for 'pasta bourbon' in product catalog..."}
data: {"type":"reasoning","text":"Found product #245 with stock_quantity: 39"}
data: {"type":"reasoning","text":"Fetching 60-day order history to calculate burn rate..."}
data: {"type":"reasoning","text":"47 units sold in 58 days → burn rate ~0.81/day → ~48 days of stock left"}
```

Reasoning events are emitted:
- Before each tool call (intent-based, e.g., "Searching for..." / "Fetching orders...")
- After each tool result (data-based, e.g., "Found X products" / "Total units sold: 47")
- During synthesis (e.g., "Calculating burn rate..." / "Building dashboard...")

**Frontend** — new `ReasoningBubbles` component:

```text
┌─────────────────────────────────────┐
│ 💭 Searching for 'pasta bourbon'... │  ← streaming, italic, muted
│ 💭 Found product #245, stock: 39    │  ← appears with fade-in
│ 💭 Fetching 60-day sales history... │  ← appears with fade-in
│ ● Calculating burn rate...          │  ← latest thought pulses
├─────────────────────────────────────┤
│ ✓ Understanding request             │  ← existing pipeline below
│ ✓ Searching product catalog         │
│ ● Analyzing sales velocity          │
│ ○ Building inventory report         │
└─────────────────────────────────────┘
```

When streaming completes, the reasoning bubbles collapse into a single clickable line: "Thought for X seconds" → click to expand full reasoning trail.

### Files to modify

| File | Changes |
|------|---------|
| `supabase/functions/chat/index.ts` | Emit `reasoning` SSE events before/after tool calls and during synthesis |
| `src/lib/chat-stream.ts` | Add `reasoning` to `PipelineEvent` type, forward to handler |
| `src/components/chat/ReasoningBubbles.tsx` | **New** — renders streaming thought bubbles with fade-in, collapses when done |
| `src/components/chat/ChatMessage.tsx` | Add `reasoningLogs` prop, render `ReasoningBubbles` above pipeline |
| `src/pages/Index.tsx` | Track reasoning events in message state, pass to ChatMessage |

### Reasoning event generation logic (edge function)

Before each tool call:
- `search_products` → "Looking up products matching '{args.search}'..."
- `get_product_sales` → "Fetching sales history for product #{id} over last {days} days..."
- `get_sales_report` → "Pulling orders from {date_min} to {date_max}..."
- `compare_sales` → "Comparing {label_a} vs {label_b}..."

After each tool result (parse the result to generate insight):
- Products → "Found {count} products. {name} has {stock_quantity} in stock."
- Product sales → "{total_units} units sold over {days} days. Burn rate: {rate}/day."
- Sales report → "{orderCount} orders, {totalRevenue} lei total revenue."

During synthesis:
- "Calculating days of stock remaining..."
- "Building visual dashboard with insights..."

### ReasoningBubbles component design

- Each thought: `text-xs italic text-muted-foreground` with `animate-fade-in`
- Latest thought has a pulsing dot indicator
- On completion: all thoughts collapse into "Thought for Xs" with Collapsible expand
- Max visible thoughts while streaming: last 4 (older ones fade out)

### Data flow

```text
Edge fn → SSE {type:"reasoning", text:"..."} 
       → chat-stream.ts onPipelineEvent 
       → Index.tsx reasoningLogs[] 
       → ChatMessage → ReasoningBubbles (above PipelinePlan)
```

