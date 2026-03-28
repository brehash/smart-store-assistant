import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI embeddings error (${resp.status}): ${err}`);
  }
  const data = await resp.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {});

    // Verify user
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "embed_and_store") {
      const { content, memory_type = "conversation_summary", metadata = {} } = body;
      if (!content) {
        return new Response(JSON.stringify({ error: "content is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const embedding = await generateEmbedding(content, OPENAI_API_KEY);

      const { error: insertErr } = await serviceClient.from("memory_embeddings").insert({
        user_id: userId,
        content,
        embedding: JSON.stringify(embedding),
        memory_type,
        metadata,
      });

      if (insertErr) throw new Error(`Insert error: ${insertErr.message}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "search") {
      const { query, match_count = 5, threshold = 0.7 } = body;
      if (!query) {
        return new Response(JSON.stringify({ error: "query is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const embedding = await generateEmbedding(query, OPENAI_API_KEY);

      const { data: matches, error: rpcErr } = await serviceClient.rpc("match_memories", {
        _user_id: userId,
        _embedding: JSON.stringify(embedding),
        _match_count: match_count,
        _match_threshold: threshold,
      });

      if (rpcErr) throw new Error(`RPC error: ${rpcErr.message}`);

      return new Response(JSON.stringify({ matches: matches || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'embed_and_store' or 'search'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("embeddings error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
