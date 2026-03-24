

# Pipeline UI with Plan Mode, Steps & Approval Flow

## What You'll Get
An agentic pipeline UI where the AI shows its thinking process step-by-step — similar to how Lovable works. When you ask "create an order with 2 of 50gr pasta bourbon", instead of just doing it silently, the AI will:

1. Show a **plan** with numbered steps (e.g., "1. Search for matching products 2. Confirm selection 3. Create order")
2. Display each step with a **loading spinner** while executing, then a **checkmark** when done
3. For destructive actions (create/update orders), show an **approval prompt** with Approve/Skip/Edit buttons
4. Ask **clarifying questions** when the request is ambiguous

## Architecture

### Backend (Edge Function `chat`)
- Update the system prompt to instruct the AI to always output a structured plan before executing tools
- Add a new SSE event type `pipeline_step` that streams step status updates (`pending`, `running`, `done`, `error`, `needs_approval`, `question`)
- Before executing write tools (`create_order`, `update_order_status`), send a `needs_approval` event and pause until the client responds
- Add a new endpoint or message type for the client to send approval/skip/edit responses mid-stream

### Frontend Components

**1. `PipelineStep` component**
- Renders a single step with icon (spinner → checkmark → X), title, and optional details
- States: `pending` (gray dot), `running` (spinning loader), `done` (green check), `error` (red X), `skipped` (gray dash)
- Expandable to show tool results inline

**2. `PipelinePlan` component**
- Renders the full plan as a vertical list of `PipelineStep` items with a connecting line
- Shows plan title and summary at the top

**3. `ApprovalCard` component**
- Inline card with action summary, Approve/Skip/Edit buttons
- Edit opens inline text input to modify the action parameters
- Styled as a distinct card within the chat flow

**4. `QuestionCard` component**
- Renders AI questions with clickable option buttons
- Supports free-text "Other" input

### Message Flow

```text
User: "Create order with 2 of 50gr pasta bourbon"
    ↓
AI streams plan:
  ┌─────────────────────────────────────┐
  │ Plan: Create Order                   │
  │                                      │
  │ ⏳ 1. Search for "pasta bourbon"     │
  │ ○  2. Confirm product match          │
  │ ○  3. Create order                   │
  └─────────────────────────────────────┘
    ↓
Step 1 executes:
  │ ✅ 1. Search for "pasta bourbon"     │  ← checkmark + product slider
  │ ⏳ 2. Confirm product match          │
    ↓
Step 2 — approval needed:
  │ ✅ 1. Search for "pasta bourbon"     │
  │ ⏳ 2. Confirm product match          │
  │   ┌──────────────────────────┐       │
  │   │ Found: Pasta Bourbon 50g │       │
  │   │ Qty: 2  Price: 15 RON   │       │
  │   │ [Approve] [Skip] [Edit]  │       │
  │   └──────────────────────────┘       │
    ↓ (user clicks Approve)
  │ ✅ 2. Confirmed                      │
  │ ⏳ 3. Creating order...              │
  │ ✅ 3. Order #1234 created            │
```

### Data Flow Changes

- **`chat-stream.ts`**: Add new callbacks: `onPipelineStep`, `onApprovalNeeded`, `onQuestion`
- **`Index.tsx`**: Track pipeline state per assistant message; handle approval responses by sending a follow-up message to the edge function
- **`ChatMessage.tsx`**: Render pipeline steps inline when `richContent.type === "pipeline"`
- **Edge function**: New SSE event types (`pipeline_plan`, `pipeline_step_update`, `approval_request`, `question_request`); approval handled via a second request with the user's response

### Files to Create/Modify
- **Create**: `src/components/chat/PipelineStep.tsx`, `src/components/chat/PipelinePlan.tsx`, `src/components/chat/ApprovalCard.tsx`, `src/components/chat/QuestionCard.tsx`
- **Modify**: `supabase/functions/chat/index.ts` (plan generation, step streaming, approval flow)
- **Modify**: `src/lib/chat-stream.ts` (new event handlers)
- **Modify**: `src/pages/Index.tsx` (pipeline state management, approval handlers)
- **Modify**: `src/components/chat/ChatMessage.tsx` (render pipeline UI)

