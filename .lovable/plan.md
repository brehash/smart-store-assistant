

## Fix: Pipeline Completes All Steps But Renders Nothing

### Root Cause

The while loop has `maxIterations = 8`. When the AI calls tools across multiple rounds (your screenshot shows 10+ "Searching orders" steps), the iteration counter exhausts. When the loop exits naturally (maxIterations hits 0), the code falls through to line 1227 which just sends `[DONE]` — **without sending any content, error message, or pipeline_complete event**. The frontend receives `[DONE]`, sets `isStreaming = false`, but there's no text content, no dashboard, and no error toast. The user sees a completed pipeline with nothing rendered.

### Fix (in `supabase/functions/chat/index.ts`)

#### 1. Add fallback after the while loop exits
After the `while` loop (line 1225, before line 1227), add a check: if no content was ever sent to the user (no delta text, no dashboard), emit an error message so the user isn't left staring at nothing.

```typescript
// After the while loop ends (whether by break or iteration exhaustion)
if (!contentSent) {
  sendSSE({ type: "reasoning", text: "Error: Ran out of processing steps before generating a response." });
  sendSSE({ choices: [{ delta: { content: "⚠️ I gathered the data but ran out of processing steps before I could write the analysis. Please try asking again — I'll be more concise this time." } }] });
  sendSSE({ type: "pipeline_complete", lastStepIndex: stepIndex });
}
```

Add a `let contentSent = false;` flag at the top of the `start()` function, set it to `true` when content is sent via delta (line 1214) or dashboard (line 1207).

#### 2. Increase maxIterations from 8 to 15
The autonomous data gathering rule makes the AI call more tools. 8 iterations is too few for complex multi-tool queries. Increase to 15.

#### 3. Add iteration-aware system prompt injection
When `maxIterations <= 2`, inject a system message forcing the AI to stop calling tools and produce its final answer:

```typescript
if (maxIterations <= 2) {
  aiMessages.push({ 
    role: "system", 
    content: "CRITICAL: You are running low on processing steps. You MUST produce your final answer NOW using the data you already have. Do NOT call any more tools." 
  });
}
```

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/chat/index.ts` | Add `contentSent` flag, fallback after loop, increase maxIterations to 15, add iteration-pressure system message |

