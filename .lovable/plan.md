

## Sidebar Redesign: Collapsible, Avatar Dropup, Settings Modal

### 1. Collapsible sidebar (`ConversationSidebar.tsx`)

- Add `collapsed` boolean state, persisted in `localStorage`
- Toggle button at the top (sidebar icon) — always visible
- **Expanded** (~w-64): current layout but with "New Chat" as a plain menu row (icon + text), not a button
- **Collapsed** (~w-14): icon-only column showing: toggle, new chat, search icons at top; views/recents hidden; avatar at bottom
- Wrap all icon buttons with `<Tooltip>` for hover labels when collapsed
- Accept `collapsed` + `onToggle` as props (state lives in Index.tsx for layout coordination)

### 2. New Chat as plain menu item

- Replace the `<Button>` with a simple `<button>` row: `Plus` icon + "New Chat" text, same styling as conversation items (px-3 py-2, hover:bg-sidebar-accent/50)
- When collapsed, show just the `Plus` icon with tooltip "New Chat"

### 3. User avatar dropup (footer)

- Remove Settings and Sign Out buttons from footer
- Add `Avatar` with user initials (from `user.email`) at the bottom
- On click, open a `DropdownMenu` with `side="top"`:
  - **Settings** — calls `onOpenSettings()` prop
  - **Sign Out** — calls `signOut()`
- When collapsed, show just the avatar circle; tooltip "Account"

### 4. Settings modal with URL persistence

- Extract Settings page content into `SettingsContent` component (same file, exported)
- In `Index.tsx`:
  - Read `?settings=true` from URL on mount → open modal
  - `Dialog` (max-w-2xl, max-h-[85vh] with scroll) wraps `SettingsContent`
  - Opening pushes `?settings=true`; closing removes it
  - Pass `onOpenSettings` to sidebar
- In `App.tsx`: redirect `/settings` to `/?settings=true`

### Files to modify

| File | Changes |
|------|---------|
| `src/components/chat/ConversationSidebar.tsx` | Add collapsed mode, tooltips, plain new-chat row, avatar dropup footer |
| `src/pages/Index.tsx` | Manage collapsed state + localStorage, settings modal with URL param, pass props to sidebar |
| `src/pages/Settings.tsx` | Extract `SettingsContent` component, export it |
| `src/App.tsx` | Redirect `/settings` → `/?settings=true` |

