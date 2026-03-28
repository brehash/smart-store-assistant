

## Fix Shipping Timeline Display + Add COD Status Code

### Problem 1: Shipping timeline not showing
The backend sends SSE like this:
```js
sendSSE({ type: "rich_content", ...richContent });
// richContent = { type: "shipping", data: shippingData }
// Result: { type: "shipping", data: shippingData }  ← "type" overwritten!
```
The spread operator causes the inner `type: "shipping"` to overwrite `type: "rich_content"`, so the client-side check `parsed.type === "rich_content"` never matches. The shipping data is silently dropped.

**Fix in `supabase/functions/chat/index.ts`** (~line 2279): Change the SSE emission to nest the rich content properly:
```typescript
// Before:
sendSSE({ type: "rich_content", ...richContent });

// After:
sendSSE({ type: "rich_content", contentType: richContent.type, data: richContent.data });
```

**Fix in `src/lib/chat-stream.ts`** (line 59-62): Update the handler to reconstruct the RichContent object:
```typescript
if (parsed.type === "rich_content") {
  callbacks.onToolCall?.({ type: parsed.contentType, data: parsed.data });
  return true;
}
```

### Problem 2: Missing COD delivered status (30500)
**Fix in `src/components/chat/ShippingTimeline.tsx`** (line 25-30): Add code 30500 to `statusColor`:
```typescript
function statusColor(code: number) {
  if (code === 20800 || code === 30500) return "delivered";
  if (code >= 20500) return "transit";
  if (code === 20050) return "pickup";
  return "initial";
}
```

### Files changed
1. `supabase/functions/chat/index.ts` — fix SSE emission to avoid type collision
2. `src/lib/chat-stream.ts` — parse the new SSE shape
3. `src/components/chat/ShippingTimeline.tsx` — add 30500 COD delivered status

