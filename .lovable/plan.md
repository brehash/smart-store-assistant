

## Add Active Plugins Detection to Settings

### Overview
Fetch active WordPress plugins via the REST API, display them as selectable checkboxes in Settings > Connection (below order statuses), and persist selections in the database.

### Changes

#### 1. Database: Add `active_plugins` column to `woo_connections`
Add a `text[]` column (like `order_statuses`) to store selected plugin slugs.

```sql
ALTER TABLE public.woo_connections 
ADD COLUMN active_plugins text[] NOT NULL DEFAULT '{}';
```

#### 2. Settings UI (`src/pages/Settings.tsx`)
- Add state: `plugins` (fetched list), `selectedPlugins` (user selections), `loadingPlugins`
- Add `fetchPlugins()` — calls `woo-proxy` with `apiPrefix: "wp/v2"`, `endpoint: "plugins?status=active"` to get active plugins
- Call it after successful test connection and on initial load (same as `fetchOrderStatuses`)
- Render a new Card below "Default Order Statuses" with plugin checkboxes (name + version)
- Include `active_plugins: selectedPlugins` in the `handleSave` payload
- The WordPress plugins endpoint returns: `{ plugin, status, name, version, ... }` — use `plugin` (slug) as identifier, `name` for display

#### 3. Edge function (`supabase/functions/woo-proxy/index.ts`)
No changes needed — the proxy already supports `apiPrefix: "wp/v2"` and arbitrary endpoints. The plugins endpoint `wp/v2/plugins?status=active` will work through the existing proxy with WooCommerce consumer key auth (which has WordPress application password scope).

> **Note**: The `wp/v2/plugins` endpoint requires admin-level authentication. If the WooCommerce API keys don't have sufficient permissions, the call may return 401. We'll handle this gracefully with a fallback message.

### Files to Modify

| File | Change |
|------|--------|
| `woo_connections` table | Add `active_plugins text[]` column |
| `src/pages/Settings.tsx` | Add plugins fetch, display, selection, and persistence |

