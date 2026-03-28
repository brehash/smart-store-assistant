

## Tiered Credit System Implementation

### How Credits Will Work

- **Simple text reply** (no tool calls): **1 credit**
- **Read tool calls** (search_products, search_orders, etc.): **2 credits**
- **Write tool calls** (create/update/delete orders, products, etc.): **3 credits**
- Users get a monthly auto-refill (configurable per user) + admins can manually adjust
- When balance hits 0, the user is blocked with a friendly message

### Database Changes (Migration)

**New table: `credit_balances`** — stores current credit balance per user
- `user_id`, `balance` (integer), `monthly_allowance` (default 100), `last_refill_at`

**New table: `credit_transactions`** — audit log of every credit change
- `user_id`, `amount` (positive = grant, negative = debit), `balance_after`, `reason` (e.g. "message", "admin_grant", "monthly_refill"), `message_id` (nullable), `created_at`

**New database function: `refill_credits_if_due`** — called before each message; if 30+ days since last refill, reset balance to monthly_allowance

### Backend Changes (`supabase/functions/chat/index.ts`)

1. Before processing a message, check the user's credit balance (refill if due)
2. After the AI response completes and we know which tools were called, calculate the credit cost:
   - No tool calls → 1 credit
   - Any read-only tool → 2 credits
   - Any write tool → 3 credits (highest tier wins)
3. Deduct credits and insert a transaction record
4. Emit a new SSE event `credit_usage: { cost, remaining_balance }` so the frontend can display it
5. If balance is insufficient before processing, return an error SSE: "You've run out of credits. Contact your administrator."

### Admin Edge Function (`supabase/functions/admin/index.ts`)

Add new routes:
- `GET /users/:id/credits` — get balance + recent transactions
- `PUT /users/:id/credits` — admin grants/deducts credits (with reason)
- `PUT /users/:id/allowance` — set monthly allowance

### Frontend Changes

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Handle `credit_usage` SSE event, display remaining credits |
| `src/lib/chat-stream.ts` | Parse `credit_usage` event |
| `src/components/chat/ChatMessage.tsx` | Show credit cost alongside token count (e.g. "2 credits · 1,243 tokens") |
| `src/components/admin/UserDetail.tsx` | Add credit balance display, grant/deduct form, transaction history |
| UI header/sidebar | Show current user's credit balance |

### Files to Modify/Create

| File | Action |
|------|--------|
| DB migration | Create `credit_balances`, `credit_transactions` tables with RLS |
| `supabase/functions/chat/index.ts` | Add credit check, calculation, deduction, SSE event |
| `supabase/functions/admin/index.ts` | Add credit management routes |
| `src/lib/chat-stream.ts` | Handle `credit_usage` event |
| `src/pages/Index.tsx` | Store and display credit info |
| `src/components/chat/ChatMessage.tsx` | Show credit cost per message |
| `src/components/admin/UserDetail.tsx` | Credit management UI for admins |

