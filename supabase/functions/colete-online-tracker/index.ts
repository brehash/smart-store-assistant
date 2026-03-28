import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── Test Connection action ──
    if (action === "test") {
      const { client_id, client_secret } = await req.json();
      if (!client_id || !client_secret) {
        return new Response(JSON.stringify({ success: false, error: "Client ID and Client Secret are required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const basicAuth = btoa(`${client_id}:${client_secret}`);
      const tokenResp = await fetch("https://auth.colete-online.ro/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${basicAuth}`,
        },
        body: "grant_type=client_credentials",
      });

      if (!tokenResp.ok) {
        const errText = await tokenResp.text();
        return new Response(JSON.stringify({ success: false, error: `Authentication failed (${tokenResp.status}): ${errText.slice(0, 200)}` }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenData = await tokenResp.json();
      return new Response(JSON.stringify({ success: true, message: "Connection successful!", expires_in: tokenData.expires_in }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Default: tracker action ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get all users with Colete Online enabled
    const { data: integrations, error: intErr } = await supabase
      .from("woo_integrations")
      .select("*")
      .eq("integration_key", "colete_online")
      .eq("is_enabled", true);

    if (intErr) throw intErr;
    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: "No enabled Colete Online integrations" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const integration of integrations) {
      const userId = integration.user_id;
      const config = integration.config as { client_id?: string; client_secret?: string };
      if (!config.client_id || !config.client_secret) continue;

      // 2. Get user's WooCommerce connection
      const { data: conn } = await supabase
        .from("woo_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!conn) continue;

      // 3. Authenticate with Colete Online
      const basicAuth = btoa(`${config.client_id}:${config.client_secret}`);
      const tokenResp = await fetch("https://auth.colete-online.ro/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${basicAuth}`,
        },
        body: "grant_type=client_credentials",
      });

      if (!tokenResp.ok) {
        console.error(`Colete Online auth failed for user ${userId}: ${tokenResp.status}`);
        continue;
      }

      const tokenData = await tokenResp.json();
      const accessToken = tokenData.access_token;

      // 4. Fetch non-completed orders from WooCommerce
      // Get all statuses except 'completed' and 'cancelled' and 'refunded' and 'failed' and 'trash'
      const excludeStatuses = ["completed", "cancelled", "refunded", "failed", "trash"];
      const baseUrl = conn.store_url.replace(/\/+$/, "");
      const ck = conn.consumer_key;
      const cs = conn.consumer_secret;

      let page = 1;
      let processedCount = 0;

      while (true) {
        const orderUrl = `${baseUrl}/wp-json/wc/v3/orders?per_page=50&page=${page}&consumer_key=${ck}&consumer_secret=${cs}`;
        const ordersResp = await fetch(orderUrl);
        if (!ordersResp.ok) break;

        const orders = await ordersResp.json();
        if (!Array.isArray(orders) || orders.length === 0) break;

        for (const order of orders) {
          if (excludeStatuses.includes(order.status)) continue;

          // 5. Check for _coleteonline_courier_order meta
          const meta = order.meta_data?.find((m: any) => m.key === "_coleteonline_courier_order");
          if (!meta?.value) continue;

          let metaValue = meta.value;
          if (typeof metaValue === "string") {
            try { metaValue = JSON.parse(metaValue); } catch { continue; }
          }

          const uniqueId = metaValue?.result?.uniqueId;
          const awb = metaValue?.result?.awb;
          if (!uniqueId) continue;

          // 6. Check status via Colete Online API
          const statusResp = await fetch(`https://api.colete-online.ro/v1/order/status/${uniqueId}`, {
            headers: { "Authorization": `Bearer ${accessToken}` },
          });

          if (!statusResp.ok) {
            console.error(`Colete Online status check failed for uniqueId ${uniqueId}: ${statusResp.status}`);
            continue;
          }

          const statusData = await statusResp.json();
          const history = statusData.history;
          if (!Array.isArray(history) || history.length === 0) continue;

          // Get latest status by checking for delivered code
          const isDelivered = history.some((h: any) => h.code === 20800);

          if (isDelivered) {
            // 7. Update order status to completed
            const updateUrl = `${baseUrl}/wp-json/wc/v3/orders/${order.id}?consumer_key=${ck}&consumer_secret=${cs}`;
            const updateResp = await fetch(updateUrl, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "completed" }),
            });

            if (updateResp.ok) {
              processedCount++;
              console.log(`Order #${order.id} (AWB: ${awb}) marked as completed`);
            } else {
              console.error(`Failed to update order #${order.id}: ${updateResp.status}`);
            }
          }
        }

        if (orders.length < 50) break;
        page++;
      }

      results.push({ userId, processedCount });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("colete-online-tracker error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
