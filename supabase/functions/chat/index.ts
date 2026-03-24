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

// Tools that require user approval before execution
const WRITE_TOOLS = new Set(["create_order", "update_order_status"]);

// Human-readable labels for tool names
const TOOL_LABELS: Record<string, string> = {
  search_products: "Searching products",
  get_product: "Getting product details",
  search_orders: "Searching orders",
  create_order: "Creating order",
  update_order_status: "Updating order status",
  get_sales_report: "Generating sales report",
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
): Promise<{ result: any; richContent?: any }> {
  switch (toolName) {
    case "search_products": {
      const params = new URLSearchParams();
      params.set("search", args.search);
      if (args.category) params.set("category", args.category);
      params.set("per_page", String(args.per_page || 10));
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint: `products?${params.toString()}` });
      return { result: data, richContent: { type: "products", data: Array.isArray(data) ? data : [] } };
    }
    case "get_product": {
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint: `products/${args.product_id}` });
      return { result: data, richContent: { type: "products", data: [data] } };
    }
    case "search_orders": {
      const params = new URLSearchParams();
      if (args.status) params.set("status", args.status);
      if (args.search) params.set("search", args.search);
      if (args.after) params.set("after", args.after);
      if (args.before) params.set("before", args.before);
      params.set("per_page", String(args.per_page || 10));
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint: `orders?${params.toString()}` });
      return { result: data, richContent: { type: "orders", data: Array.isArray(data) ? data : [] } };
    }
    case "create_order": {
      const data = await callWooProxy(supabaseUrl, authHeader, {
        endpoint: "orders", method: "POST",
        body: { line_items: args.line_items, customer_id: args.customer_id || 0, status: args.status || "processing" },
      });
      return { result: data };
    }
    case "update_order_status": {
      const data = await callWooProxy(supabaseUrl, authHeader, {
        endpoint: `orders/${args.order_id}`, method: "PUT", body: { status: args.status },
      });
      return { result: data };
    }
    case "get_sales_report": {
      const params = new URLSearchParams();
      params.set("per_page", "100");
      params.set("status", "completed,processing");
      if (args.date_min) params.set("after", `${args.date_min}T00:00:00`);
      if (args.date_max) params.set("before", `${args.date_max}T23:59:59`);
      const now = new Date();
      if (args.period === "today") params.set("after", `${now.toISOString().split("T")[0]}T00:00:00`);
      else if (args.period === "week") params.set("after", new Date(now.getTime() - 7 * 864e5).toISOString());
      else if (args.period === "month") params.set("after", new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString());
      const orders = await callWooProxy(supabaseUrl, authHeader, { endpoint: `orders?${params.toString()}` });
      if (!Array.isArray(orders)) return { result: orders };
      const totalRevenue = orders.reduce((s: number, o: any) => s + parseFloat(o.total || "0"), 0);
      const byDate: Record<string, number> = {};
      orders.forEach((o: any) => {
        const date = o.date_created?.split("T")[0] || "unknown";
        byDate[date] = (byDate[date] || 0) + parseFloat(o.total || "0");
      });
      const chartData = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
      return {
        result: { totalRevenue: Math.round(totalRevenue * 100) / 100, orderCount: orders.length, dailyBreakdown: chartData },
        richContent: { type: "chart", data: { type: "bar", title: `Sales Report (${args.period || "custom"})`, data: chartData, dataKey: "value", nameKey: "name" } },
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

    // Load user preferences
    const { data: prefs } = await supabase.from("user_preferences").select("preference_type, key, value").eq("user_id", userId);
    let prefsContext = "";
    if (prefs?.length) {
      prefsContext = "\n\nUser's saved preferences/aliases:\n" + prefs.map((p: any) => `- ${p.preference_type}: "${p.key}" → ${JSON.stringify(p.value)}`).join("\n");
    }

    // Load user's woo_connections settings (language + openai key)
    const { data: connData } = await supabase.from("woo_connections").select("response_language, openai_api_key").eq("user_id", userId).eq("is_active", true).maybeSingle();
    const responseLanguage = connData?.response_language || "English";
    const userOpenAIKey = connData?.openai_api_key || null;

    const languageInstruction = responseLanguage !== "English"
      ? `\n\nIMPORTANT: Always respond in ${responseLanguage}. All pipeline step labels, plan titles, confirmations, and explanations must also be in ${responseLanguage}.`
      : "";

    const systemPrompt = `You are a WooCommerce store assistant. You help manage their online store through conversation.${languageInstruction}

IMPORTANT RULES FOR TOOL EXECUTION:
1. Before executing actions, output a plan in this exact format:
\`\`\`pipeline
{"title": "Plan Title", "steps": ["Step 1", "Step 2", "Step 3"]}
\`\`\`
2. After outputting the plan, you MUST execute ALL steps by calling the appropriate tools in sequence. Do NOT stop after the first tool call.
3. Each tool call result will be provided back to you. Continue calling tools until all planned steps are complete.
4. Only after ALL tools have been called, provide your final summary text response.
5. If a step doesn't require a tool call (e.g., "communicate result"), still complete all tool-based steps first.

Your capabilities:
- Search and browse products (show them visually with cards)
- Create and manage orders
- Provide sales analytics and insights with charts
- Learn the user's preferences and product aliases

When the user refers to a product casually (e.g. "pasta bourbon"), search for it first. If you identify a pattern or alias, save it as a preference.

When creating orders, always search for products first to confirm the right items, then create the order.

For analytics, fetch the data and present insights with charts.

Be conversational, efficient, and proactive. Use markdown for formatting. Currency is RON (lei).${prefsContext}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY && !userOpenAIKey) throw new Error("No AI API key configured");

    // Determine AI provider
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

            // Extract pipeline plan from content if present
            const content = choice.message?.content || "";
            const pipelineMatch = content.match(/```pipeline\s*\n([\s\S]*?)\n```/);
            if (pipelineMatch) {
              try {
                const plan = JSON.parse(pipelineMatch[1]);
                sendSSE({ type: "pipeline_plan", title: plan.title, steps: plan.steps });
              } catch { /* ignore parse errors */ }
            }

            // Handle tool calls
            if (choice.finish_reason === "tool_calls" || choice.message?.tool_calls?.length) {
              const toolCalls = choice.message.tool_calls;
              aiMessages.push(choice.message);

              for (const tc of toolCalls) {
                const args = JSON.parse(tc.function.arguments);
                const toolName = tc.function.name;
                const stepLabel = TOOL_LABELS[toolName] || toolName;

                // Send step running event
                sendSSE({ type: "pipeline_step", stepIndex, title: stepLabel, status: "running", toolName, args });

                // Check if this is a write tool that needs approval
                if (WRITE_TOOLS.has(toolName) && !approvalResponse) {
                  // Send approval request and pause
                  sendSSE({
                    type: "approval_request",
                    stepIndex,
                    title: stepLabel,
                    summary: `${stepLabel} with: ${JSON.stringify(args)}`,
                    toolName,
                    args,
                    toolCallId: tc.id,
                  });

                  // Add a placeholder tool result indicating we're waiting
                  aiMessages.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: JSON.stringify({ status: "awaiting_approval", message: "Waiting for user approval..." }),
                  });

                  sendSSE({ type: "pipeline_step", stepIndex, title: stepLabel, status: "needs_approval" });
                  stepIndex++;
                  continue;
                }

                // Execute the tool
                const { result, richContent } = await executeTool(toolName, args, supabaseUrl, authHeader, userId, supabase);

                if (richContent) {
                  sendSSE({ type: "rich_content", ...richContent });
                }

                sendSSE({ type: "pipeline_step", stepIndex, title: stepLabel, status: "done", details: typeof result === "object" ? `Found ${Array.isArray(result) ? result.length : 1} result(s)` : String(result) });

                aiMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
                stepIndex++;
              }
              continue;
            }

            // No more tool calls — mark pipeline complete and stream the final text response
            sendSSE({ type: "pipeline_complete", lastStepIndex: stepIndex });

            if (content) {
              // Remove the pipeline block from streamed content
              const cleanContent = content.replace(/```pipeline\s*\n[\s\S]*?\n```\s*/g, "").trim();
              if (cleanContent) {
                const streamResp = await fetch(aiBaseUrl, {
                  method: "POST",
                  headers: { Authorization: aiAuthHeader, "Content-Type": "application/json" },
                  body: JSON.stringify({ model: aiModel, messages: aiMessages, stream: true }),
                });

                if (streamResp.ok && streamResp.body) {
                  const reader = streamResp.body.getReader();
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    controller.enqueue(value);
                  }
                } else {
                  sendSSE({ choices: [{ delta: { content: cleanContent } }] });
                }
              }
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
