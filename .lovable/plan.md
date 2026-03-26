

# Fix Missing Database Schema, Sidebar Redesign, and Order Status Bug

## Problem Summary

1. **Previous migration never applied** — `views` table, `metadata` column on messages, `view_id` on conversations, `order_statuses` on woo_connections, and FK cascade all missing from the database.
2. **Sidebar needs redesign** to match the ChatGPT-style screenshot: New Chat, Search, Views section (paginated 5 at a time), Recents section (paginated 10 at a time).
3. **Order statuses not used** — the `order_statuses` column doesn't exist yet, and the Settings UI references it. The edge function reads it but it's always empty since the column is missing.

## Changes

### 1. Database Migration (single migration)

Create all missing schema in one migration:

```sql
-- views table
CREATE TABLE public.views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'New View',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.views ENABLE ROW LEVEL SECURITY;
-- RLS: user owns their views (SELECT, INSERT, UPDATE, DELETE)

-- conversations: add view_id
ALTER TABLE public.conversations ADD COLUMN view_id uuid REFERENCES public.views(id) ON DELETE SET NULL;

-- messages: add metadata column
ALTER TABLE public.messages ADD COLUMN metadata jsonb;

-- messages: add FK cascade
ALTER TABLE public.messages
  ADD CONSTRAINT messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

-- woo_connections: add order_statuses
ALTER TABLE public.woo_connections ADD COLUMN order_statuses text[] NOT NULL DEFAULT '{}'::text[];
```

### 2. Sidebar Redesign (`ConversationSidebar.tsx`)

Restructure to match the screenshot layout:

```
[New Chat button]
[Search chats input]

Views
  - View 1 (expandable, shows chats inside)
  - View 2
  - ... (Show more — loads 5 at a time)
  [+ New View button]

Recents
  - Chat 1
  - Chat 2
  - ... (Show more — loads 10 at a time)

---
[Settings]
[Sign out]
```

- **Search**: Filter conversations by title as user types
- **Views**: Show first 5, "More" button loads next 5. Each view expandable with its chats. CRUD (rename, delete) on hover.
- **Recents**: All conversations sorted by `updated_at`, show first 10, "More" loads next 10. Delete on hover.
- Clean dark sidebar styling matching the screenshot reference.

### 3. Settings — Order Statuses Fix (`Settings.tsx`)

The UI already has the order status checkbox section but references `order_statuses` which doesn't exist yet. Once the migration adds the column, it will work. Also ensure `handleSave` sends `order_statuses` correctly and the `fetchOrderStatuses` call works with the proxy.

### 4. Edge Function — No changes needed

The edge function already reads `order_statuses` from `connData` and passes `defaultOrderStatuses` to `executeTool`. Once the column exists in the database, the selected statuses will flow through correctly.

## Files Modified
- **New migration** — all schema additions
- `src/components/chat/ConversationSidebar.tsx` — full redesign with search, paginated views/recents
- `src/pages/Settings.tsx` — minor fix to ensure `order_statuses` column is properly read/written (already mostly correct)

## Technical Details
- Views pagination: load 5 at a time using state counter, slice the array
- Recents pagination: load 10 at a time using state counter, slice the array  
- Search: client-side filter on conversation title
- All conversations loaded once on mount, filtered/sliced client-side for simplicity

