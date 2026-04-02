

# Mobile-First Layout Improvements

## Current Issues on Mobile (440px viewport)

1. **Sidebar** uses desktop-first approach — hidden by default, opens as overlay via hamburger menu. This works but the expanded sidebar is full `w-64` with no mobile optimizations.
2. **Chat area** has fixed padding/margins designed for desktop (`max-w-3xl`, `px-4`).
3. **Header bar** has desktop spacing.
4. **Chat input** has desktop padding (`p-4`, `max-w-3xl`).
5. **Empty state** suggestion buttons don't wrap well on small screens.
6. **Settings dialog** uses `max-w-4xl h-[85vh]` which may be cramped on mobile.

## Changes

### 1. `src/pages/Index.tsx` — Tighten mobile spacing

| Area | Current | Mobile-First Change |
|------|---------|-------------------|
| Header bar | `px-4 py-3` | `px-3 py-2 sm:px-4 sm:py-3` |
| Title | `text-lg` | `text-base sm:text-lg` |
| Message container | `max-w-3xl py-4` | `max-w-3xl py-2 sm:py-4` |
| Loading skeleton | `py-4 px-4` | `py-2 px-3 sm:py-4 sm:px-4` |
| Empty state | `px-4` | `px-3 sm:px-4`, smaller text on mobile |
| Suggestion chips | `flex-wrap gap-2` | `gap-1.5 sm:gap-2`, smaller text `text-xs sm:text-sm` |
| Settings dialog | `max-w-4xl h-[85vh]` | `max-w-[95vw] sm:max-w-4xl h-[95vh] sm:h-[85vh]` on mobile it takes more screen |
| Sidebar overlay | Only `lg:hidden` backdrop | Keep as-is, works well |

### 2. `src/components/chat/ChatInput.tsx` — Mobile input area

| Current | Change |
|---------|--------|
| `p-4` wrapper | `p-2 sm:p-4` |
| `max-w-3xl` inner | Keep, already responsive |
| Plan mode button `h-[44px] w-[44px]` | `h-9 w-9 sm:h-[44px] sm:w-[44px]` |

### 3. `src/components/chat/ChatMessage.tsx` — Compact mobile messages

| Current | Change |
|---------|--------|
| Message padding | `px-4 py-4` → `px-3 py-2 sm:px-4 sm:py-4` |
| Avatar icons | Smaller on mobile |
| Content text | Already responsive via markdown |

### 4. `src/components/chat/ConversationSidebar.tsx` — Mobile sidebar width

| Current | Change |
|---------|--------|
| Expanded width `w-64` | `w-[85vw] max-w-64 sm:w-64` on mobile overlay to use more screen but cap at 64 |

### Files

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Mobile-first spacing for header, messages, empty state, settings dialog |
| `src/components/chat/ChatInput.tsx` | Compact padding and button sizes on mobile |
| `src/components/chat/ChatMessage.tsx` | Tighter message padding on mobile |
| `src/components/chat/ConversationSidebar.tsx` | Better mobile width for overlay sidebar |

