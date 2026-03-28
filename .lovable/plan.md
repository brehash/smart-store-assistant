

## Interactive Order Creation Form in Chat

### Problem
1. When the user asks to create an order, the AI should show an interactive form instead of raw JSON approval cards
2. The approval card system for write operations (including `create_order`) never renders — likely because the AI model doesn't reliably call the `create_order` tool when asked in natural language, or there's a timing issue with the SSE stream

### Solution
Instead of relying on the AI to call `create_order` as a tool and then showing an approval card, we intercept the intent on the backend and emit an `order_form` SSE event. The frontend renders a rich interactive form with searchable products, quantity controls, customer fields, and a submit button. On submit, the form calls `woo-proxy` directly to create the order.

### Changes

#### 1. New Component: `src/components/chat/OrderFormCard.tsx`
- **Product search**: Debounced text input that calls `woo-proxy` with `endpoint: "products?search=..."` to autocomplete products. Shows results in a dropdown with name, SKU, price.
- **Line items table**: Selected products with quantity +/- controls, price display, remove button, running total
- **Customer fields**: First name, last name, email, phone, billing address (collapsible)
- **Order status**: Dropdown populated from the user's configured `order_statuses`
- **Order notes**: Optional text field
- **Submit button**: Calls `woo-proxy` with `endpoint: "orders", method: "POST", body: {...}` directly using the auth token. Shows success (order number + link) or error state
- **Resolved state**: After submission, collapses into a summary showing order number, items, and total

#### 2. Backend: `supabase/functions/chat/index.ts`
- In the write-tools approval check (line 1860), when `toolName === "create_order"`, emit `type: "order_form"` event instead of `approval_request`:
  ```
  sendSSE({ type: "order_form", toolCallId: tc.id, stepIndex, prefill: args })
  ```
- The `prefill` includes any data the AI extracted (product IDs, customer info) so the form can pre-populate
- Keep the existing approval flow for all other write tools (`update_order`, `delete_order`, etc.)
- Also fix the general approval flow: ensure `approval_request` events are emitted and the stream doesn't terminate prematurely before the frontend processes them

#### 3. Stream Parser: `src/lib/chat-stream.ts`
- Add `"order_form"` to the recognized `PipelineEvent` types (line 49-57)
- Add `prefill` field to `PipelineEvent` interface

#### 4. Chat Message: `src/components/chat/ChatMessage.tsx`
- Add `orderForms` to the `ChatMessageProps` interface
- Render `OrderFormCard` components (similar to how `ApprovalCard` is rendered)
- Add `onOrderCreated` callback prop

#### 5. Message State: `src/pages/Index.tsx`
- Add `orderForms` to `Message` interface
- Handle `order_form` pipeline events — store in message state
- When form is submitted successfully, append a user message with the result so the AI can respond with confirmation
- Persist `orderForms` in message metadata (like approvals)

#### 6. Fix Approval Card Rendering (for non-order write tools)
- Debug and fix why `approval_request` events don't result in visible cards. Root cause investigation:
  - Verify the SSE event is actually emitted by adding a console.log in the backend
  - Ensure the frontend `approval_request` handler in `onPipelineEvent` runs (the code at line 276-289 looks correct)
  - Check if there's a race condition where `pipeline_complete` fires and overwrites the approval state

### Files to Create/Modify

| File | Change |
|------|--------|
| `src/components/chat/OrderFormCard.tsx` | **Create** — Interactive order form with product search, line items, customer fields |
| `supabase/functions/chat/index.ts` | Emit `order_form` event for `create_order` instead of `approval_request` |
| `src/lib/chat-stream.ts` | Add `order_form` to recognized event types |
| `src/components/chat/ChatMessage.tsx` | Render `OrderFormCard`, add interface fields |
| `src/pages/Index.tsx` | Handle `order_form` events, persist state, handle form submission callback |

