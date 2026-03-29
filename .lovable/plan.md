

# Fix: Disappearing messages + duplicate tables

## Issue 1: Messages disappearing

**Root cause**: In `handleSend`, the user message is added to React state (line 345) and saved to DB (line 350) without error handling. The assistant message is saved in `onDone` (line 510) also without error handling or `.select()`. If either insert fails silently, or if the stream errors without partial content, the in-memory state is lost on next conversation load.

More critically: `onError` (line 520-539) only persists the assistant message if `assistantContent || reasoningEntries.length || pipelineData` is truthy. If the error happens very early (e.g., rate limit after the user message was already added to state but the response comes back as a non-200 before any stream data), the user message IS saved to DB but the UI shows a toast and the conversation may appear broken. However, a reload should still show it.

**Most likely cause**: The `handleSend` function captures `messages` from the closure at call time (line 352, 368). If two sends happen rapidly, or if React hasn't committed the state update yet, the second send could overwrite the first. But more importantly — if the DB insert for the user message on line 350 fails (no `.select()`, no error check), the message exists only in state and vanishes on reload.

**Fix**: Add error handling to the user message DB insert and show a toast if it fails. Also ensure the assistant message insert in `onDone` has error handling.

### Changes in `src/pages/Index.tsx`

1. **Line 350**: Add error handling to user message insert — if it fails, show a toast warning
2. **Line 510-518**: Add error handling to assistant message insert in `onDone` — retry once or show warning

---

## Issue 2: AI returns 4 duplicate tables for invoice queries

**Root cause**: The multi-iteration tool loop (up to 15 iterations) in `supabase/functions/chat/index.ts` can call `get_orders_with_meta` multiple times. Each call emits a `rich_content` SSE event with `type: "orders"` (tool-executor.ts line 523 + index.ts line 588). Then the AI's final text response also contains a `` `dashboard` `` code block which emits yet another dashboard SSE event. If the AI calls `get_orders_with_meta` 3 times across iterations, the user sees 3 order tables + 1 dashboard = 4 tables.

**Fix**: Deduplicate rich content emissions. Only emit `rich_content` for `orders` type once (keep the last/most complete one), or skip `rich_content` for tools that will also generate a dashboard in the final response.

### Changes in `supabase/functions/chat/index.ts`

1. Track which `rich_content` types have already been emitted during the current request
2. For `orders` type specifically: skip re-emitting if already sent, OR only emit the last one by buffering
3. **Simpler approach**: For `get_orders_with_meta` tool, don't emit `richContent` at all since the AI always follows up with a `dashboard` block that presents the data better. Remove the `richContent` return from `get_orders_with_meta` in `tool-executor.ts`.

### Changes in `supabase/functions/chat/tool-executor.ts`

1. **Line 521-524**: Remove `richContent` from `get_orders_with_meta` return — the dashboard block from the AI's final response handles visualization. The raw order table is redundant and causes duplication.

---

## Summary

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Add error handling to user/assistant message DB inserts |
| `supabase/functions/chat/tool-executor.ts` | Remove `richContent` from `get_orders_with_meta` to prevent duplicate tables |
| `supabase/functions/chat/index.ts` | Add dedup guard: track emitted `rich_content` types, skip duplicates within same request |

