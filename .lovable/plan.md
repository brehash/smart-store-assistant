

## Add "Integrations" Settings Tab + Colete Online Integration

### Overview
Add a new "Integrations" tab to Settings where users can enable/disable third-party integrations. The first integration is **Colete Online** — a Romanian shipping aggregator. When enabled, a scheduled edge function runs every 2 hours to check AWB statuses and automatically mark orders as "completed" when delivered (status code `20800`).

### Architecture

```text
Settings UI (Integrations tab)
  └─ Toggle: Colete Online [on/off]
  └─ Inputs: Client ID, Client Secret
  └─ Save → woo_integrations table

Edge Function: colete-online-tracker (runs every 2h via pg_cron)
  1. Get all users with Colete Online enabled
  2. For each user, fetch non-completed orders via woo-proxy
  3. Extract AWB uniqueId from _coleteonline_courier_order meta
  4. Call Colete Online API: GET /order/status/{uniqueId}
  5. If latest status code == 20800 → update order to "completed" via woo-proxy
```

### Database Changes

**New table: `woo_integrations`** — stores per-user integration configs:
```sql
CREATE TABLE public.woo_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  integration_key text NOT NULL,        -- 'colete_online'
  is_enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}',   -- {client_id, client_secret}
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, integration_key)
);
ALTER TABLE public.woo_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own integrations" ON public.woo_integrations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### File Changes

| File | Change |
|------|--------|
| DB migration | Create `woo_integrations` table |
| `src/pages/Settings.tsx` | Add "Integrations" tab with Colete Online card (toggle + client ID/secret inputs) |
| `supabase/functions/colete-online-tracker/index.ts` | New edge function: authenticate with Colete Online API, check AWB statuses, update delivered orders |
| pg_cron job (via insert tool) | Schedule the edge function every 2 hours |

### Settings UI — Integrations Tab

- New tab with `Plug` icon labeled "Integrations"
- Card for "Colete Online" with:
  - Enable/disable switch
  - Client ID input
  - Client Secret input (password field)
  - Save button
  - Description explaining it auto-tracks shipments and marks orders as delivered

### Edge Function: `colete-online-tracker`

1. **Auth**: POST to `https://auth.colete-online.ro/token` with `grant_type: client_credentials` and Basic auth header (base64 of `clientId:clientSecret`)
2. **For each enabled user**:
   - Use service role to read their `woo_connections` credentials
   - Fetch orders with statuses that are NOT "completed" (use `woo-proxy` internally or direct WooCommerce API call)
   - For each order, check `meta_data` for key `_coleteonline_courier_order`
   - Parse the JSON value to extract `result.uniqueId` and `result.awb`
   - Call `GET https://api.colete-online.ro/v1/order/status/{uniqueId}` with Bearer token
   - If the latest history entry has `code: 20800` (delivered), update the order status to "completed" via WooCommerce API
3. **Security**: Uses service role key to read all enabled integrations; WooCommerce credentials stay server-side

### Secrets Needed
- Colete Online Client ID and Client Secret are stored per-user in the `woo_integrations.config` JSONB column (not as edge function secrets), since each user has their own credentials.

