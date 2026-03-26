

# Fix Chat Context Menu and Views Create Button

## Issues Found

1. **Context menu not appearing on hover**: The `DropdownMenu` component wrapping is causing a React ref warning ("Function components cannot be given refs"). The dropdown trigger button exists but likely has interaction issues due to the component structure. The fix is to ensure proper `asChild` usage and make the hover trigger more robust.

2. **Views need a visible "+" create button**: The current `FolderPlus` icon next to the VIEWS heading is very small (3.5x3.5) and low contrast. Need to make it a clearly visible `Plus` icon matching the screenshot style.

## Changes

### `src/components/chat/ConversationSidebar.tsx`

**Fix 1 — Context menu hover trigger**: The `DropdownMenuTrigger` with `asChild` wrapping a plain `<button>` element should work, but the button needs explicit `type="button"` and the opacity transition needs to be more reliable. Change the trigger button to use explicit dimensions and ensure `pointer-events` aren't blocked. Also add `relative` to the conversation row so the dropdown positions correctly.

**Fix 2 — Views "+" button**: Make the `Plus` icon next to "VIEWS" heading more prominent — slightly larger, better contrast, with a hover tooltip. Keep it as a simple inline button that creates a new view directly (current behavior works, just needs better visibility).

No database changes needed. Single file edit.

