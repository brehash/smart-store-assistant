

## Fix: Pipeline Steps Reverting on Tab Switch

### Root Cause

React 18 automatic batching. When `pipeline_complete` fires, it calls `updateLastAssistant` which queues a `setMessages` update. The closure variable `pipelineData` is only updated **inside** the React updater function. But React doesn't execute the updater immediately — it batches it. Then `[DONE]` arrives on the very next SSE line, triggering `onDone()` which saves `pipelineData` to the database. At this point, `pipelineData` still reflects the old state (only steps 0-1 done), so the DB gets stale data. When the user switches tabs and React re-renders, the stale persisted state appears.

### Fix

**File: `src/pages/Index.tsx`**

In the `pipeline_complete` handler (line 291-299), update `pipelineData` **before** calling `updateLastAssistant`, not inside the updater:

```typescript
} else if (event.type === "pipeline_complete") {
  // Update pipelineData OUTSIDE the React updater to avoid batching race
  if (pipelineData) {
    const doneSteps = pipelineData.steps.map((s) =>
      s.status === "pending" ? { ...s, status: "done" as const } : s
    );
    pipelineData = { ...pipelineData, steps: doneSteps };
  }
  updateLastAssistant((m) => {
    if (!m.pipeline) return m;
    return { ...m, pipeline: pipelineData! };
  });
  scrollToBottom();
}
```

Apply the same fix to the `pipeline_step` handler — update `pipelineData` outside the updater too, so it's always in sync when `onDone` reads it.

Same pattern for the approval-flow `pipeline_complete` handler at line 456-464.

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Move `pipelineData` mutations outside React updater functions in `pipeline_complete` and `pipeline_step` handlers (both in main stream and approval flow) |

