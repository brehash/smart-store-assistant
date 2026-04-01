

# Fix: Cache Messages Per Conversation

## Problem

Every time a conversation is opened — even one that was already loaded — the app fetches messages from the database again and shows the skeleton preloader. There is no client-side cache.

## Fix — `src/pages/Index.tsx`

1. **Add a messages cache ref**: `useRef<Map<string, Message[]>>(new Map())` to store already-fetched messages keyed by `conversationId`.

2. **Update the message-loading `useEffect`** (line 363):
   - Before fetching, check if the cache has this `conversationId`. If yes, set messages from cache instantly (no `setLoadingMessages(true)`, no fetch).
   - Only show the preloader and fetch from DB when the conversation is NOT in the cache.
   - After a successful fetch, store the result in the cache.

3. **Keep cache in sync**: When new messages are added during streaming (user sends a message, assistant replies), update the cache entry for the current `conversationId` alongside `setMessages`. This can be done by updating the cache ref whenever `messages` changes for the active conversation — a simple `useEffect` that writes `messagesCacheRef.current.set(conversationId, messages)` after streaming completes.

4. **Invalidate on delete**: When a conversation is deleted from the sidebar, remove its entry from the cache map.

## Files

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Add `messagesCacheRef`, check cache before fetch, update cache after fetch/stream, clear on delete |

