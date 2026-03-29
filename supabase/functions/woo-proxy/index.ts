import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, storeUrl, consumerKey, consumerSecret, endpoint, method, body, apiPrefix } = await req.json();
    
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
      let conn = (await supabase
        .from("woo_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()).data;

      // Fallback: resolve through team membership using service client
      if (!conn) {
        const svcClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: membership } = await svcClient
          .from("team_members")
          .select("team_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (membership) {
          const { data: team } = await svcClient
            .from("teams")
            .select("owner_id")
            .eq("id", membership.team_id)
            .single();
          if (team) {
            conn = (await svcClient
              .from("woo_connections")
              .select("*")
              .eq("user_id", team.owner_id)
              .eq("is_active", true)
              .limit(1)
              .maybeSingle()).data;
          }
        }
      }

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
    const prefix = apiPrefix || "wc/v3";
    
    if (action === "test") {
      const wooUrl = `${baseUrl}/wp-json/wc/v3/system_status?consumer_key=${ck}&consumer_secret=${cs}`;
      const resp = await fetch(wooUrl);
      if (!resp.ok) throw new Error(`WooCommerce returned ${resp.status}`);
      const data = await resp.json();
      return new Response(JSON.stringify({ success: true, name: data?.settings?.store_name || data?.environment?.site_url || baseUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Proxy generic WooCommerce/WordPress API calls
    const wooEndpoint = endpoint || "";
    const separator = wooEndpoint.includes("?") ? "&" : "?";
    const wooUrl = `${baseUrl}/wp-json/${prefix}/${wooEndpoint}${separator}consumer_key=${ck}&consumer_secret=${cs}`;

    const fetchOptions: RequestInit = {
      method: method || "GET",
      headers: { "Content-Type": "application/json" },
    };
    if (body && (method === "POST" || method === "PUT" || method === "DELETE")) {
      fetchOptions.body = JSON.stringify(body);
    }

    const wooResp = await fetch(wooUrl, fetchOptions);
    let wooData: any;
    const rawText = await wooResp.text();
    try {
      wooData = JSON.parse(rawText);
    } catch {
      console.error("woo-proxy: Failed to parse WooCommerce response, length:", rawText.length);
      wooData = { error: "Invalid JSON from WooCommerce", status: wooResp.status };
    }

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
