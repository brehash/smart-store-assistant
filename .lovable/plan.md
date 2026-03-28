

## Fix Three Issues: Product Dropdown Scroll, Order Form Approval Flow, Post-Creation Message

### Issue 1: Product search dropdown not scrollable
The dropdown in `OrderFormCard.tsx` uses Radix `ScrollArea` which doesn't work properly in this absolute-positioned context. Replace it with a plain `div` with `overflow-y: auto`.

**File: `src/components/chat/OrderFormCard.tsx`**
- Remove `ScrollArea` import
- Replace `<ScrollArea className="max-h-48">` with `<div className="max-h-48 overflow-y-auto">`

### Issue 2: "Awaiting approval" gets stuck for order creation
When the AI calls `create_order`, the backend emits an `order_form` event but *also* pushes `awaiting_approval` to `aiMessages` and sets pipeline step to `needs_approval`. The AI loop then waits for an approval response that never comes (because the user interacts with the order form, not the approval card).

**Fix in `supabase/functions/chat/index.ts`** (around line 1889-1921):
- For `create_order` tool calls, after emitting the `order_form` SSE event, push a tool result to `aiMessages` that says the order form was shown and the user will complete it — NOT `awaiting_approval`. Set the pipeline step to `done` instead of `needs_approval`. Then `continue` the loop so the AI can write a closing message without waiting.

### Issue 3: Stop sending follow-up message to AI after order creation
After order creation, `handleOrderCreated` in `Index.tsx` calls `handleSend()` which sends a new user message to the AI, costing credits.

**Fix in `src/pages/Index.tsx`** (line 586):
- Remove the `handleSend(...)` call. Just update the order form's resolved state — the success card is sufficient feedback.

### Files to modify

| File | Change |
|------|--------|
| `src/components/chat/OrderFormCard.tsx` | Replace `ScrollArea` with plain scrollable `div` |
| `supabase/functions/chat/index.ts` | Don't block on approval for `create_order` — mark step done |
| `src/pages/Index.tsx` | Remove `handleSend` call in `handleOrderCreated` |

