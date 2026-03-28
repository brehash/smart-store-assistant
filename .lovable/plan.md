

## Fix Two Issues: Webhook Toast "unknown" + Order Form Not Showing

### Issue 1: Toast shows "Webhook Event — unknown"

**Root cause**: When WooCommerce registers a webhook, it sends an initial **ping** request to verify the delivery URL. This ping either has no `x-wc-webhook-topic` header or sends a non-standard topic. The `webhook-receiver` edge function defaults to `"unknown"`, which gets stored in the database and triggers the realtime toast with no useful info.

**Fix**:
- In `supabase/functions/webhook-receiver/index.ts`: detect ping events (topic is `"unknown"` or body contains `webhook_id` with no order/customer data) and either skip inserting to `webhook_events`, or set topic to `"action.wc_webhook_ping"` so the frontend can ignore it.
- In `src/pages/Index.tsx` realtime handler: ignore events where topic starts with `"action."` or equals `"unknown"` — don't show a toast for pings.

### Issue 2: Order form never renders — AI searches products instead of calling `create_order`

**Root cause**: The AI model interprets "creaza o comanda" as needing to search products first. It never calls `create_order`, so the `order_form` SSE event never fires. The form only appears if the AI explicitly calls the `create_order` tool.

**Fix**: Detect order-creation intent on the backend **before** the AI loop starts. If the user's last message matches order-creation patterns (e.g., "creaza o comanda", "create an order", "place an order", "fă o comandă"), immediately emit an `order_form` SSE event and include a short AI response telling the user to fill in the form. Skip the normal AI tool loop for this case.

**Changes in `supabase/functions/chat/index.ts`**:
- Add an intent detection function with regex patterns for order creation in multiple languages (Romanian + English).
- Before the AI loop (`while (maxIterations-- > 0)`), check if the last user message matches. If yes:
  - Emit `pipeline_plan` + `pipeline_step` (done)
  - Emit `order_form` event with empty prefill
  - Emit text delta: "Fill in the order form below"
  - Emit `pipeline_complete`
  - Close stream — skip the AI call entirely

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/webhook-receiver/index.ts` | Skip DB insert for ping/unknown topic events |
| `src/pages/Index.tsx` | Ignore `unknown` topic in realtime toast handler |
| `supabase/functions/chat/index.ts` | Add order-creation intent detection before AI loop, emit `order_form` directly |

