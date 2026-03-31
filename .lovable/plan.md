

# Scale Colete Online Tracker for 200+ Integrations

## Problem
The current cron job processes ALL integrations sequentially in a single edge function invocation. At 200 sites, it will timeout (~60s limit) long before finishing. Each site requires: 1 auth call + paginated order fetches + per-order status checks + updates.

## Solution: Fan-out Architecture

Split into two functions: an **orchestrator** that dispatches work, and a **worker** that processes one integration at a time.

```text
pg_cron (every 6h)
  └─▶ colete-online-tracker (orchestrator)
        ├─▶ fetch all enabled integrations
        ├─▶ invoke worker for integration #1
        ├─▶ invoke worker for integration #2
        ├─▶ ...
        └─▶ invoke worker for integration #200
              └─▶ each worker:
                    auth → fetch orders → check statuses → update
                    → write own cron_job_log row
```

### File 1: `supabase/functions/colete-online-tracker/index.ts` (orchestrator)
- Fetch all enabled `colete_online` integrations
- For each integration, fire an async `fetch()` to the worker function (fire-and-forget using `Promise.allSettled` with concurrency limit of 10)
- Log a summary row: how many workers dispatched
- No order processing in this function anymore
- Keeps the "test" action as-is

### File 2: `supabase/functions/colete-online-worker/index.ts` (new worker)
- Accepts `{ integration_id }` in the request body
- Processes exactly ONE integration: auth → fetch orders → check statuses → update completed
- Writes its own `cron_job_logs` row with per-user details
- Has full 60s to process one site's orders
- Add concurrency-safe order pagination (process up to 200 orders max per run to stay within timeout)

### Additional improvements in the worker
- **Parallel status checks**: batch Colete Online status requests using `Promise.allSettled` (groups of 5) instead of sequential
- **Early exit**: skip orders already checked within the last 2 hours (add a lightweight `last_checked_at` field to avoid redundant API calls — or track via metadata)
- **Rate limit safety**: add 100ms delay between WooCommerce update calls

### Database: no changes needed
The existing `cron_job_logs` table works — each worker writes its own row. The orchestrator writes a dispatch summary row.

### Cron schedule update
The pg_cron job URL stays the same (points to the orchestrator). No schedule change needed.

## Estimated capacity
- 200 integrations × ~10 orders each = ~2000 status checks
- With 10 concurrent workers, each handling 1 site in ~15-30s → total ~5 minutes
- Well within limits since each individual function call has its own 60s timeout

## Files to create/modify
1. `supabase/functions/colete-online-tracker/index.ts` — refactor to orchestrator
2. `supabase/functions/colete-online-worker/index.ts` — new worker function

