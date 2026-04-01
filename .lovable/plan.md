

# Nested Collapsible Cron Logs with Multi-Open Support

## Problem

1. Orchestrator and worker logs are flat — no nesting. You can't see which workers belong to which orchestrator.
2. Only one row can be expanded at a time (`expandedId` is a single string).

## Fix — `src/components/admin/CronJobLogs.tsx`

### 1. Allow multiple rows open simultaneously

Replace `expandedId: string | null` with `expandedIds: Set<string>`. Toggle by adding/removing from the set.

### 2. Group orchestrator + workers together

Logs appear to come in pairs: an orchestrator dispatches workers, and worker logs have the same timestamp. Group them by matching `created_at` proximity (within ~60s) or by the `integration_id` in the orchestrator's details matching worker details.

**Simpler approach**: Keep the flat list but nest workers inside orchestrators visually:
- When an orchestrator row is expanded, find all worker logs from the same time window (within 5 minutes before the orchestrator's `created_at`).
- Render those workers as collapsible sub-rows inside the orchestrator's expanded content, each with its own expand/collapse toggle.
- Hide those worker rows from the top-level list to avoid duplication.

### 3. Implementation details

**State change:**
```typescript
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
const toggleExpand = (id: string) => {
  setExpandedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
};
```

**Grouping logic:**
- Sort logs by `created_at` desc.
- For each orchestrator, find worker logs whose `created_at` falls within a window (orchestrator time ± 5 min). Collect their IDs into a `childWorkerIds` set.
- Top-level render: skip logs whose IDs are in `childWorkerIds`.
- Inside orchestrator expanded view: replace the dispatch table with collapsible worker rows, each rendering the existing worker Card detail view.

**Orchestrator expanded content:**
- Each dispatched integration becomes a collapsible row showing worker summary (store name, scanned, completed, errors).
- Expanding a worker row shows the full order table and error details (reusing existing Card content).

### Files

| File | Change |
|------|--------|
| `src/components/admin/CronJobLogs.tsx` | Multi-expand state, group workers under orchestrators, nested collapsibles |

