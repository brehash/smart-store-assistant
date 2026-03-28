

## Three Changes: Always-available shipping tool, not-connected message, test connection button

### 1. Make `check_shipping_status` always available (future-proof for multiple integrations)

**File: `supabase/functions/chat/index.ts`**

- Move `check_shipping_status` from conditionally-injected into the base `TOOLS` array (always available)
- Update description: "Check the shipping/delivery status of an order. Requires the WooCommerce order number (NOT an AWB). The tool automatically detects the shipping provider from order metadata."
- In the tool execution handler (`case "check_shipping_status"`): instead of checking Colete Online credentials upfront, first check order metadata to detect which shipping provider is present (currently only `_coleteonline_courier_order`), then fetch the relevant integration config
- If no integration is enabled/configured for the detected provider, return a clear error: "This order uses Colete Online shipping but you haven't connected the Colete Online integration yet. Go to Settings > Integrations to enable it."
- If no shipping metadata is found at all, return: "No shipping tracking data found on this order."

**System prompt update**: Remove the conditional branching. Always include instructions about using the tool. If no shipping integration is enabled, the tool itself will inform the user — the AI doesn't need to gatekeep.

### 2. Test Connection button for Colete Online

**File: `src/pages/Settings.tsx`**

- Add a "Test Connection" button next to the "Save Integration" button
- On click: call the Colete Online auth endpoint (`POST https://auth.colete-online.ro/token` with client credentials grant) via a small edge function or directly (since it's CORS-friendly)
- Since the auth endpoint likely won't support CORS from the browser, route the test through the existing `colete-online-tracker` edge function with a `?action=test` query param
- Display success toast with "Connection successful!" or error toast with the failure reason

**File: `supabase/functions/colete-online-tracker/index.ts`**

- Add a `test` action handler: accept `client_id` and `client_secret` in the request body, attempt OAuth2 token fetch, return success/failure JSON

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/chat/index.ts` | Move `check_shipping_status` to base TOOLS, update execution to detect provider, simplify system prompt |
| `src/pages/Settings.tsx` | Add "Test Connection" button calling colete-online-tracker with `?action=test` |
| `supabase/functions/colete-online-tracker/index.ts` | Add `test` action handler for credential validation |

