

## Onboarding Flow + Webhook Setup

### Overview
Two features: (1) When a user has no WooCommerce connection, show an interactive setup wizard in the chat area instead of the empty state. (2) After a successful connection, prompt the user to create WooCommerce webhooks for real-time notifications (new order, customer created), and show toast notifications when webhook events arrive.

### Changes

#### 1. Connection Onboarding Wizard: `src/components/chat/ConnectionSetupCard.tsx` (New)
- A step-by-step card rendered in the chat empty state when no `woo_connections` row exists
- **Step 1**: Store URL input
- **Step 2**: Consumer Key + Consumer Secret inputs (with helper text on where to find them in WooCommerce > Settings > REST API)
- **Step 3**: Test Connection button (calls `woo-proxy` with `action: "test"`)
- **Step 4**: On success, auto-save the connection to `woo_connections`, fetch order statuses + plugins, show success state
- Reuses the same logic currently in Settings (`handleTest`, `handleSave`)
- On completion, triggers a callback to refresh the connection state in Index

#### 2. Index Page: `src/pages/Index.tsx`
- On mount, check if user has an active `woo_connections` row (query once, store in state: `hasConnection`)
- If no connection exists and `messages.length === 0`, render `<ConnectionSetupCard>` instead of the current empty state
- After setup completes, set `hasConnection = true` and show the normal chat interface
- After connection is established (either from setup card or on load if already connected), check if webhooks exist; if not, show a `WebhookSetupCard` in messages

#### 3. Webhook Setup Card: `src/components/chat/WebhookSetupCard.tsx` (New)
- Shows after successful connection with a list of recommended webhook topics:
  - `order.created` — New order placed
  - `order.updated` — Order status changed
  - `customer.created` — New customer registered
- User can check/uncheck which webhooks to create
- "Create Webhooks" button calls `woo-proxy` to POST to `webhooks` endpoint for each selected topic
- The webhook `delivery_url` points to a new edge function `webhook-receiver`
- Shows success/error state per webhook

#### 4. Webhook Receiver Edge Function: `supabase/functions/webhook-receiver/index.ts` (New)
- Receives POST requests from WooCommerce webhooks
- Parses the `X-WC-Webhook-Topic` header to determine event type
- Stores events in a new `webhook_events` table
- Returns 200 OK

#### 5. Database: `webhook_events` table (New migration)
```sql
CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON public.webhook_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service can insert events" ON public.webhook_events FOR INSERT TO public WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_events;
```

#### 6. Real-time Toast Notifications: `src/pages/Index.tsx`
- Subscribe to `webhook_events` realtime channel filtered by `user_id`
- On new insert, show a toast with event summary:
  - `order.created`: "New order #123 — $45.00 from John Doe"
  - `customer.created`: "New customer: john@example.com"
  - `order.updated`: "Order #123 status changed to processing"

#### 7. Webhook Receiver: Identify User
- When creating webhooks via `woo-proxy`, include the `user_id` in the delivery URL as a query param (e.g., `?uid=xxx`)
- The receiver edge function reads this to associate events with users

### Files to Create/Modify

| File | Change |
|------|--------|
| `src/components/chat/ConnectionSetupCard.tsx` | **New** — Step-by-step connection wizard |
| `src/components/chat/WebhookSetupCard.tsx` | **New** — Webhook creation approval card |
| `supabase/functions/webhook-receiver/index.ts` | **New** — Receives WooCommerce webhook POSTs |
| `src/pages/Index.tsx` | Check connection on mount, render setup card, realtime webhook subscription + toasts |
| Migration | New `webhook_events` table with RLS + realtime |

