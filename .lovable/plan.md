

# Fix Pipeline Display + Add API Response Debug Panel

## Problem Analysis

### Pipeline not working
The pipeline UI depends on the AI model outputting a `\`\`\`pipeline` code block with a specific JSON format. If the model doesn't output this (which is unreliable), no `pipeline_plan` event is sent, and subsequent `pipeline_step` events are silently dropped because the frontend checks `if (!m.pipeline) return m;` — no pipeline container exists to receive the steps.

### No visibility into REST API responses
Currently the WooCommerce API responses are passed directly to the LLM as tool results but never shown to the user, making debugging impossible.

## Changes

### 1. Edge Function — Auto-generate pipeline from tool calls (`supabase/functions/chat/index.ts`)

Stop relying on the AI to output `\`\`\`pipeline` blocks. Instead, when the AI response contains `tool_calls`, automatically generate and emit a `pipeline_plan` event from the tool calls list before executing them. Remove the regex-based plan detection entirely.

```text
// Before executing tool calls:
if (toolCalls.length > 0 && !planSent) {
  const steps = toolCalls.map(tc => TOOL_LABELS[tc.function.name] || tc.function.name);
  sendSSE({ type: "pipeline_plan", title: "Execution Plan", steps });
  planSent = true;
}
```

This guarantees the pipeline UI always appears when tools are called.

### 2. Edge Function — Send API responses as debug events (`supabase/functions/chat/index.ts`)

After each tool execution, emit a new `debug_api` SSE event containing the tool name, args, and raw API result:

```text
sendSSE({ type: "debug_api", toolName, args, result });
```

### 3. Frontend — Handle auto-generated pipeline (`src/pages/Index.tsx`)

Update `onPipelineEvent` handler for `pipeline_step`: if no `m.pipeline` exists yet, auto-create one from the step event (add step dynamically). This handles cases where steps arrive before or without a plan.

### 4. Frontend — Debug panel toggle (`src/pages/Index.tsx` + new component)

- Add a `debugLogs` array to message state storing `{ toolName, args, result }` objects
- Handle `debug_api` events in `onPipelineEvent` by appending to the current message's debug logs
- Store on each message as `debugLogs?: DebugEntry[]`

### 5. New component: `DebugPanel.tsx` (`src/components/chat/DebugPanel.tsx`)

A collapsible panel rendered below each assistant message (when debug logs exist):
- Toggle button: "API Responses" with expand/collapse
- Shows each tool call with: tool name, request args (JSON), response (JSON) in a scrollable `<pre>` block
- Styled as a subtle card with monospace font

### 6. Update `ChatMessage.tsx`

Add `debugLogs` prop and render `<DebugPanel>` when present.

### 7. Remove plan format from system prompt

Remove the instruction telling the AI to output `\`\`\`pipeline` blocks since we auto-generate plans now. Keep the instruction to call tools sequentially.

## Files Modified
- `supabase/functions/chat/index.ts` — auto-generate pipeline, emit debug events, simplify system prompt
- `src/pages/Index.tsx` — handle debug_api events, auto-create pipeline on step events
- `src/components/chat/ChatMessage.tsx` — pass debugLogs to new DebugPanel
- `src/components/chat/DebugPanel.tsx` — new collapsible API response viewer
- `src/lib/chat-stream.ts` — add `debug_api` to PipelineEvent type

