

## Reduce Token Usage for Shipping Status Checks

### Problem
The `check_shipping_status` tool returns the full `shippingData` object (including the entire tracking history array) back to the AI via the tool message. Since there's no specific case in `truncateForAI` for this tool, all history entries are serialized into the AI context — wasting thousands of tokens. The visual timeline already receives the full data separately via `richContent`, so the AI doesn't need it.

### Solution
Add a `check_shipping_status` case to the `truncateForAI` function that returns only a minimal summary to the AI context.

### Changes

**File: `supabase/functions/chat/index.ts`**

Add a new case in `truncateForAI` (after the existing `search_products` case around line 669):

```typescript
if (toolName === "check_shipping_status") {
  return {
    order_id: result.order_id,
    awb: result.awb,
    courier: result.courier,
    service: result.service,
    status_name: result.status_name,
    is_delivered: result.is_delivered,
    current_status: result.current_status,
    history_count: Array.isArray(result.history) ? result.history.length : 0,
    // Full history is displayed visually via richContent; omitted here to save tokens
  };
}
```

This gives the AI enough context to write a natural-language summary (status, AWB, courier, delivered or not) without sending the entire history array. The full data is already shown to the user via the `ShippingTimeline` component.

Single file, ~10 lines added.

