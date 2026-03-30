

# Fix sidebar z-index conflicts with settings modal and dropup menu

## Problem
1. **Sidebar overlays settings modal** — The sidebar has `z-[60]` but the Radix Dialog overlay defaults to `z-50`, so the sidebar renders on top of the modal.
2. **User dropup menu hidden when collapsed** — The `DropdownMenuContent` at `z-[70]` renders inside the sidebar's `z-[60]` stacking context (because `fixed` + `transform` creates a new stacking context). The portal escapes the DOM tree but the visual layering still conflicts.

## Fix

### 1. Lower sidebar z-index, raise modal z-index (`src/pages/Index.tsx`)
- Change the sidebar container from `z-[60]` to `z-[40]`
- Change the mobile backdrop from `z-[55]` to `z-[35]`
- Add `z-[50]` to the `DialogContent` for the settings modal so it always sits above the sidebar

### 2. Raise dropup z-index (`src/components/chat/ConversationSidebar.tsx`)
- Change `DropdownMenuContent` from `z-[70]` to `z-[9999]` — since it portals to `<body>`, this ensures it's above everything including the sidebar's stacking context

## Files changed

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Sidebar `z-[40]`, backdrop `z-[35]`, dialog `z-[50]` |
| `src/components/chat/ConversationSidebar.tsx` | Dropup `z-[9999]` |

