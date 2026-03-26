

# Multi-Feature Update: Views, Pipeline Persistence, Order Statuses, Multi-Tool

## 1. Pipeline/Debug Persistence on Chat Reload

**Problem**: When reopening a chat, only `content` and `rich_content` are loaded from the `messages` table. Pipeline data, debug logs, approvals, and questions are lost.

**Solution**: Add a `metadata` JSONB column to the `messages` table. When saving an assistant message, store `{ pipeline, debugLogs, approvals, questions }` in it. When loading messages, restore these fields from metadata.

**Migration**: `ALTER TABLE messages ADD COLUMN metadata jsonb;`

**Files**: `src/pages/Index.tsx` (save/load metadata), migration SQL.

## 2. Delete Chat (with messages cascade)

**Problem**: Deleting a conversation doesn't delete its messages (no foreign key cascade).

**Solution**: Add a foreign key from `messages.conversation_id` to `conversations.id` with `ON DELETE CASCADE`. The sidebar delete already calls `supabase.from("conversations").delete()` — this will now cascade to messages automatically.

**Migration**: `ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;`

## 3. Views (Chat Groups with Shared Context)

**Problem**: User wants to group multiple chats into "views" where chats share context.

**New table**: `views`
```sql
CREATE TABLE public.views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'New View',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Modify `conversations`**: Add nullable `view_id uuid REFERENCES views(id) ON DELETE SET NULL`.

**Shared context**: When sending a chat message within a view, include recent messages from sibling conversations in the same view as additional context in the system prompt. The edge function receives `viewId` and fetches recent messages from other conversations in the view.

**Sidebar UI**: Add a "Views" section above conversations. Each view is expandable, showing its chats. Chats can be dragged or moved into views. Views can be created/renamed/deleted. Chats within a view show a delete button.

**RLS**: Standard user-owned policies on `views` table.

**Files**: Migration, `ConversationSidebar.tsx` (views section), `src/pages/Index.tsx` (pass viewId), `supabase/functions/chat/index.ts` (fetch shared context).

## 4. Multi-Tool Sequential Execution

**Problem**: Complex queries like "dashboard with sales report compared to last month" should trigger multiple tool calls.

**Current state**: The while loop already supports multiple iterations (up to 8). The LLM can return multiple `tool_calls` in one response, and after executing them, the loop continues to let the LLM call more tools.

**Fix**: The issue is the system prompt doesn't instruct the LLM to use multiple tools. Add explicit instruction:

> "When the user's request requires data from multiple sources (e.g. 'create a dashboard comparing this month to last month'), call ALL necessary tools. You can call multiple tools in a single response or across multiple turns. Do not stop after one tool call if more data is needed."

Also update the pipeline plan generation to handle additional tool calls arriving in subsequent iterations — append new steps to the existing plan instead of ignoring them (since `planSent` is already true).

**Files**: `supabase/functions/chat/index.ts` (system prompt + pipeline plan appending).

## 5. Order Status Multi-Select in Settings

**Problem**: After connecting, user wants to select which order statuses to use as defaults for WooCommerce API calls.

**Implementation**:
- After successful connection test, fetch order statuses from `GET /wp-json/wc/v3/reports/orders/totals` (returns all statuses with counts).
- Display a multi-select checkbox list in Settings.
- Save selected statuses to `woo_connections` table (new column `order_statuses text[] DEFAULT '{}'::text[]`).
- In the edge function, read `order_statuses` from the connection and pass them as default status filter to tools like `search_orders` and `get_sales_report`.

**Migration**: `ALTER TABLE woo_connections ADD COLUMN order_statuses text[] NOT NULL DEFAULT '{}'::text[];`

**Files**: `Settings.tsx` (fetch statuses, render checkboxes, save), `supabase/functions/chat/index.ts` (read and apply default statuses), `woo-proxy/index.ts` (no changes needed — already proxies any endpoint), migration.

## Files Modified

- **Migration**: New migration for `metadata` column, `conversation_id` FK cascade, `views` table, `view_id` on conversations, `order_statuses` on woo_connections
- `src/pages/Index.tsx` — save/load metadata, pass viewId
- `src/pages/Settings.tsx` — order status fetching + multi-select UI
- `src/components/chat/ConversationSidebar.tsx` — views section with CRUD
- `supabase/functions/chat/index.ts` — multi-tool prompt, shared view context, default order statuses, pipeline plan appending

