import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── Test Connection action (kept as-is) ──
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

    // ── Orchestrator: dispatch workers ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all enabled Colete Online integrations
    const { data: integrations, error: intErr } = await supabase
      .from("woo_integrations")
      .select("id, user_id")
      .eq("integration_key", "colete_online")
      .eq("is_enabled", true);

    if (intErr) throw intErr;

    if (!integrations || integrations.length === 0) {
      await supabase.from("cron_job_logs").insert({
        job_name: "colete_online_tracker",
        status: "no_integrations",
        summary: { integrations_checked: 0, workers_dispatched: 0 },
        details: [],
        duration_ms: Date.now() - startTime,
      });
      return new Response(JSON.stringify({ message: "No enabled Colete Online integrations" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fan-out: invoke worker for each integration with concurrency limit of 10
    const workerUrl = `${supabaseUrl}/functions/v1/colete-online-worker`;
    const concurrencyLimit = 10;
    const results: { integration_id: string; status: string; error?: string }[] = [];

    for (let i = 0; i < integrations.length; i += concurrencyLimit) {
      const batch = integrations.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.allSettled(
        batch.map(async (integration) => {
          try {
            const resp = await fetch(workerUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({ integration_id: integration.id }),
            });
            const body = await resp.text();
            return { integration_id: integration.id, status: resp.ok ? "dispatched" : "failed", error: resp.ok ? undefined : body.slice(0, 200) };
          } catch (e) {
            return { integration_id: integration.id, status: "failed", error: e instanceof Error ? e.message : "Unknown" };
          }
        })
      );

      for (const r of batchResults) {
        results.push(r.status === "fulfilled" ? r.value : { integration_id: "unknown", status: "rejected", error: String(r.reason) });
      }
    }

    const dispatched = results.filter(r => r.status === "dispatched").length;
    const failed = results.filter(r => r.status !== "dispatched").length;

    // Log orchestrator summary
    await supabase.from("cron_job_logs").insert({
      job_name: "colete_online_tracker",
      status: failed > 0 ? "partial" : "success",
      summary: {
        integrations_checked: integrations.length,
        workers_dispatched: dispatched,
        workers_failed: failed,
      },
      details: results,
      duration_ms: Date.now() - startTime,
    });

    return new Response(JSON.stringify({ success: true, dispatched, failed, total: integrations.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceRoleKey) {
      try {
        const sb = createClient(supabaseUrl, serviceRoleKey);
        await sb.from("cron_job_logs").insert({
          job_name: "colete_online_tracker",
          status: "error",
          summary: { fatal_error: e instanceof Error ? e.message : "Unknown error" },
          details: [],
          duration_ms: Date.now() - startTime,
        });
      } catch { /* ignore */ }
    }
    console.error("colete-online-tracker orchestrator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
