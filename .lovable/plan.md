

# Three fixes: Cron schedule, sidebar dropup, and "refuzata" skip

## 1. Change cron schedule from every 2 hours to every 6 hours

The current cron job `colete-online-tracker-every-2h` runs on schedule `0 */2 * * *`. Update it to `0 */6 * * *` (every 6 hours). Manual triggering is already supported via the "Run Now" button in the admin panel.

**Change**: Run SQL via insert tool to unschedule the old job and create a new one with `0 */6 * * *`.

## 2. Fix sidebar email dropup not appearing

The expanded sidebar footer (lines 503-526) wraps the `DropdownMenu` inside a `<div className="border-t border-sidebar-border p-3">`. The parent sidebar container is `<div className="flex h-full w-64 flex-col">` — the dropdown content with `side="top"` is likely clipped by the sidebar's overflow or z-index.

**Fix in `src/components/chat/ConversationSidebar.tsx`**:
- Add `overflow-visible` to the footer container div
- Add a higher `z-index` class (e.g. `z-[70]`) to the `DropdownMenuContent` to ensure it renders above the sidebar's own z-index (`z-[60]`)
- Use `sideOffset={8}` on the DropdownMenuContent for proper spacing

## 3. Skip orders with status "refuzata" in the tracker

The tracker currently skips orders with statuses: `completed`, `cancelled`, `refunded`, `failed`, `trash`. Add `refuzata` to this exclude list.

**Change in `supabase/functions/colete-online-tracker/index.ts`** (line 146):
```typescript
const excludeStatuses = ["completed", "cancelled", "refunded", "failed", "trash", "refuzata"];
```

## Files changed

| File | Change |
|------|--------|
| SQL (insert tool) | Reschedule cron to every 6 hours |
| `src/components/chat/ConversationSidebar.tsx` | Fix dropup z-index/overflow |
| `supabase/functions/colete-online-tracker/index.ts` | Add "refuzata" to excluded statuses |

