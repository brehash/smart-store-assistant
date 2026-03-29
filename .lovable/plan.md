

# Fix: Webhook setup card keeps appearing after webhooks already created

## Problem
The card visibility is controlled by a `localStorage` flag (`webhook-setup-dismissed-{uid}`). This is fragile — it gets lost on browser/device changes, cleared storage, etc. So users who already created webhooks see the prompt again.

## Solution
Instead of relying on localStorage, check if webhooks already exist on the WooCommerce store via `woo-proxy`. If any Lovable-created webhooks are found, skip showing the card entirely.

### Changes in `src/pages/Index.tsx`

In the connection-check effect (around line 110-117), after confirming a connection exists, query existing webhooks:

```typescript
// After confirming connection exists, check for existing webhooks
const { data: whData } = await supabase.functions.invoke("woo-proxy", {
  body: { endpoint: "webhooks", method: "GET" },
});
const hasWebhooks = Array.isArray(whData) && whData.some(
  (w: any) => w.name?.startsWith("Lovable") && w.status === "active"
);
if (!hasWebhooks) {
  const dismissed = localStorage.getItem(`webhook-setup-dismissed-${user.id}`);
  if (!dismissed) setShowWebhookSetup(true);
}
```

This keeps localStorage as a secondary "don't show again" mechanism (for users who clicked Skip) but prevents the card from appearing when webhooks already exist on the store.

### Changes in `src/components/chat/WebhookSetupCard.tsx`

No changes needed — the existing `onComplete`/`onDismiss` callbacks already set the localStorage flag as a fallback.

