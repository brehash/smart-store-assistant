import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const logDetails: any[] = [];
  let totalOrdersScanned = 0;
  let totalOrdersCompleted = 0;
  let totalErrors = 0;

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
      const durationMs = Date.now() - startTime;
      await supabase.from("cron_job_logs").insert({
        job_name: "colete_online_tracker",
        status: "no_integrations",
        summary: { integrations_checked: 0, orders_scanned: 0, orders_completed: 0, errors: 0 },
        details: [],
        duration_ms: durationMs,
      });
      return new Response(JSON.stringify({ message: "No enabled Colete Online integrations" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const integration of integrations) {
      const userId = integration.user_id;
      const config = integration.config as { client_id?: string; client_secret?: string };
      const userLog: any = {
        userId,
        storeName: null,
        authStatus: "skipped",
        ordersScanned: 0,
        ordersWithAwb: 0,
        ordersCompleted: 0,
        completedOrders: [],
        errors: [],
      };

      if (!config.client_id || !config.client_secret) {
        userLog.authStatus = "missing_credentials";
        logDetails.push(userLog);
        continue;
      }

      // 2. Get user's WooCommerce connection
      const { data: conn } = await supabase
        .from("woo_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!conn) {
        userLog.authStatus = "no_woo_connection";
        logDetails.push(userLog);
        continue;
      }

      userLog.storeName = conn.store_name || conn.store_url;

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
        userLog.authStatus = `failed_${tokenResp.status}`;
        userLog.errors.push({ step: "auth", error: `HTTP ${tokenResp.status}` });
        totalErrors++;
        logDetails.push(userLog);
        continue;
      }

      userLog.authStatus = "success";
      const tokenData = await tokenResp.json();
      const accessToken = tokenData.access_token;

      // 4. Fetch non-completed orders from WooCommerce
      const excludeStatuses = ["completed", "cancelled", "refunded", "failed", "trash"];
      const baseUrl = conn.store_url.replace(/\/+$/, "");
      const ck = conn.consumer_key;
      const cs = conn.consumer_secret;

      let page = 1;
      let processedCount = 0;

      while (true) {
        const orderUrl = `${baseUrl}/wp-json/wc/v3/orders?per_page=50&page=${page}&consumer_key=${ck}&consumer_secret=${cs}`;
        const ordersResp = await fetch(orderUrl);
        if (!ordersResp.ok) {
          userLog.errors.push({ step: "fetch_orders", error: `HTTP ${ordersResp.status}`, page });
          totalErrors++;
          break;
        }

        const orders = await ordersResp.json();
        if (!Array.isArray(orders) || orders.length === 0) break;

        for (const order of orders) {
          if (excludeStatuses.includes(order.status)) continue;
          userLog.ordersScanned++;
          totalOrdersScanned++;

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

          userLog.ordersWithAwb++;

          // 6. Check status via Colete Online API
          const statusResp = await fetch(`https://api.colete-online.ro/v1/order/status/${uniqueId}`, {
            headers: { "Authorization": `Bearer ${accessToken}` },
          });

          if (!statusResp.ok) {
            userLog.errors.push({ step: "check_status", orderId: order.id, awb, error: `HTTP ${statusResp.status}` });
            totalErrors++;
            continue;
          }

          const statusData = await statusResp.json();
          const history = statusData.history;
          if (!Array.isArray(history) || history.length === 0) continue;

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
              userLog.ordersCompleted++;
              totalOrdersCompleted++;
              userLog.completedOrders.push({ orderId: order.id, awb, uniqueId });
              console.log(`Order #${order.id} (AWB: ${awb}) marked as completed`);
            } else {
              const errMsg = `HTTP ${updateResp.status}`;
              userLog.errors.push({ step: "update_order", orderId: order.id, awb, error: errMsg });
              totalErrors++;
            }
          }
        }

        if (orders.length < 50) break;
        page++;
      }

      logDetails.push(userLog);
      results.push({ userId, processedCount });
    }

    // Insert cron job log
    const durationMs = Date.now() - startTime;
    await supabase.from("cron_job_logs").insert({
      job_name: "colete_online_tracker",
      status: totalErrors > 0 ? "error" : "success",
      summary: {
        integrations_checked: integrations.length,
        orders_scanned: totalOrdersScanned,
        orders_completed: totalOrdersCompleted,
        errors: totalErrors,
      },
      details: logDetails,
      duration_ms: durationMs,
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Log error run
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceRoleKey) {
      try {
        const sb = createClient(supabaseUrl, serviceRoleKey);
        await sb.from("cron_job_logs").insert({
          job_name: "colete_online_tracker",
          status: "error",
          summary: {
            integrations_checked: 0,
            orders_scanned: totalOrdersScanned,
            orders_completed: totalOrdersCompleted,
            errors: totalErrors + 1,
            fatal_error: e instanceof Error ? e.message : "Unknown error",
          },
          details: logDetails,
          duration_ms: Date.now() - startTime,
        });
      } catch { /* ignore logging failure */ }
    }

    console.error("colete-online-tracker error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
