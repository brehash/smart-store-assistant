

# Chat UX Enhancements — 5 Features

## 1. Preferences-Aware Product Search

**Problem**: Preferences/aliases are injected into the system prompt (`prefsContext`) but the AI doesn't proactively use them when searching products. The user says "pasta neagra" but the search_products tool gets the literal text instead of resolving the alias first.

**Fix** (backend only — `supabase/functions/chat/prompts.ts`):
- Add an explicit instruction in the system prompt telling the AI: "Before calling search_products, check if any of the user's saved preferences/aliases match the query. If so, use the mapped product name or ID from the alias instead of the raw user text."
- This is a prompt engineering fix — no schema or UI changes needed.

## 2. Stop Response Button

**Files**: `ChatInput.tsx`, `Index.tsx`, `chat-stream.ts`

- When `isStreaming` is true, replace the Send button with a Stop button (Square icon)
- Add an `AbortController` in `Index.tsx` passed into `streamChat`
- In `chat-stream.ts`, accept an `AbortSignal` and pass it to the `fetch` call
- On stop: cancel the reader, call `onDone` to persist the partial response, set `isStreaming = false`

## 3. User Message Actions (Copy & Edit+Resend)

**File**: `ChatMessage.tsx`

- For user messages, on hover show small icon buttons: Copy (clipboard icon) and Edit (pencil icon)
- **Copy**: copies `content` to clipboard with a toast
- **Edit**: replaces the message bubble with an editable textarea pre-filled with content. On submit:
  - Call `onEditAndResend(messageIndex, newText)` which truncates messages to that index and re-sends
- New prop: `onEditAndResend?: (newText: string) => void`
- `Index.tsx`: wire `onEditAndResend` — slice messages to before that user message, then call `handleSend(newText)`

## 4. Assistant Message Action Bar (Copy, Thumbs, Retry)

**Files**: `ChatMessage.tsx`, `Index.tsx`, new migration for feedback table

### UI
- After the token/credit usage badge on assistant messages (non-streaming), render a row of small icon buttons:
  - **Copy** — copies assistant content to clipboard
  - **Thumbs Up / Thumbs Down** — toggles feedback state, highlighted when active
  - **Retry** (refresh icon) — removes this assistant message and re-sends the preceding user message

### Database
- New `message_feedback` table:
  ```sql
  CREATE TABLE public.message_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating text NOT NULL CHECK (rating IN ('up', 'down')),
    created_at timestamptz DEFAULT now(),
    UNIQUE (message_id, user_id)
  );
  ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;
  -- RLS: users manage own feedback, admins can read all
  ```

### Props
- `onRetry?: () => void` — Index.tsx removes last assistant message and re-calls handleSend with the previous user message
- `onFeedback?: (rating: "up" | "down") => void` — upserts to message_feedback table
- `messageId?: string` — needed for feedback persistence

## 5. Plan Mode

**Files**: `ChatInput.tsx`, `Index.tsx`, `chat-stream.ts`, `supabase/functions/chat/index.ts`, `supabase/functions/chat/prompts.ts`

### Concept
A toggle in the chat input area (e.g. a "Plan" chip/button next to the textarea) that when active:
- Prepends `[PLAN MODE]` to the message sent to the backend
- Backend detects this prefix and uses a plan-specific system prompt addition: "The user is in PLAN MODE. Analyze their request and produce a structured plan with numbered steps. Do NOT execute any tools. Only outline what you would do, what tools you'd call, and what the expected outcome is. Ask clarifying questions if needed."
- The response renders normally as markdown (the plan is text)
- After reviewing, the user can click "Execute Plan" which sends the plan text back with `[EXECUTE PLAN]` prefix, triggering normal tool execution

### UI
- Toggle button in `ChatInput.tsx` (e.g. `Lightbulb` icon or "Plan" text chip)
- When plan mode is on, the textarea placeholder changes to "Descrie ce vrei să faci..."
- State managed in `Index.tsx`, passed to `ChatInput`

---

## Files Summary

| File | Changes |
|------|---------|
| `supabase/functions/chat/prompts.ts` | Add preference-aware search instruction |
| `src/components/chat/ChatInput.tsx` | Stop button, plan mode toggle |
| `src/pages/Index.tsx` | AbortController, edit+resend, retry, feedback handlers, plan mode state |
| `src/components/chat/ChatMessage.tsx` | User hover actions, assistant action bar |
| `src/lib/chat-stream.ts` | Accept AbortSignal |
| `supabase/functions/chat/index.ts` | Detect `[PLAN MODE]` / `[EXECUTE PLAN]` prefixes |
| Migration | `message_feedback` table |

