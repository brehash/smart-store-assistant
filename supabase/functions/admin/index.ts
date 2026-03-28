import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {});

    // Verify user identity using service client with the user's token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authErr } = await serviceClient.auth.getUser(token);
    if (authErr || !authUser) {
      console.error("Admin auth error:", authErr);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authUser.id;

    // Verify admin role using service client (bypasses RLS)
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/admin\/?/, "").replace(/\/$/, "");

    // Route: GET /users
    if (req.method === "GET" && (path === "" || path === "users")) {
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      // Enrich with message counts and token usage
      const enriched = await Promise.all((profiles || []).map(async (p: any) => {
        const { count: messageCount } = await serviceClient
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("user_id", p.user_id);

        const { data: tokenData } = await serviceClient
          .from("messages")
          .select("token_usage")
          .eq("user_id", p.user_id)
          .not("token_usage", "is", null);

        let totalTokens = 0;
        if (tokenData) {
          for (const m of tokenData) {
            totalTokens += (m.token_usage as any)?.total_tokens || 0;
          }
        }

        const { data: limits } = await serviceClient
          .from("message_limits")
          .select("daily_limit, monthly_limit")
          .eq("user_id", p.user_id)
          .maybeSingle();

        const { data: roles } = await serviceClient
          .from("user_roles")
          .select("role")
          .eq("user_id", p.user_id);

        return {
          ...p,
          message_count: messageCount || 0,
          total_tokens: totalTokens,
          limits: limits || null,
          roles: (roles || []).map((r: any) => r.role),
        };
      }));

      return new Response(JSON.stringify(enriched), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: GET /users/:id/messages
    const userMsgsMatch = path.match(/^users\/([^/]+)\/messages$/);
    if (req.method === "GET" && userMsgsMatch) {
      const targetUserId = userMsgsMatch[1];
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = (page - 1) * limit;

      const { data: conversations } = await serviceClient
        .from("conversations")
        .select("*")
        .eq("user_id", targetUserId)
        .order("updated_at", { ascending: false });

      const { data: messages, count } = await serviceClient
        .from("messages")
        .select("*", { count: "exact" })
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      return new Response(JSON.stringify({ conversations, messages, total: count, page, limit }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: PUT /users/:id/limits
    const limitsMatch = path.match(/^users\/([^/]+)\/limits$/);
    if (req.method === "PUT" && limitsMatch) {
      const targetUserId = limitsMatch[1];
      const body = await req.json();
      const { daily_limit, monthly_limit } = body;

      const { data, error } = await serviceClient
        .from("message_limits")
        .upsert(
          { user_id: targetUserId, daily_limit, monthly_limit },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: PUT /users/:id/role
    const roleMatch = path.match(/^users\/([^/]+)\/role$/);
    if (req.method === "PUT" && roleMatch) {
      const targetUserId = roleMatch[1];
      const body = await req.json();
      const { role, action } = body; // action: "add" | "remove"

      if (action === "remove") {
        await serviceClient.from("user_roles").delete().eq("user_id", targetUserId).eq("role", role);
      } else {
        await serviceClient.from("user_roles").upsert({ user_id: targetUserId, role }, { onConflict: "user_id,role" });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: GET /stats
    if (req.method === "GET" && path === "stats") {
      const { count: totalUsers } = await serviceClient
        .from("profiles")
        .select("id", { count: "exact", head: true });

      const { count: totalMessages } = await serviceClient
        .from("messages")
        .select("id", { count: "exact", head: true });

      const { count: totalConversations } = await serviceClient
        .from("conversations")
        .select("id", { count: "exact", head: true });

      // Token usage last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: recentTokens } = await serviceClient
        .from("messages")
        .select("token_usage, created_at")
        .not("token_usage", "is", null)
        .gte("created_at", weekAgo.toISOString());

      const dailyTokens: Record<string, number> = {};
      for (const m of recentTokens || []) {
        const day = (m.created_at as string).split("T")[0];
        dailyTokens[day] = (dailyTokens[day] || 0) + ((m.token_usage as any)?.total_tokens || 0);
      }

      const tokenChart = Object.entries(dailyTokens)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, value]) => ({ name, value }));

      return new Response(JSON.stringify({
        total_users: totalUsers || 0,
        total_messages: totalMessages || 0,
        total_conversations: totalConversations || 0,
        token_usage_7d: tokenChart,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: GET /users/:id/credits
    const creditsGetMatch = path.match(/^users\/([^/]+)\/credits$/);
    if (req.method === "GET" && creditsGetMatch) {
      const targetUserId = creditsGetMatch[1];
      const { data: balance } = await serviceClient
        .from("credit_balances")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();
      const { data: transactions } = await serviceClient
        .from("credit_transactions")
        .select("*")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(50);
      return new Response(JSON.stringify({ balance, transactions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: PUT /users/:id/credits (grant/deduct)
    const creditsPutMatch = path.match(/^users\/([^/]+)\/credits$/);
    if (req.method === "PUT" && creditsPutMatch) {
      const targetUserId = creditsPutMatch[1];
      const body = await req.json();
      const { amount, reason } = body;
      // Get current balance
      let { data: bal } = await serviceClient
        .from("credit_balances")
        .select("balance")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (!bal) {
        await serviceClient.from("credit_balances").insert({ user_id: targetUserId });
        bal = { balance: 100 };
      }
      const newBalance = Math.max(0, (bal.balance || 0) + amount);
      await serviceClient
        .from("credit_balances")
        .update({ balance: newBalance })
        .eq("user_id", targetUserId);
      await serviceClient.from("credit_transactions").insert({
        user_id: targetUserId,
        amount,
        balance_after: newBalance,
        reason: reason || "admin_grant",
      });
      return new Response(JSON.stringify({ balance: newBalance }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: PUT /users/:id/allowance
    const allowanceMatch = path.match(/^users\/([^/]+)\/allowance$/);
    if (req.method === "PUT" && allowanceMatch) {
      const targetUserId = allowanceMatch[1];
      const body = await req.json();
      const { monthly_allowance } = body;
      await serviceClient
        .from("credit_balances")
        .upsert({ user_id: targetUserId, monthly_allowance }, { onConflict: "user_id" });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Admin error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
