

# Fix: Orchestrator Expanded View Shows Empty Details

## Problem

The orchestrator log stores details like:
```json
[{ "integration_id": "xxx", "status": "dispatched" }]
```

But the expanded row template only renders worker-style fields (`storeName`, `authStatus`, `ordersScanned`, etc.), so orchestrator rows expand to show empty/blank cards.

## Fix — `src/components/admin/CronJobLogs.tsx`

Detect whether the expanded log is an orchestrator or worker and render different content:

**Orchestrator expanded view** — show a simple table of dispatched workers:
| Integration ID | Status |
|---|---|
| `abc-123` | dispatched |

**Worker expanded view** — keep existing detailed breakdown (orders table, errors, etc.) as-is.

### Implementation

In the `CollapsibleContent` section (line 206-326), wrap the existing detail rendering in an `isOrchestrator` check:

- If `isOrchestrator`: render a simple table with columns "Integration ID" and "Dispatch Status", iterating over `log.details` as `{ integration_id, status, error? }`.
- If worker: keep the existing card-based breakdown unchanged.

### Changes

| File | Change |
|------|--------|
| `src/components/admin/CronJobLogs.tsx` | Add orchestrator-specific expanded view with dispatch results table; keep worker view unchanged |

