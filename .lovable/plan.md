

# 8 Issues — Analysis & Fix Plan

## Issues Identified

### 1. Impersonation Banner Not Showing
**Root Cause**: The `ImpersonationBanner` component reads from `sessionStorage` only once on mount (in a `useEffect` with `[]` deps). After `startImpersonation()` writes to `sessionStorage` and navigates to `/`, the banner component has already mounted and won't re-read. The banner needs to listen for storage changes or use a shared state trigger.

**Fix**: Add a custom event listener. After `startImpersonation()` in `UsersTable.tsx`, dispatch a custom event. In `ImpersonationBanner`, listen for that event to re-read sessionStorage. Alternatively, add `location.pathname` as a dependency or use `window.addEventListener("storage", ...)` — but `storage` events only fire across tabs. Best approach: dispatch a custom `"impersonation-start"` event.

### 2. GEO Tool Doesn't Use Preferences for Product Search
**Root Cause**: The `audit_geo` tool takes `entity_id` directly — the AI is supposed to search first, resolve the alias from preferences, then call `audit_geo` with the correct ID. But the prompt instruction (line 92-95) only tells the AI to check preferences before `search_products`. The GEO section (line 140-148) doesn't remind the AI to search+resolve first.

**Fix**: Add explicit instruction in the GEO section of `prompts.ts`: "Before calling audit_geo or generate_geo_content, if the user refers to a product by name/alias, FIRST call search_products (using the preference-resolved name) to get the correct entity_id. NEVER hallucinate an entity_id." Also add a validation in `tool-executor.ts` for `audit_geo`: if the fetched entity returns an error, return a clear message saying "Product not found" instead of generating a report with "Unknown".

### 3. How GEO Audit Works (informational)
The `audit_geo` tool in `tool-executor.ts` (line 858): takes `entity_id` + `entity_type`, fetches the product/page/post from WooCommerce via `woo-proxy`, then analyzes the HTML description for: content depth (word count), FAQ schema markup, headings structure, structured data (JSON-LD), and meta SEO. Returns a 0-100 score with category breakdowns.

### 4. Caching for Chats (React Query)
Currently, chat messages are loaded via raw `supabase.from("messages").select(...)` calls. No caching — every conversation switch re-fetches.

**Fix**: Use React Query (`useQuery`) for message loading with `queryKey: ["messages", conversationId]`. Add `staleTime: 5 * 60 * 1000` and invalidate on new messages. Same for conversation list in `ConversationSidebar`.

### 5. Caching for Admin Pages
Admin fetches users, stats, cron logs via raw `fetch()` calls with no caching.

**Fix**: Convert `fetchUsers` in `Admin.tsx` and data fetching in `UsageStats`, `CronJobLogs`, `PlansManager` to use React Query with appropriate stale times.

### 6. Caching for Settings → Team
`TeamSettings` fetches team data via raw `supabase.functions.invoke("team")` with no caching.

**Fix**: Convert to React Query with `queryKey: ["team"]` and invalidate on mutations.

### 7. Display Team Member Usage
Currently no usage stats per team member are shown.

**Fix**: Add a "Usage" section in `TeamSettings` (visible to team owners) that queries message counts and credit transactions per member. Use the admin-style approach but scoped to team members. Add a backend route in the `team` edge function: `GET /usage` that returns per-member message counts and credit usage for the current month.

### 8. Team Members See "Connect Website" After Accepting Invitation
**Root Cause**: In `Index.tsx` line 104-158, `checkConnection` first checks `woo_connections` for the current user. If none found, it checks `team_members`. The team member check (line 139-157) correctly sets `hasConnection(true)` when membership exists. BUT — the `woo_cache` fetch on line 162-175 only queries `user_id = user.id`, meaning team members won't have cached data (payment methods, products, statuses) since those belong to the team owner.

Additionally, the team membership check uses the anon client with RLS, which might fail if the membership was just created by the service role.

**Fix**: 
- When a team membership is found, also fetch the team owner's `woo_cache` data (need to query through the team → owner path)
- Add a backend helper or modify `woo-proxy` to also return cached data for team members
- Simpler approach: after detecting team membership, fetch the owner's `woo_connections.order_statuses` and `woo_cache` via the `team` edge function, which already has service role access

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/ImpersonationBanner.tsx` | Listen for custom event to re-read sessionStorage |
| `src/components/admin/UsersTable.tsx` | Dispatch custom event after `startImpersonation()` |
| `supabase/functions/chat/prompts.ts` | Add GEO-specific preference resolution instruction |
| `supabase/functions/chat/tool-executor.ts` | Better error handling in `audit_geo` for missing products |
| `src/pages/Index.tsx` | React Query for messages, fix team member cache/connection flow |
| `src/components/chat/ConversationSidebar.tsx` | React Query for conversation list |
| `src/pages/Admin.tsx` | React Query for users fetch |
| `src/components/admin/UsageStats.tsx` | React Query |
| `src/components/admin/CronJobLogs.tsx` | React Query |
| `src/components/admin/PlansManager.tsx` | React Query |
| `src/components/settings/TeamSettings.tsx` | React Query + team member usage display |
| `supabase/functions/team/index.ts` | Add GET /usage route for team member stats |

