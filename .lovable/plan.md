

## Visual Shipping Status Timeline

### Overview
Create a new `ShippingTimeline` component that displays shipping tracking data as a visual vertical timeline with status icons, and emit it as a `"shipping"` rich content type from the backend.

### New Component: `src/components/chat/ShippingTimeline.tsx`

A card-based visual timeline showing:
- **Header**: Order number, AWB, courier name, service type
- **Current status badge**: Color-coded (green for delivered, blue for in-transit, gray for pending)
- **Vertical timeline**: Each history entry as a node with:
  - Colored dot (green = delivered, blue = in-transit/depot, yellow = picked up, gray = initial)
  - Connecting vertical line between dots
  - Status name (bold), reason (if any), date/time formatted, location from comment
- Latest entry at the top, oldest at the bottom

### Changes

| File | Change |
|------|--------|
| `src/components/chat/ShippingTimeline.tsx` | New component with vertical timeline UI |
| `src/components/chat/ChatMessage.tsx` | Add `"shipping"` to `RichContent.type` union, render `ShippingTimeline` |
| `supabase/functions/chat/index.ts` | Add `richContent: { type: "shipping", data: {...} }` to `check_shipping_status` return |

### Backend: emit rich content

In the `check_shipping_status` case, add `richContent` to the return alongside `result`:
```
richContent: {
  type: "shipping",
  data: {
    order_id, awb, courier, service, provider,
    is_delivered, current_status, history (reversed — newest first)
  }
}
```

### Status color mapping
- Code `20800` (delivered) → green
- Codes `20500`+ (in delivery, transit, depot) → blue  
- Codes `20050` (picked up) → yellow
- Codes below `20000` (initial/emitted) → gray

