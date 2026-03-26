
Fix both issues in two layers: deterministic backend date logic, and visible post-tool pipeline steps.

1. Make comparison dates deterministic in `supabase/functions/chat/index.ts`
- Add a small server-side date utility layer instead of trusting the model’s raw date math.
- Detect common relative comparison intents from the latest user request and/or tool labels, especially:
  - this month vs last month same period
  - this week vs last week same period
  - year to date vs last year same period
  - full previous month / full previous week
- Compute the ranges on the backend using the current server date, so:
  - “this month” = `2026-03-01 → 2026-03-26`
  - “last month same period” = `2026-02-01 → 2026-02-26`
- Cap previous-period end dates safely for shorter months.
- Normalize or override bad AI-generated tool args before executing `get_sales_report` / `compare_sales`.
- Also replace fragile `toISOString().split("T")[0]` style formatting with a timezone-safe date formatter so month boundaries don’t drift.

2. Strengthen the AI instructions, but don’t rely on them alone
- Update the chat function prompt so “same period” is explicitly defined as “same elapsed day span in the previous period”.
- Include concrete examples in the prompt.
- Keep backend normalization as the real safety net if the model still sends wrong dates.

3. Add real post-tool progress feedback in the chat pipeline
- In `supabase/functions/chat/index.ts`, emit extra pipeline steps after tool execution and before final assistant text, for example:
  - “Analyzing received data”
  - “Crafting dashboard from data”
  - “Preparing final response”
- Only send `pipeline_complete` after those synthesis steps are done, not immediately after the last tool call.

4. Make pipeline feedback actually visible in the UI
- `src/components/chat/PipelineStep.tsx` currently ignores `step.details`; render it under the step title.
- Use those details for helpful context like:
  - compared range labels
  - final normalized dates
  - dashboard generation progress
- Keep the main title short and the details explanatory.

5. Keep the frontend pipeline flow compatible
- Verify `src/pages/Index.tsx` continues appending extra pipeline steps correctly after tool execution.
- If needed, adjust step indexing so synthesis steps appear after tool steps instead of overwriting them.

Files to update
- `supabase/functions/chat/index.ts`
- `src/components/chat/PipelineStep.tsx`
- possibly `src/pages/Index.tsx` if step append behavior needs a small adjustment

Validation after implementation
- Ask: “sales report this month compared to last month same period”
- Confirm backend executes with:
  - current period: `2026-03-01 → 2026-03-26`
  - previous period: `2026-02-01 → 2026-02-26`
- Confirm the pipeline visibly continues after tools with steps like:
  - “Analyzing received data”
  - “Crafting dashboard from data”
- Confirm the chat no longer looks “finished” before the final dashboard/text appears.
