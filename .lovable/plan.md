

# Fix: Approval/Question/Order State Not Persisting Across Reloads

## Problem

When you approve/skip an action (like deleting order #3626), the resolved state is only stored in React memory. It's never written back to the database. So when you switch tabs or reload, the conversation loads from DB and the approval card appears unresolved again — asking for approval on an action that already completed.

Same issue affects question cards and order form cards.

## Root Cause

- `handleApproval` (line 498) calls `updateLastAssistant()` which only updates React state
- The original assistant message in the DB still has `approvals: [{ ..., resolved: undefined }]`
- On reload, line 232 fetches messages from DB → approvals come back without `resolved`

## Fix

### `src/pages/Index.tsx`

After updating the local state in each handler, also update the message's `metadata` column in the database:

1. **`handleApproval`** — After setting `resolved` on the approval in React state, update the DB message's `metadata.approvals` to include the resolved status. The message has an `id` field (loaded from DB at line 245), so we can target it directly.

2. **`handleQuestionAnswer`** — Same pattern: persist `resolved` to the question in metadata.

3. **`handleOrderCreated`** — Same pattern: persist `resolved` to the order form in metadata.

The update logic:
```text
1. Get the current message from state (it has an `id` from the DB)
2. Build updated metadata with the resolved approval/question/orderForm
3. Call supabase.from("messages").update({ metadata }).eq("id", messageId)
```

This ensures that when the conversation reloads, all cards show their resolved state correctly.

~15 lines added across the three handlers. No new files, no schema changes.

