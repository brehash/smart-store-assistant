

# Two Fixes: Delete Order Table + Cron Job Debug Logs

## Issue 1: Unwanted Order Table During Delete

**Root cause**: The system prompt instructs the AI to "ALWAYS search for the order first to confirm it exists, then call delete_order." The `search_orders` result renders an `OrderTable` with all matching orders, which is confusing when you just want to delete one specific order.

**Fix**: Update the system prompt to tell the AI to use the order ID directly when the user specifies it (e.g. "delete order 3626"), skipping the search step. Only search first when the order ID is ambiguous. This is a one-line prompt change in `supabase/functions/chat/index.ts`.

Change line 2382 from:
> "For updating/deleting orders: ALWAYS search for the order first..."

To:
> "For updating/deleting orders: If the user provides a specific order ID, call update_order/delete_order directly. Only search first if the order reference is ambiguous (e.g. customer name, no ID)."

---

## Issue 2: Cron Job Debug Logs in Admin

### Database
New `cron_job_logs` table:
- `id`, `job_name`, `status` (success/error/no_integrations), `summary` (JSONB with counts), `details` (JSONB array with per-user breakdown), `duration_ms`, `created_at`
- RLS: admins can SELECT, service role inserts via edge function

### Edge Function: `colete-online-tracker`
Wrap the entire execution in logging:
- Track `startTime`, collect per-user results: `userId`, `storeName`, `ordersScanned`, `ordersCompleted`, `completedOrders[]`, `errors[]`, `authStatus`
- At the end, insert a row into `cron_job_logs` with the full summary and details

### Admin API: `supabase/functions/admin/index.ts`
New `GET /cron-logs` route returning latest 50 logs ordered by `created_at DESC`.

### Admin UI
- New `src/components/admin/CronJobLogs.tsx` component:
  - Table with columns: Time, Status (badge), Duration, Orders Scanned, Orders Completed, Errors
  - Click row to expand details showing per-user breakdown (store name, orders processed, errors)
  - Manual "Run Now" button that triggers the edge function directly
- Add "Cron Jobs" tab in `src/pages/Admin.tsx`

### Files Modified
1. **Migration** -- `cron_job_logs` table + RLS
2. `supabase/functions/colete-online-tracker/index.ts` -- detailed logging + DB insert
3. `supabase/functions/admin/index.ts` -- new route
4. `src/components/admin/CronJobLogs.tsx` -- new component
5. `src/pages/Admin.tsx` -- new tab
6. `supabase/functions/chat/index.ts` -- prompt fix for delete

