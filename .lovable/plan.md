

# Fix Settings Modal + Add Connection Pages + Cron History

## Issues Identified

1. **Settings modal can't be closed on mobile** — The close button (X) exists but the sidebar nav takes ~208px (w-52) which on a 440px viewport leaves only ~230px for content. The `[&>button.absolute]:hidden` class on DialogContent hides the default Radix close button, relying on the custom X in the nav. The nav sidebar doesn't collapse on mobile, making it hard to use.

2. **User wants "Conexiuni" in the dropup** — Quick access to connection info/status without opening full settings.

3. **Each integration needs its own page** — Currently Colete Online is a settings tab; should be a standalone route.

## Plan

### 1. Fix Settings Modal on Mobile

**`src/pages/Settings.tsx`** — Make the settings nav responsive:
- On mobile (`< sm`), convert the sidebar nav into a horizontal scrollable row or a dropdown selector at the top
- When a tab is selected on mobile, show only the content (hide nav list) with a back button
- Alternatively (simpler): on mobile, show nav as a stacked list that collapses once a tab is selected, with a back arrow to return to tab list

**Simpler approach**: On mobile, use a two-phase layout:
- Phase 1: Show tab list full-width (no content)
- Phase 2: When tab selected, show content full-width with a back button
- Track `mobileShowContent` state

### 2. Add "Conexiuni" to User Dropup Menu

**`src/components/chat/ConversationSidebar.tsx`**:
- Add a new `DropdownMenuItem` labeled "Conexiuni" with a `Store` icon
- On click, navigate to `/connections` (new page) or open settings on "connection" tab
- Since we're moving toward separate pages, navigate to a new `/connections` route

### 3. Create Dedicated Pages for Connection & Integrations

**New file: `src/pages/Connections.tsx`**:
- Extract connection content from Settings.tsx `renderConnection()` into this page
- Full-page layout with back navigation to chat
- Add a section showing the last 5 cron job runs for the current user's store (query `cron_job_logs` filtered by the user's store URL from `woo_connections`)
- Show cron run history: timestamp, status, summary (orders delivered/returned)

**New file: `src/pages/Integrations.tsx`** (or per-integration pages):
- Start with `src/pages/ColeteOnline.tsx` — extract `renderIntegrations()` content
- Full-page layout with back navigation
- Show integration-specific cron logs filtered by job_name

**`src/App.tsx`**:
- Add routes: `/connections`, `/integrations/colete-online`

**`src/pages/Settings.tsx`**:
- Remove "Conexiune" and "Integrări" tabs from TABS array
- Keep General, Appearance, Team, Credits, Account in the modal
- Simplify the modal (fewer tabs = better mobile fit)

### 4. Cron History for Regular Users

**`src/pages/Connections.tsx`**:
- Query cron_job_logs via an edge function or RLS policy update
- Need to add an RLS policy allowing users to see cron logs related to their store, OR create a simple edge function that returns filtered logs
- Simpler: use a new edge function endpoint that returns the last N cron runs for the authenticated user's connection

**Database**: Update `cron_job_logs` RLS to allow users to see logs where `details` contains their store URL, or add a `user_id` column to cron_job_logs. Adding `user_id` is cleaner.

- Migration: `ALTER TABLE cron_job_logs ADD COLUMN user_id uuid;` + RLS policy for users to see their own logs
- Update `colete-online-worker` to store `user_id` in cron_job_logs

### Files Summary

| File | Change |
|------|--------|
| `src/pages/Settings.tsx` | Mobile-responsive nav (two-phase), remove connection/integration tabs |
| `src/pages/Connections.tsx` | New page — connection settings + last 5 cron runs |
| `src/pages/ColeteOnline.tsx` | New page — Colete Online integration settings + logs |
| `src/components/chat/ConversationSidebar.tsx` | Add "Conexiuni" to dropup menu |
| `src/App.tsx` | Add `/connections` and `/integrations/colete-online` routes |
| `cron_job_logs` migration | Add `user_id` column + RLS policy for user access |
| `supabase/functions/colete-online-worker/index.ts` | Store `user_id` in cron logs |

### Technical: Mobile Settings Fix

```text
Mobile (< 640px):
┌──────────────────┐     ┌──────────────────┐
│ ← Setări         │     │ ← General        │
│                  │     │                  │
│ ▸ General        │ ──► │ [content area]   │
│ ▸ Aspect         │     │                  │
│ ▸ Echipă         │     │                  │
│ ▸ Credite        │     │                  │
│ ▸ Cont           │     │                  │
└──────────────────┘     └──────────────────┘
   Tab list phase          Content phase
```

