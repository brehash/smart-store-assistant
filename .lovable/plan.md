

## Interactive Order Creation Form in Chat — ✅ Implemented

## Onboarding Flow + Webhook Setup — ✅ Implemented

### What was built
1. **ConnectionSetupCard** — 3-step wizard shown when no WooCommerce connection exists
2. **WebhookSetupCard** — Prompts user to create webhooks after successful connection  
3. **webhook-receiver edge function** — Receives WooCommerce webhook POSTs and stores in `webhook_events` table
4. **Realtime toast notifications** — Subscribes to `webhook_events` and shows toasts for new orders, customers, status changes
5. **Database** — `webhook_events` table with RLS and Realtime enabled
