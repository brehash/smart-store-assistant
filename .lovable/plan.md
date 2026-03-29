

# Fix: Dialog overlay overlapping sidebar on mobile

## Problem
The sidebar container uses `z-50` (line 719 in `Index.tsx`), while Dialog/AlertDialog overlays also use `z-50` (from `dialog.tsx` and `alert-dialog.tsx`). On mobile, when a dialog opens while the sidebar is visible (or vice versa), they overlap at the same z-level.

## Solution
Bump the sidebar z-index above dialog overlays so it always sits on top, or close the sidebar when a dialog opens.

**Approach: Close sidebar when dialog opens + raise sidebar z-index**

### Changes in `src/pages/Index.tsx`

1. **Raise sidebar z-index**: Change sidebar container from `z-50` to `z-[60]` and backdrop from `z-40` to `z-[55]` so the sidebar always renders above any Radix dialog overlay (z-50).

2. **Auto-close sidebar when settings dialog opens**: In `handleOpenSettings`, call `setSidebarOpen(false)` so the sidebar dismisses on mobile when settings opens.

### Summary of line changes

| Location | Current | New |
|---|---|---|
| Line 716 (backdrop) | `z-40` | `z-[55]` |
| Line 719 (sidebar) | `z-50` | `z-[60]` |
| `handleOpenSettings` | (no sidebar close) | Add `setSidebarOpen(false)` |

