import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ORDERS = 200;
const STATUS_CHECK_BATCH_SIZE = 5;
const WOO_UPDATE_DELAY_MS = 100;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let integrationId = "";
  const userLog: any = {
    userId: null,
    storeName: null,
    authStatus: "skipped",
    ordersScanned: 0,
    ordersWithAwb: 0,
    ordersCompleted: 0,
    ordersReturned: 0,
    checkedOrders: [],
    errors: [],
  };

  try {
    const body = await req.json();
    integrationId = body.integration_id;

    if (!integrationId) {
      return new Response(JSON.stringify({ error: "integration_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch the integration
    const { data: integration, error: intErr } = await supabase
      .from("woo_integrations")
      .select("*")
      .eq("id", integrationId)
      .eq("integration_key", "colete_online")
      .eq("is_enabled", true)
      .single();

    if (intErr || !integration) {
      return new Response(JSON.stringify({ error: "Integration not found or disabled" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = integration.user_id;
    userLog.userId = userId;
    const config = integration.config as { client_id?: string; client_secret?: string };

    if (!config.client_id || !config.client_secret) {
      userLog.authStatus = "missing_credentials";
      await writeLog(supabase, integrationId, userLog, startTime);
      return new Response(JSON.stringify({ error: "Missing credentials" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get WooCommerce connection
    const { data: conn } = await supabase
      .from("woo_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!conn) {
      userLog.authStatus = "no_woo_connection";
      await writeLog(supabase, integrationId, userLog, startTime);
      return new Response(JSON.stringify({ error: "No WooCommerce connection" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      await writeLog(supabase, integrationId, userLog, startTime);
      return new Response(JSON.stringify({ error: "Auth failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    userLog.authStatus = "success";
    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token;

    // 4. Fetch non-completed orders from WooCommerce (paginated, max MAX_ORDERS)
    const excludeStatuses = ["completed", "cancelled", "refunded", "failed", "trash", "refuzata"];
    const baseUrl = conn.store_url.replace(/\/+$/, "");
    const ck = conn.consumer_key;
    const cs = conn.consumer_secret;

    // Collect orders with AWB metadata
    const ordersToCheck: { order: any; uniqueId: string; awb: string }[] = [];
    let page = 1;
    let totalScanned = 0;

    orderLoop:
    while (totalScanned < MAX_ORDERS) {
      const orderUrl = `${baseUrl}/wp-json/wc/v3/orders?per_page=50&page=${page}&consumer_key=${ck}&consumer_secret=${cs}`;
      const ordersResp = await fetch(orderUrl);

      if (!ordersResp.ok) {
        userLog.errors.push({ step: "fetch_orders", error: `HTTP ${ordersResp.status}`, page });
        break;
      }

      const orders = await ordersResp.json();
      if (!Array.isArray(orders) || orders.length === 0) break;

      for (const order of orders) {
        if (totalScanned >= MAX_ORDERS) break orderLoop;
        if (excludeStatuses.includes(order.status)) continue;

        totalScanned++;
        userLog.ordersScanned++;

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
        ordersToCheck.push({ order, uniqueId, awb: awb || "" });
      }

      if (orders.length < 50) break;
      page++;
    }

    // 5. Check statuses in parallel batches
    for (let i = 0; i < ordersToCheck.length; i += STATUS_CHECK_BATCH_SIZE) {
      const batch = ordersToCheck.slice(i, i + STATUS_CHECK_BATCH_SIZE);
      const statusResults = await Promise.allSettled(
        batch.map(async ({ order, uniqueId, awb }) => {
          const statusResp = await fetch(`https://api.colete-online.ro/v1/order/status/${uniqueId}`, {
            headers: { "Authorization": `Bearer ${accessToken}` },
          });

          if (!statusResp.ok) {
            const errText = await statusResp.text();
            return { order, uniqueId, awb, delivered: false, error: `HTTP ${statusResp.status}`, latestStatus: null, latestCode: null };
          }

          const statusData = await statusResp.json();
          const history = statusData.history;
          if (!Array.isArray(history) || history.length === 0) {
            return { order, uniqueId, awb, delivered: false, error: null, latestStatus: null, latestCode: null, noHistory: true };
          }

          const latest = history[history.length - 1];
          const latestStatus = latest?.status || latest?.description || null;
          const latestCode = latest?.code ?? latest?.status_id ?? null;
          const isDelivered = history.some((h: any) => h.code === 20800 || h.code === 30500);

          return { order, uniqueId, awb, delivered: isDelivered, error: null, latestStatus, latestCode };
        })
      );

      // Process results: update delivered orders
      for (const r of statusResults) {
        if (r.status === "rejected") {
          userLog.errors.push({ step: "check_status", error: String(r.reason) });
          continue;
        }
        const { order, uniqueId, awb, delivered, error, latestStatus, latestCode, noHistory } = r.value as any;

        if (error) {
          userLog.errors.push({ step: "check_status", orderId: order.id, awb, error });
          userLog.checkedOrders.push({ orderId: order.id, awb, uniqueId, wooStatus: order.status, shippingStatus: latestStatus, shippingCode: latestCode, action: "error" });
          continue;
        }

        if (noHistory) {
          userLog.checkedOrders.push({ orderId: order.id, awb, uniqueId, wooStatus: order.status, shippingStatus: null, shippingCode: null, action: "no_history" });
          continue;
        }

        if (delivered) {
          // Update WooCommerce order to completed
          const updateUrl = `${baseUrl}/wp-json/wc/v3/orders/${order.id}?consumer_key=${ck}&consumer_secret=${cs}`;
          const updateResp = await fetch(updateUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "completed" }),
          });

          if (updateResp.ok) {
            await updateResp.text(); // consume body
            userLog.ordersCompleted++;
            userLog.checkedOrders.push({ orderId: order.id, awb, uniqueId, wooStatus: order.status, shippingStatus: latestStatus, shippingCode: latestCode, action: "completed" });
            console.log(`Order #${order.id} (AWB: ${awb}) marked as completed`);
          } else {
            const errText = await updateResp.text();
            userLog.errors.push({ step: "update_order", orderId: order.id, awb, error: `HTTP ${updateResp.status}` });
            userLog.checkedOrders.push({ orderId: order.id, awb, uniqueId, wooStatus: order.status, shippingStatus: latestStatus, shippingCode: latestCode, action: "error" });
          }

          // Rate limit safety
          await delay(WOO_UPDATE_DELAY_MS);
        } else {
          userLog.checkedOrders.push({ orderId: order.id, awb, uniqueId, wooStatus: order.status, shippingStatus: latestStatus, shippingCode: latestCode, action: "in_transit" });
        }
      }
    }

    await writeLog(supabase, integrationId, userLog, startTime);

    return new Response(JSON.stringify({
      success: true,
      ordersScanned: userLog.ordersScanned,
      ordersCompleted: userLog.ordersCompleted,
      errors: userLog.errors.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    userLog.errors.push({ step: "fatal", error: e instanceof Error ? e.message : "Unknown" });
    try {
      await writeLog(supabase, integrationId, userLog, startTime);
    } catch { /* ignore */ }

    console.error(`colete-online-worker error (integration: ${integrationId}):`, e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function writeLog(supabase: any, integrationId: string, userLog: any, startTime: number) {
  await supabase.from("cron_job_logs").insert({
    job_name: "colete_online_worker",
    status: userLog.errors.length > 0 ? "error" : "success",
    summary: {
      integration_id: integrationId,
      user_id: userLog.userId,
      store_name: userLog.storeName,
      orders_scanned: userLog.ordersScanned,
      orders_with_awb: userLog.ordersWithAwb,
      orders_completed: userLog.ordersCompleted,
      errors: userLog.errors.length,
    },
    details: [userLog],
    duration_ms: Date.now() - startTime,
  });
}
