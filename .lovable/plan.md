

# Chat Context Menu, Pin Support, and View-scoped New Chat

## Changes

### 1. Chat item context menu with dropdown (`ConversationSidebar.tsx`)

Replace the current trash icon on hover with a ChatGPT-style "three dots" menu button (`MoreHorizontal` icon from lucide). Use the existing `DropdownMenu` component. Menu items:

- **Rename** — inline rename (set editing state for that conversation)
- **Move to view** — submenu listing all views, clicking one updates `conversation.view_id`
- **Pin chat** — toggles a `pinned` field on the conversation
- *Separator*
- **Delete** — deletes conversation (cascade handles messages)

On hover: show `...` button. If chat is pinned, show a small pin icon next to the title; on hover, shift pin icon left to make room for the `...` button.

### 2. Pin support — database migration

Add `pinned boolean NOT NULL DEFAULT false` to `conversations` table. Pinned chats appear at the top of Recents.

### 3. Conversation rename support

Add inline editing state for conversations (similar to view rename). When "Rename" is clicked, the title becomes an editable input. On Enter/blur, update via `supabase.from("conversations").update({ title })`.

### 4. New Chat inside a View

When a view is expanded, show a small `+ New Chat` button inside the view. Clicking it creates a new conversation with `view_id` set to that view's ID, and selects it. This requires updating `createConversation` in `Index.tsx` to accept an optional `viewId` parameter, and passing a callback from the sidebar.

Update `ConversationSidebarProps` to add `onNewInView: (viewId: string) => void`. In `Index.tsx`, implement this by creating a conversation with `view_id` set.

### Files Modified

- **Migration** — `ALTER TABLE conversations ADD COLUMN pinned boolean NOT NULL DEFAULT false;`
- `src/components/chat/ConversationSidebar.tsx` — full rewrite of chat item rendering: dropdown menu, pin icon, rename inline, "New Chat" inside views, move-to-view submenu
- `src/pages/Index.tsx` — add `onNewInView` handler that creates conversation with `view_id`

### Technical Details

- Use `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`, `DropdownMenuSeparator` from existing UI components
- Pin icon: `Pin` from lucide-react, displayed with `rotate-45` class for the tilted pin look
- Pinned conversations sorted to top of Recents list
- Chat item layout: `[MessageSquare icon] [title] [pin icon if pinned] [... button on hover]`
- On hover when pinned: pin icon shifts left, `...` appears in its place

