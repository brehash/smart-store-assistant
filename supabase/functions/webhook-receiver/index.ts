import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("uid");

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing uid parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let topic = req.headers.get("x-wc-webhook-topic") || "unknown";

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      // body may be empty for ping events
    }

    // Detect WooCommerce webhook ping/verification requests — skip DB insert
    const isPing =
      topic === "unknown" ||
      topic.startsWith("action.") ||
      (payload && payload.webhook_id && !payload.id && !payload.number && !payload.email);

    if (isPing) {
      return new Response(JSON.stringify({ ok: true, skipped: "ping" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase.from("webhook_events").insert({
      user_id: userId,
      topic,
      payload,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook-receiver error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
