

## Fix Reasoning & Pipeline Display Issues

### Root cause analysis

There are **3 bugs** causing the broken experience — none of them require a different AI model.

**Bug 1: Pipeline steps reset to "pending"**
When the AI returns tool calls, line 896 sends a second `pipeline_plan` event with all steps. The frontend handler (Index.tsx line 148) recreates ALL steps with `status: "pending"`, wiping out the already-completed "Understanding request" step. This is why steps show empty circles in the screenshot.

**Bug 2: Edge function uses `stream: false` — response hangs**
The AI call at line 860 uses `stream: false`, meaning the entire AI round-trip blocks before any SSE events are sent. If the AI model takes 15-30s to think + the WooCommerce API takes time, the SSE connection can appear dead. The frontend shows no activity during this wait. Combined with Supabase edge function timeout limits (~150s), complex multi-tool chains can silently die.

**Bug 3: No timeout/error detection on frontend**
If the edge function times out or the SSE stream dies, `onDone` never fires, `onError` never fires, and the UI stays stuck in "streaming" state forever with no feedback.

### Fixes

#### 1. Fix pipeline_plan to preserve completed steps (Index.tsx)

When a `pipeline_plan` event arrives, merge with existing step statuses instead of replacing them:

```typescript
// Before (broken): all steps get "pending"
const planSteps = (event.steps || []).map((s, i) => ({
  id: `step-${i}`, title: s, status: "pending"
}));

// After (fixed): preserve existing step statuses
const existingSteps = m.pipeline?.steps || [];
const planSteps = (event.steps || []).map((s, i) => ({
  id: `step-${i}`,
  title: s,
  status: existingSteps[i]?.status || "pending"
}));
```

#### 2. Add SSE keepalive heartbeat (edge function)

Send periodic `reasoning` events during long operations so the frontend knows the connection is alive:

```typescript
// Before each AI call, emit a reasoning event
sendSSE({ type: "reasoning", text: "Analyzing your request..." });

// During tool execution, emit progress
sendSSE({ type: "reasoning", text: `Processing ${toolName}...` });
```

Also add a "thinking" reasoning event before the AI model call itself (the slowest part):

```typescript
sendSSE({ type: "reasoning", text: "Thinking about how to help..." });
const aiResp = await fetch(aiBaseUrl, { ... });
```

#### 3. Add frontend timeout detection (chat-stream.ts + Index.tsx)

Add a 120s inactivity timeout — if no SSE data arrives for 120s, surface an error:

```typescript
let lastActivity = Date.now();
// In the read loop: lastActivity = Date.now() after each chunk
// Timeout check: if (Date.now() - lastActivity > 120_000) onError("Connection timed out")
```

Also add a cleanup in Index.tsx so if `isStreaming` is true but no events arrive for 2 minutes, reset the state.

#### 4. Emit synthesis reasoning events (edge function)

After all tools complete and before the final AI call, emit reasoning events so the user sees activity:

```typescript
// Before final AI synthesis call
sendSSE({ type: "reasoning", text: "Preparing your response..." });
```

### Files to modify

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Fix `pipeline_plan` handler to preserve existing step statuses |
| `src/lib/chat-stream.ts` | Add 120s inactivity timeout detection |
| `supabase/functions/chat/index.ts` | Add reasoning events before AI calls ("Thinking..."), add keepalive reasoning during long waits |

### Why a reasoning model is NOT needed

The reasoning bubbles feature doesn't use AI model "reasoning mode" (like OpenAI's extended thinking). It's a **UI feature** that shows what the system is doing — which tools it's calling, what data it found, etc. The bugs above are purely SSE streaming and state management issues. The current `gemini-3-flash-preview` model works fine for this.

