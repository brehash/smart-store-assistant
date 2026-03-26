import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search WooCommerce products by name, SKU, or category.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search query for product name/SKU" },
          category: { type: "string", description: "Category slug to filter by" },
          per_page: { type: "number", description: "Number of results (default 10)" },
        },
        required: ["search"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product",
      description: "Get full details of a specific product by ID",
      parameters: {
        type: "object",
        properties: { product_id: { type: "number", description: "WooCommerce product ID" } },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_orders",
      description: "Search orders by status, customer, or date range",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Order status: pending, processing, completed, etc." },
          search: { type: "string", description: "Search by customer name or order number" },
          after: { type: "string", description: "Orders after this date (ISO 8601)" },
          before: { type: "string", description: "Orders before this date (ISO 8601)" },
          per_page: { type: "number", description: "Number of results (default 10)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_order",
      description: "Create a new WooCommerce order with specified products and quantities",
      parameters: {
        type: "object",
        properties: {
          line_items: {
            type: "array",
            items: {
              type: "object",
              properties: { product_id: { type: "number" }, quantity: { type: "number" } },
              required: ["product_id", "quantity"],
            },
          },
          customer_id: { type: "number", description: "Customer ID (optional)" },
          status: { type: "string", description: "Order status (default: processing)" },
        },
        required: ["line_items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_order_status",
      description: "Update the status of an existing order",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "number", description: "Order ID" },
          status: { type: "string", description: "New status: pending, processing, completed, cancelled, refunded" },
        },
        required: ["order_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sales_report",
      description: "Get sales analytics — revenue, order count, top products, trends. Always use date_min and date_max for accurate results.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Time period: today, week, month, year, or custom" },
          date_min: { type: "string", description: "Start date (YYYY-MM-DD). Always calculate and provide this." },
          date_max: { type: "string", description: "End date (YYYY-MM-DD). Always calculate and provide this." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_sales",
      description: "Compare sales between two date ranges. Returns comparison stats and grouped bar chart.",
      parameters: {
        type: "object",
        properties: {
          period_a_start: { type: "string", description: "Start of period A (YYYY-MM-DD)" },
          period_a_end: { type: "string", description: "End of period A (YYYY-MM-DD)" },
          period_b_start: { type: "string", description: "Start of period B (YYYY-MM-DD)" },
          period_b_end: { type: "string", description: "End of period B (YYYY-MM-DD)" },
          period_a_label: { type: "string", description: "Label for period A (e.g. 'This Month')" },
          period_b_label: { type: "string", description: "Label for period B (e.g. 'Last Month')" },
        },
        required: ["period_a_start", "period_a_end", "period_b_start", "period_b_end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_preference",
      description: "Save a user preference/alias.",
      parameters: {
        type: "object",
        properties: {
          preference_type: { type: "string", enum: ["product_alias", "shortcut", "pattern"] },
          key: { type: "string", description: "The alias or shortcut name" },
          value: { type: "object", description: "The mapped data (e.g., product_id, product_name)" },
        },
        required: ["preference_type", "key", "value"],
      },
    },
  },
];

const WRITE_TOOLS = new Set(["create_order", "update_order_status"]);

const TOOL_LABELS: Record<string, string> = {
  search_products: "Searching products",
  get_product: "Getting product details",
  search_orders: "Searching orders",
  create_order: "Creating order",
  update_order_status: "Updating order status",
  get_sales_report: "Generating sales report",
  compare_sales: "Comparing sales periods",
  save_preference: "Saving preference",
};

async function callWooProxy(supabaseUrl: string, authHeader: string, payload: any) {
  const resp = await fetch(`${supabaseUrl}/functions/v1/woo-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(payload),
  });
  return resp.json();
}

async function executeTool(
  toolName: string, args: any, supabaseUrl: string, authHeader: string, userId: string, supabase: any
): Promise<{ result: any; richContent?: any; requestUri?: string }> {
  switch (toolName) {
    case "search_products": {
      const params = new URLSearchParams();
      params.set("search", args.search);
      if (args.category) params.set("category", args.category);
      params.set("per_page", String(args.per_page || 10));
      const endpoint = `products?${params.toString()}`;
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint });
      return { result: data, richContent: { type: "products", data: Array.isArray(data) ? data : [] }, requestUri: `GET /wp-json/wc/v3/${endpoint}` };
    }
    case "get_product": {
      const endpoint = `products/${args.product_id}`;
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint });
      return { result: data, richContent: { type: "products", data: [data] }, requestUri: `GET /wp-json/wc/v3/${endpoint}` };
    }
    case "search_orders": {
      const params = new URLSearchParams();
      if (args.status) params.set("status", args.status);
      if (args.search) params.set("search", args.search);
      if (args.after) params.set("after", args.after);
      if (args.before) params.set("before", args.before);
      params.set("per_page", String(args.per_page || 10));
      const endpoint = `orders?${params.toString()}`;
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint });
      return { result: data, richContent: { type: "orders", data: Array.isArray(data) ? data : [] }, requestUri: `GET /wp-json/wc/v3/${endpoint}` };
    }
    case "create_order": {
      const endpoint = "orders";
      const data = await callWooProxy(supabaseUrl, authHeader, {
        endpoint, method: "POST",
        body: { line_items: args.line_items, customer_id: args.customer_id || 0, status: args.status || "processing" },
      });
      return { result: data, requestUri: `POST /wp-json/wc/v3/${endpoint}` };
    }
    case "update_order_status": {
      const endpoint = `orders/${args.order_id}`;
      const data = await callWooProxy(supabaseUrl, authHeader, {
        endpoint, method: "PUT", body: { status: args.status },
      });
      return { result: data, requestUri: `PUT /wp-json/wc/v3/${endpoint}` };
    }
    case "get_sales_report": {
      const params = new URLSearchParams();
      params.set("per_page", "100");
      params.set("status", "completed,processing");
      let startDate = args.date_min;
      let endDate = args.date_max;
      const now = new Date();
      if (args.period === "today") {
        startDate = now.toISOString().split("T")[0];
        endDate = startDate;
      } else if (args.period === "week") {
        startDate = new Date(now.getTime() - 6 * 864e5).toISOString().split("T")[0];
        endDate = now.toISOString().split("T")[0];
      } else if (args.period === "month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        endDate = now.toISOString().split("T")[0];
      }
      if (startDate) params.set("after", `${startDate}T00:00:00`);
      if (endDate) params.set("before", `${endDate}T23:59:59`);
      const endpoint = `orders?${params.toString()}`;
      const orders = await callWooProxy(supabaseUrl, authHeader, { endpoint });
      if (!Array.isArray(orders)) return { result: orders, requestUri: `GET /wp-json/wc/v3/${endpoint}` };
      const totalRevenue = orders.reduce((s: number, o: any) => s + parseFloat(o.total || "0"), 0);
      const byDate: Record<string, number> = {};
      orders.forEach((o: any) => {
        const date = o.date_created?.split("T")[0] || "unknown";
        byDate[date] = (byDate[date] || 0) + parseFloat(o.total || "0");
      });
      if (startDate && endDate) {
        const cur = new Date(startDate);
        const end = new Date(endDate);
        while (cur <= end) {
          const key = cur.toISOString().split("T")[0];
          if (!(key in byDate)) byDate[key] = 0;
          cur.setDate(cur.getDate() + 1);
        }
      }
      const chartData = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
      return {
        result: { totalRevenue: Math.round(totalRevenue * 100) / 100, orderCount: orders.length, dailyBreakdown: chartData },
        richContent: { type: "chart", data: { type: "bar", title: `Sales Report (${args.period || "custom"})`, data: chartData, dataKey: "value", nameKey: "name" } },
        requestUri: `GET /wp-json/wc/v3/${endpoint}`,
      };
    }
    case "compare_sales": {
      const fetchPeriod = async (start: string, end: string) => {
        const params = new URLSearchParams();
        params.set("per_page", "100");
        params.set("status", "completed,processing");
        params.set("after", `${start}T00:00:00`);
        params.set("before", `${end}T23:59:59`);
        const orders = await callWooProxy(supabaseUrl, authHeader, { endpoint: `orders?${params.toString()}` });
        if (!Array.isArray(orders)) return { revenue: 0, count: 0 };
        const revenue = orders.reduce((s: number, o: any) => s + parseFloat(o.total || "0"), 0);
        return { revenue: Math.round(revenue * 100) / 100, count: orders.length };
      };
      const a = await fetchPeriod(args.period_a_start, args.period_a_end);
      const b = await fetchPeriod(args.period_b_start, args.period_b_end);
      const labelA = args.period_a_label || "Period A";
      const labelB = args.period_b_label || "Period B";
      const chartData = [
        { name: "Revenue", [labelA]: a.revenue, [labelB]: b.revenue },
        { name: "Orders", [labelA]: a.count, [labelB]: b.count },
      ];
      return {
        result: { [labelA]: a, [labelB]: b, change_revenue: a.revenue - b.revenue, change_orders: a.count - b.count },
        richContent: { type: "chart", data: { type: "grouped_bar", title: `${labelA} vs ${labelB}`, data: chartData, dataKeys: [labelA, labelB], nameKey: "name" } },
        requestUri: `GET /wp-json/wc/v3/orders (x2 periods)`,
      };
    }
    case "save_preference": {
      await supabase.from("user_preferences").upsert(
        { user_id: userId, preference_type: args.preference_type, key: args.key, value: args.value },
        { onConflict: "user_id,preference_type,key" }
      );
      return { result: { success: true, message: `Saved preference: "${args.key}"` } };
    }
    default:
      return { result: { error: `Unknown tool: ${toolName}` } };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });

    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub;

    const { messages, conversationId, approvalResponse } = await req.json();

    const { data: prefs } = await supabase.from("user_preferences").select("preference_type, key, value").eq("user_id", userId);
    let prefsContext = "";
    if (prefs?.length) {
      prefsContext = "\n\nUser's saved preferences/aliases:\n" + prefs.map((p: any) => `- ${p.preference_type}: "${p.key}" → ${JSON.stringify(p.value)}`).join("\n");
    }

    const { data: connData } = await supabase.from("woo_connections").select("response_language, openai_api_key").eq("user_id", userId).eq("is_active", true).maybeSingle();
    const responseLanguage = connData?.response_language || "English";
    const userOpenAIKey = connData?.openai_api_key || null;

    const languageInstruction = responseLanguage !== "English"
      ? `\n\nIMPORTANT: Always respond in ${responseLanguage}. All plan titles, confirmations, and explanations must also be in ${responseLanguage}.`
      : "";

    const systemPrompt = `You are a WooCommerce store assistant. You help manage their online store through conversation.${languageInstruction}

Your capabilities:
- Search and browse products (shown as interactive visual cards automatically)
- Create and manage orders
- Provide sales analytics and insights with charts and dashboards
- Learn the user's preferences and product aliases

When the user refers to a product casually (e.g. "pasta bourbon"), search for it first. If you identify a pattern or alias, save it as a preference.

When creating orders, always search for products first to confirm the right items, then create the order.

PRODUCT DISPLAY RULES:
- When products are found, do NOT list product details in text — they are displayed as interactive cards automatically.
- Just provide a brief summary like "Found X products matching your search." or "Here are the results:".

DASHBOARD/REPORT DISPLAY RULES:
- After analyzing sales data (get_sales_report, compare_sales), you MUST include a structured dashboard JSON block in your response.
- Wrap the JSON in a \`\`\`dashboard code block. The frontend will render it as an interactive dashboard.
- Schema:
\`\`\`
{
  "cards": [{ "label": "Total Revenue", "value": "1,234 lei", "change": "+12%" }],
  "charts": [{ "type": "bar"|"line"|"pie"|"grouped_bar", "title": "Chart Title", "data": [{"name":"Label","value":100}], "dataKey": "value", "nameKey": "name" }],
  "tables": [{ "title": "Top Products", "columns": ["Product","Qty","Revenue"], "rows": [["Pasta",10,"500 lei"]] }],
  "lists": [{ "title": "Insights", "items": ["Revenue increased by 12%","Most popular: Pasta"], "collapsible": true }]
}
\`\`\`
- Include stat cards for key metrics (revenue, order count, avg order value).
- Include charts when there's time-series or comparative data.
- Include tables for top products/categories breakdowns.
- Include lists for insights and recommendations.
- For grouped_bar charts, use "dataKeys": ["Label A", "Label B"] instead of "dataKey".
- All currency values should use "lei" suffix.

Be conversational, efficient, and proactive. Use markdown for formatting. Currency is RON (lei).${prefsContext}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY && !userOpenAIKey) throw new Error("No AI API key configured");

    const useOpenAI = !!userOpenAIKey;
    const aiBaseUrl = useOpenAI ? "https://api.openai.com/v1/chat/completions" : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiAuthHeader = useOpenAI ? `Bearer ${userOpenAIKey}` : `Bearer ${LOVABLE_API_KEY}`;
    const aiModel = useOpenAI ? "gpt-4o-mini" : "google/gemini-3-flash-preview";

    let aiMessages: any[] = [{ role: "system", content: systemPrompt }, ...messages];
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendSSE = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          let maxIterations = 8;
          let stepIndex = 0;
          let planSent = false;

          while (maxIterations-- > 0) {
            const aiResp = await fetch(aiBaseUrl, {
              method: "POST",
              headers: { Authorization: aiAuthHeader, "Content-Type": "application/json" },
              body: JSON.stringify({ model: aiModel, messages: aiMessages, tools: TOOLS, stream: false }),
            });

            if (!aiResp.ok) {
              if (aiResp.status === 429) { sendSSE({ error: "Rate limited" }); break; }
              if (aiResp.status === 402) { sendSSE({ error: "Credits exhausted" }); break; }
              throw new Error(`AI gateway error: ${aiResp.status}`);
            }

            const aiData = await aiResp.json();
            const choice = aiData.choices?.[0];
            if (!choice) break;

            const content = choice.message?.content || "";

            if (choice.finish_reason === "tool_calls" || choice.message?.tool_calls?.length) {
              const toolCalls = choice.message.tool_calls;
              aiMessages.push({ ...choice.message, content: content || null });

              // Auto-generate pipeline plan from tool calls
              if (!planSent) {
                const steps = toolCalls.map((tc: any) => TOOL_LABELS[tc.function.name] || tc.function.name);
                sendSSE({ type: "pipeline_plan", title: "Execution Plan", steps });
                planSent = true;
              }

              for (const tc of toolCalls) {
                const args = JSON.parse(tc.function.arguments);
                const toolName = tc.function.name;
                const stepLabel = TOOL_LABELS[toolName] || toolName;

                sendSSE({ type: "pipeline_step", stepIndex, title: stepLabel, status: "running", toolName, args });

                if (WRITE_TOOLS.has(toolName) && !approvalResponse) {
                  sendSSE({
                    type: "approval_request",
                    stepIndex,
                    title: stepLabel,
                    summary: `${stepLabel} with: ${JSON.stringify(args)}`,
                    toolName,
                    args,
                    toolCallId: tc.id,
                  });

                  aiMessages.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: JSON.stringify({ status: "awaiting_approval", message: "Waiting for user approval..." }),
                  });

                  sendSSE({ type: "pipeline_step", stepIndex, title: stepLabel, status: "needs_approval" });
                  stepIndex++;
                  continue;
                }

                const { result, richContent, requestUri } = await executeTool(toolName, args, supabaseUrl, authHeader, userId, supabase);

                // Emit debug event with raw API response and request URI
                sendSSE({ type: "debug_api", toolName, args, result, requestUri });

                if (richContent) {
                  sendSSE({ type: "rich_content", ...richContent });
                }

                sendSSE({ type: "pipeline_step", stepIndex, title: stepLabel, status: "done", details: typeof result === "object" ? `Found ${Array.isArray(result) ? result.length : 1} result(s)` : String(result) });

                aiMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
                stepIndex++;
              }
              continue;
            }

            sendSSE({ type: "pipeline_complete", lastStepIndex: stepIndex });

            if (content) {
              sendSSE({ choices: [{ delta: { content } }] });
            }
            break;
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          console.error("Stream error:", e);
          sendSSE({ error: e instanceof Error ? e.message : "Unknown error" });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
