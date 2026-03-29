

# Fix First Message Disappearing on New Conversation

## Root Cause

When sending the first message, `createConversation()` calls `setConversationId(newId)`. This triggers the `useEffect` (line 222) that loads messages from the database. But at that point, the user message hasn't been inserted into the DB yet (that happens on line 298, after the state update). So the effect overwrites `messages` with an empty array, causing the "How can I help you?" screen to flash back.

## Fix

### `src/pages/Index.tsx`

Add a ref (`skipLoadRef`) that acts as a guard. Set it to `true` inside `createConversation()` before setting the conversation ID. In the `useEffect` that loads messages, check this ref — if `true`, reset it and skip the DB load. This prevents the race condition without changing any other behavior.

```text
Flow after fix:
1. handleSend → createConversation() → skipLoadRef = true → setConversationId(id)
2. useEffect fires → sees skipLoadRef is true → skips DB load → resets ref
3. handleSend continues → setMessages([userMsg]) → user sees their message immediately
4. Streaming proceeds normally
```

Single file change, ~6 lines added.

