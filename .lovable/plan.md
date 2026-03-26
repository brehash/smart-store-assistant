

# Fix Chat Context Menu Visibility on Hover

## Root Cause

The three-dots button exists in the DOM and the dropdown works (confirmed by clicking it blind). The `group-hover:opacity-100` CSS isn't applying visually. The Radix `ScrollArea` Viewport sets inline `overflow: scroll` which creates a new stacking context that interferes with the `group` / `group-hover` Tailwind pattern.

## Fix

In `ConversationSidebar.tsx`, change the visibility approach for the context menu button. Instead of relying on `group-hover:opacity-100`, use a state-based approach or switch to `pointer-events-none`/`pointer-events-auto` with a different visibility method.

**Approach**: Use `invisible group-hover:visible` instead of `opacity-0 group-hover:opacity-100`, as `visibility` is handled differently by the browser rendering engine and is more reliable inside scroll containers. If that still doesn't work, fall back to tracking hover state via `onMouseEnter`/`onMouseLeave` on the conversation row and conditionally rendering the button.

### Changes to `ConversationSidebar.tsx`

1. **Add hover state tracking** to each conversation row using `onMouseEnter`/`onMouseLeave` with a `hoveredConvId` state variable
2. **Conditionally show** the three-dots button only when `hoveredConvId === c.id` (or when the dropdown is open for that conv)
3. **Keep dropdown open state** — track which conversation has its dropdown open so the button stays visible while the menu is open
4. **Pin icon behavior** — when hovered, hide pin icon and show three-dots; when not hovered, show pin icon

Single file change: `src/components/chat/ConversationSidebar.tsx`

### Implementation Detail

```
// New state
const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);
const [openMenuConvId, setOpenMenuConvId] = useState<string | null>(null);

// On conversation row div:
onMouseEnter={() => setHoveredConvId(c.id)}
onMouseLeave={() => setHoveredConvId(null)}

// Show button when hovered OR menu is open:
const showMenu = hoveredConvId === c.id || openMenuConvId === c.id;

// DropdownMenu gets onOpenChange to track open state:
<DropdownMenu onOpenChange={(open) => setOpenMenuConvId(open ? c.id : null)}>

// Pin icon: show only when NOT hovered/menu-open
{c.pinned && !showMenu && <Pin ... />}

// Button: render only when showMenu is true
{showMenu && <DropdownMenuTrigger>...</DropdownMenuTrigger>}
```

