

## Switch Plugin Detection from WP REST API to WooCommerce System Status

### Problem
The current implementation calls `wp/v2/plugins?status=active` which requires WordPress admin privileges. Even if the WooCommerce API keys belong to an admin user, WooCommerce consumer key/secret auth doesn't grant WordPress admin scope — so the endpoint returns 401.

### Solution
Use the WooCommerce `wc/v3/system_status` endpoint instead, which already works with WooCommerce consumer key auth. The response includes an `active_plugins` array with objects containing `plugin`, `name`, `version`, `url`, `author_name`, etc.

The `test` action in `woo-proxy` already calls `system_status` — so we know this endpoint works with the existing credentials.

### Changes

#### File: `src/pages/Settings.tsx`

Update `fetchPlugins` (line 150-161) to call `wc/v3` system_status instead of `wp/v2/plugins`:

```typescript
const fetchPlugins = async (url: string, ck: string, cs: string) => {
  setLoadingPlugins(true);
  try {
    const { data, error } = await supabase.functions.invoke("woo-proxy", {
      body: { endpoint: "system_status", storeUrl: url, consumerKey: ck, consumerSecret: cs },
    });
    if (error) throw error;
    if (data?.active_plugins && Array.isArray(data.active_plugins)) {
      setPlugins(data.active_plugins.map((p: any) => ({
        plugin: p.plugin,
        name: p.name,
        version: p.version,
      })));
    }
  } catch { /* silent */ }
  finally { setLoadingPlugins(false); }
};
```

Key difference: uses default `apiPrefix` (`wc/v3`), endpoint `system_status`, and reads `data.active_plugins` from the response object (not the response itself as an array).

No other files need changes — the proxy, database column, UI rendering, and save logic all remain the same.

