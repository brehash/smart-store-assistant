

## Auto-suggest Order Completion When Shipping Is Delivered

### Problem
When checking shipping status, if the package is delivered but the WooCommerce order status is not "completed", nothing happens. The user should be prompted to mark it as completed.

### Changes

**File: `supabase/functions/chat/index.ts`**

1. **Fix `isDelivered` to include COD status** (line 1654): Change from checking only `20800` to also include `30500`:
   ```typescript
   const isDelivered = latestEvent?.code === 20800 || latestEvent?.code === 30500;
   ```

2. **Include order status in `shippingData`** (line 1663-1674): Add the WooCommerce order status from `orderData.status` so the frontend and AI know the current order state:
   ```typescript
   const shippingData = {
     ...existing fields,
     order_status: orderData.status,  // e.g. "processing", "completed"
   };
   ```

3. **Update system prompt** (line 1908 area): Add instruction after the existing shipping prompt section:
   ```
   - After showing shipping status, if the shipment is delivered (is_delivered = true) but the order status is NOT "completed", proactively ask the user: "The package has been delivered but the order is still marked as [status]. Would you like me to mark it as completed?" If the user agrees, use update_order_status to set the order to "completed".
   ```

4. **Update `truncateForAI`** (line 671-681): Include `order_status` in the truncated result so the AI can see it:
   ```typescript
   if (toolName === "check_shipping_status") {
     return {
       ...existing fields,
       order_status: result.order_status,
     };
   }
   ```

### How it works
- The AI receives both `is_delivered` and `order_status` in the truncated tool result
- The system prompt instructs it to compare these two values
- If delivered but not completed, the AI asks the user in natural language
- If user agrees, the AI calls the existing `update_order_status` tool (which is already a write tool requiring approval via ApprovalCard)
- No new UI components needed — uses existing approval flow

### Files
1. `supabase/functions/chat/index.ts` — all 4 changes above

