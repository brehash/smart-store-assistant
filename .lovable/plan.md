

## Add "Check Shipping Status" AI Tool (Colete Online)

### Overview
Add a new `check_shipping_status` tool to the AI that lets users ask about the shipping status of an order. The tool fetches the order from WooCommerce, extracts the `uniqueId` from `_coleteonline_courier_order` metadata, authenticates with Colete Online API, and returns the tracking history. If the user provides an AWB instead of an order number, the AI warns them to use the order number.

### Changes

**1. Tool Definition (add to `TOOLS` array)**

New tool `check_shipping_status` with a single required param `order_id` (number). Description instructs the AI that this checks Colete Online shipping status by looking up the order's metadata automatically.

**2. System Prompt Update**

Add a section to the system prompt (conditionally, only when Colete Online integration is enabled):
- "When the user asks about shipping status, tracking, or delivery of an order, use `check_shipping_status` with the order number."
- "If the user provides an AWB number instead of an order number, warn them that you need the order number (not the AWB) and ask them for it."
- "NEVER ask the user for a uniqueId — the tool extracts it automatically from order metadata."

**3. Conditional Tool Injection**

Before building the tools list, query `woo_integrations` for `colete_online` where `is_enabled = true` for this user. If enabled, push the `check_shipping_status` tool to the tools array and append the system prompt section.

**4. Tool Execution Handler (in `executeTool` switch)**

```
case "check_shipping_status":
  1. Fetch order from WooCommerce: GET orders/{order_id}
  2. Find meta_data key "_coleteonline_courier_order"
  3. Parse the value, extract result.uniqueId and result.awb
  4. If not found → return error "No Colete Online shipment found on this order"
  5. Get user's Colete Online credentials from woo_integrations
  6. Authenticate: POST https://auth.colete-online.ro/token (Basic auth, client_credentials)
  7. GET https://api.colete-online.ro/v1/order/status/{uniqueId}
  8. Return formatted status with AWB, courier name, and history entries (statusTextParts.ro.name + dateTime)
```

**5. Labels & Semantic Plan**

- Add `check_shipping_status: "Checking shipping status"` to `TOOL_LABELS`
- Add semantic plan steps: "Fetching order details" → "Checking Colete Online status" → "Writing explanation"

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/chat/index.ts` | Add tool definition, conditional injection, execution handler, system prompt section, labels |

No database changes needed — uses existing `woo_integrations` table.

