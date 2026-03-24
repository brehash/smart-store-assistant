import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, storeUrl, consumerKey, consumerSecret, endpoint, method, body } = await req.json();
    
    let url = storeUrl;
    let ck = consumerKey;
    let cs = consumerSecret;

    // If no direct credentials, get from DB using auth token
    if (!ck || !cs) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
        authHeader.replace("Bearer ", "")
      );
      if (claimsErr || !claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = claims.claims.sub;
      const { data: conn } = await supabase
        .from("woo_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!conn) {
        return new Response(JSON.stringify({ error: "No WooCommerce connection configured. Go to Settings to add your store." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      url = conn.store_url;
      ck = conn.consumer_key;
      cs = conn.consumer_secret;
    }

    // Normalize URL
    const baseUrl = url.replace(/\/+$/, "");
    
    if (action === "test") {
      const wooUrl = `${baseUrl}/wp-json/wc/v3/system_status?consumer_key=${ck}&consumer_secret=${cs}`;
      const resp = await fetch(wooUrl);
      if (!resp.ok) throw new Error(`WooCommerce returned ${resp.status}`);
      const data = await resp.json();
      return new Response(JSON.stringify({ success: true, name: data?.settings?.store_name || data?.environment?.site_url || baseUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Proxy generic WooCommerce API calls
    const wooEndpoint = endpoint || "";
    const separator = wooEndpoint.includes("?") ? "&" : "?";
    const wooUrl = `${baseUrl}/wp-json/wc/v3/${wooEndpoint}${separator}consumer_key=${ck}&consumer_secret=${cs}`;

    const fetchOptions: RequestInit = {
      method: method || "GET",
      headers: { "Content-Type": "application/json" },
    };
    if (body && (method === "POST" || method === "PUT")) {
      fetchOptions.body = JSON.stringify(body);
    }

    const wooResp = await fetch(wooUrl, fetchOptions);
    const wooData = await wooResp.json();

    return new Response(JSON.stringify(wooData), {
      status: wooResp.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("woo-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
