

# Fix GEO Product Slider + Cache Sidebar Data

## Three Issues

### 1. Product slider showing during GEO audit
When the user asks for a GEO audit on a product by name, the AI calls `search_products` first (to resolve the ID), then `audit_geo`. The `search_products` tool always returns `richContent: { type: "products" }`, which renders a product slider — unnecessary noise when the goal is a GEO audit.

**Fix in `supabase/functions/chat/index.ts`**: Before emitting rich content, check if a GEO tool (`audit_geo`, `generate_geo_content`, `bulk_geo_audit`) has been called or is pending in the current tool call batch. If so, suppress the `products` rich content type. Alternatively, simpler approach: add the GEO intent tools (`search_products`, `get_product`) to the GEO intent group in `intent.ts`, and in `index.ts` track a `geoFlowActive` flag — when any GEO tool executes, skip emitting `products` rich content.

**Implementation**: In `index.ts` around line 677, before emitting rich content, check if any tool call in the current iteration includes a GEO tool name. If yes, suppress `products` type rich content:

```typescript
const geoTools = new Set(["audit_geo", "generate_geo_content", "bulk_geo_audit"]);
const isGeoFlow = toolCalls.some(tc => geoTools.has(tc.function.name));

if (richContent && !emittedRichTypes.has(richContent.type)) {
  // Don't show product slider when doing GEO work
  if (richContent.type === "products" && isGeoFlow) {
    // skip
  } else {
    sendSSE({ type: "rich_content", ... });
    emittedRichTypes.add(richContent.type);
  }
}
```

Also add `search_products` and `get_product` to GEO intent tools in `intent.ts` so the AI can find products by name during GEO flows.

### 2. Cache sidebar data with initial limit of 30
Currently the sidebar re-fetches ALL conversations from the database on every `activeId` change (line 84 dependency). No caching, no pagination limit.

**Fix in `ConversationSidebar.tsx`**:
- Add `.limit(30)` to the conversations query for initial load
- Cache data in `sessionStorage` so switching tabs doesn't trigger re-fetches
- On mount: load from sessionStorage instantly, then fetch fresh data in background
- Only re-fetch when `activeId` changes if the new ID isn't in the cached list (new conversation created)
- Remove `activeId` from the useEffect dependency — use a separate targeted mechanism to handle new conversations

**Implementation**:
```typescript
const CACHE_KEY = "sidebar_conversations";
const CACHE_KEY_VIEWS = "sidebar_views";

useEffect(() => {
  if (!user) return;
  // Load from cache immediately
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) setConversations(JSON.parse(cached));
  const cachedViews = sessionStorage.getItem(CACHE_KEY_VIEWS);
  if (cachedViews) setViews(JSON.parse(cachedViews));
  
  // Fetch fresh (limited to 30)
  const load = async () => {
    const [convRes, viewRes] = await Promise.all([
      supabase.from("conversations")
        .select("id, title, updated_at, view_id, pinned")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(30),
      supabase.from("views")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
    ]);
    if (convRes.data) {
      setConversations(convRes.data);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(convRes.data));
    }
    if (viewRes.data) {
      setViews(viewRes.data);
      sessionStorage.setItem(CACHE_KEY_VIEWS, JSON.stringify(viewRes.data));
    }
  };
  load();
}, [user]);
```

- When `activeId` changes and it's a new conversation not in the list, prepend it optimistically
- When "load more" is clicked, fetch with offset and append

### 3. Change default recentsLimit from 10 to 30
Line 61: change `useState(10)` to `useState(30)` to show 30 recent chats by default.

## Files to modify
1. `supabase/functions/chat/index.ts` — suppress `products` rich content during GEO flows
2. `supabase/functions/chat/intent.ts` — add `search_products`, `get_product` to GEO intent tools
3. `src/components/chat/ConversationSidebar.tsx` — cache sidebar data in sessionStorage, limit to 30, change recentsLimit default

