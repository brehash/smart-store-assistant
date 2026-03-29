import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, WRITE_TOOLS } from "./types.ts";
import type { SemanticStep } from "./types.ts";
import { TOOLS } from "./tools.ts";
import { selectToolsForIntent, isShippingIntent } from "./intent.ts";
import { coerceMessageContent, sanitizeAiHistory, truncateForAI, normalizeSalesReportDates, normalizeCompareSalesDates } from "./utils.ts";
import { TOOL_LABELS, generateReasoningBefore, generateReasoningAfter, generateSemanticPlan } from "./reasoning.ts";
import { buildSystemPrompt, buildShippingPrompt } from "./prompts.ts";
import { executeTool, callWooProxy } from "./tool-executor.ts";

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

    const { messages, conversationId, approvalResponse, viewId } = await req.json();

    // ── Credit check (resolve through team if applicable) ──
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {});
    const { data: creditBalance } = await serviceClient.rpc("refill_credits_if_due", { _user_id: userId });
    
    // Check if user is in a team and use team balance instead
    let effectiveBalance = creditBalance?.balance || 0;
    let teamCreditRow: any = null;
    if (creditBalance?.team_id) {
      const { data: teamBal } = await serviceClient
        .from("credit_balances")
        .select("*")
        .eq("team_id", creditBalance.team_id)
        .gt("balance", 0)
        .order("balance", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (teamBal) {
        effectiveBalance = teamBal.balance;
        teamCreditRow = teamBal;
      }
    }
    
    if (effectiveBalance <= 0) {
      return new Response(JSON.stringify({ error: "You've run out of credits. Contact your administrator for more." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("preference_type, key, value")
      .eq("user_id", userId);
    let prefsContext = "";
    if (prefs?.length) {
      const regularPrefs = prefs.filter((p: any) => p.preference_type !== "meta_definition");
      const metaDefs = prefs.filter((p: any) => p.preference_type === "meta_definition");
      if (regularPrefs.length) {
        prefsContext +=
          "\n\nUser's saved preferences/aliases:\n" +
          regularPrefs.map((p: any) => `- ${p.preference_type}: "${p.key}" → ${JSON.stringify(p.value)}`).join("\n");
      }
      if (metaDefs.length) {
        prefsContext +=
          "\n\nUser's custom meta key definitions (these are automatically included in order meta filtering):\n" +
          metaDefs.map((p: any) => `- Meta key "${p.key}": ${JSON.stringify(p.value)}`).join("\n");
      }
    }

    // ── Vector Memory: Retrieve relevant memories ──
    let memoriesContext = "";
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey) {
      try {
        const lastMsg = (messages as any[]).filter((m: any) => m.role === "user").pop()?.content || "";
        if (lastMsg.length > 5) {
          const embResp = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "text-embedding-3-small", input: lastMsg }),
          });
          if (embResp.ok) {
            const embData = await embResp.json();
            const queryEmbedding = embData.data[0].embedding;
            const { data: memories } = await serviceClient.rpc("match_memories", {
              _user_id: userId,
              _embedding: JSON.stringify(queryEmbedding),
              _match_count: 5,
              _match_threshold: 0.7,
            });
            if (memories?.length) {
              memoriesContext =
                "\n\nRelevant memories from past conversations:\n" +
                memories.map((m: any) => `- [${m.memory_type}] ${m.content}`).join("\n");
            }
          }
        }
      } catch (memErr) {
        console.error("Memory retrieval error (non-fatal):", memErr);
      }
    }

    // Resolve woo_connections: own connection first, then team owner's
    let connData = (await serviceClient
      .from("woo_connections")
      .select("response_language, order_statuses")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle()).data;
    
    if (!connData) {
      // Check if user is in a team and use team owner's connection
      const { data: membership } = await serviceClient
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (membership) {
        const { data: team } = await serviceClient
          .from("teams")
          .select("owner_id")
          .eq("id", membership.team_id)
          .single();
        if (team) {
          connData = (await serviceClient
            .from("woo_connections")
            .select("response_language, order_statuses")
            .eq("user_id", team.owner_id)
            .eq("is_active", true)
            .maybeSingle()).data;
        }
      }
    }
    const responseLanguage = connData?.response_language || "English";
    const userOpenAIKey = Deno.env.get("OPENAI_API_KEY") || null;
    const defaultOrderStatuses: string[] = (connData as any)?.order_statuses || [];

    const activeTools = [...TOOLS];

    // Fetch shared view context if viewId is provided
    let viewContext = "";
    if (viewId) {
      const { data: siblingConvs } = await supabase
        .from("conversations")
        .select("id, title")
        .eq("view_id", viewId)
        .neq("id", conversationId);
      if (siblingConvs?.length) {
        const siblingIds = siblingConvs.map((c: any) => c.id);
        const { data: siblingMsgs } = await supabase
          .from("messages")
          .select("content, role, conversation_id")
          .in("conversation_id", siblingIds)
          .order("created_at", { ascending: false })
          .limit(30);
        if (siblingMsgs?.length) {
          viewContext =
            "\n\nShared context from related chats in this view:\n" +
            siblingMsgs
              .reverse()
              .map((m: any) => `[${m.role}]: ${m.content.slice(0, 200)}`)
              .join("\n");
        }
      }
    }

    const languageInstruction =
      responseLanguage !== "English"
        ? `\n\nIMPORTANT: Always respond in ${responseLanguage}. All plan titles, confirmations, and explanations must also be in ${responseLanguage}.`
        : "";

    const defaultStatusStr = defaultOrderStatuses.length
      ? `\n\nDEFAULT ORDER STATUSES: The user has configured these default order statuses: ${defaultOrderStatuses.join(", ")}. Use these as the status filter when searching orders or generating reports unless the user explicitly specifies different statuses.`
      : "";

    const systemPrompt = buildSystemPrompt({
      languageInstruction,
      defaultStatusStr,
      prefsContext,
      memoriesContext,
      viewContext,
    });

    const shippingSystemPrompt = buildShippingPrompt({
      languageInstruction,
      defaultStatusStr,
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY && !userOpenAIKey) throw new Error("No AI API key configured");

    const useOpenAI = !!userOpenAIKey;
    const aiBaseUrl = useOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiAuthHeader = useOpenAI ? `Bearer ${userOpenAIKey}` : `Bearer ${LOVABLE_API_KEY}`;
    const aiModel = useOpenAI ? "gpt-5.4-mini" : "google/gemini-3-flash-preview";

    // Detect shipping intent for optimized prompt/tool selection
    const lastUserMsg = (messages as any[]).filter((m: any) => m.role === "user").pop()?.content || "";
    const shippingQuery = isShippingIntent(lastUserMsg);
    const effectiveSystemPrompt = shippingQuery ? shippingSystemPrompt : systemPrompt;

    // Trim conversation history
    const historyLimit = shippingQuery ? 6 : 20;
    const trimmedHistory = sanitizeAiHistory(messages).slice(-historyLimit);
    let aiMessages: any[] = [{ role: "system", content: effectiveSystemPrompt }, ...trimmedHistory];
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendSSE = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          let maxIterations = 15;
          let stepIndex = 0;
          let planSent = false;
          let contentSent = false;
          let finalAssistantContent = "";
          let semanticSteps: SemanticStep[] = [];
          let semanticIdx = 0;
          const totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

          // ── Order-creation intent detection ──
          const orderIntentRe = /(cre(?:ea)?z[aă]|f[aă]|plaseaz[aă]|adaug[aă]|pune|place|create|make|add|new)\s.*?(comand[aă]|order)/i;
          if (orderIntentRe.test(lastUserMsg)) {
            sendSSE({ type: "pipeline_plan", title: "Execution Plan", steps: ["Creating order form"] });
            sendSSE({ type: "pipeline_step", stepIndex: 0, title: "Creating order form", status: "done" });
            sendSSE({ type: "order_form", toolCallId: "manual-order", stepIndex: 0, prefill: {} });
            const formText = responseLanguage !== "English"
              ? "Completați formularul de mai jos pentru a crea comanda."
              : "Please fill in the order form below to create the order.";
            sendSSE({ choices: [{ delta: { content: formText } }] });
            sendSSE({ type: "pipeline_complete" });

            const CREDIT_COST = 1;
            const deductRow = teamCreditRow || creditBalance;
            const newBalance = Math.max(0, (deductRow?.balance || 1) - CREDIT_COST);
            await serviceClient.from("credit_balances").update({ balance: newBalance }).eq("user_id", deductRow?.user_id || userId);
            await serviceClient.from("credit_transactions").insert({
              user_id: userId, amount: -CREDIT_COST, balance_after: newBalance, reason: "chat_message",
            });
            sendSSE({ type: "credit_usage", cost: CREDIT_COST, remaining_balance: newBalance });
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          // ── Cache refresh intent detection ──
          const cacheIntentRe = /(update|refresh|actualizeaz[aă]|sincronizeaz[aă]|sync)\s.*(product|cache|memor|produs)/i;
          if (cacheIntentRe.test(lastUserMsg)) {
            sendSSE({ type: "pipeline_plan", title: "Execution Plan", steps: ["Refreshing product cache"] });
            sendSSE({ type: "pipeline_step", stepIndex: 0, title: "Refreshing product cache", status: "running" });

            const { data: conn } = await supabase
              .from("woo_connections")
              .select("store_url, consumer_key, consumer_secret")
              .eq("user_id", userId)
              .eq("is_active", true)
              .maybeSingle();

            if (conn) {
              try {
                let allProducts: any[] = [];
                let page = 1;
                while (true) {
                  const wooResp = await callWooProxy(supabaseUrl, authHeader, { endpoint: `products?per_page=100&page=${page}`, storeUrl: conn.store_url, consumerKey: conn.consumer_key, consumerSecret: conn.consumer_secret });
                  if (!Array.isArray(wooResp) || wooResp.length === 0) break;
                  allProducts = [...allProducts, ...wooResp.map((p: any) => ({ id: p.id, name: p.name, sku: p.sku, price: p.price, regular_price: p.regular_price, stock_status: p.stock_status, images: p.images?.slice(0, 1) }))];
                  if (wooResp.length < 100) break;
                  page++;
                }
                let paymentMethods: any[] = [];
                try {
                  const gwResp = await callWooProxy(supabaseUrl, authHeader, { endpoint: "payment_gateways", storeUrl: conn.store_url, consumerKey: conn.consumer_key, consumerSecret: conn.consumer_secret });
                  paymentMethods = Array.isArray(gwResp) ? gwResp.filter((g: any) => g.enabled).map((g: any) => ({ id: g.id, title: g.title })) : [];
                } catch { /* payment gateways may not be accessible */ }
                let allStatuses: any[] = [];
                try {
                  const stResp = await callWooProxy(supabaseUrl, authHeader, { endpoint: "reports/orders/totals", storeUrl: conn.store_url, consumerKey: conn.consumer_key, consumerSecret: conn.consumer_secret });
                  allStatuses = Array.isArray(stResp) ? stResp.map((s: any) => ({ slug: s.slug, name: s.name })) : [];
                } catch { /* silent */ }
                const upserts = [
                  { user_id: userId, cache_key: "products", data: allProducts, updated_at: new Date().toISOString() },
                  { user_id: userId, cache_key: "payment_methods", data: paymentMethods, updated_at: new Date().toISOString() },
                  { user_id: userId, cache_key: "order_statuses", data: allStatuses, updated_at: new Date().toISOString() },
                ];
                for (const row of upserts) {
                  await serviceClient.from("woo_cache").upsert(row, { onConflict: "user_id,cache_key" });
                }
                sendSSE({ type: "pipeline_step", stepIndex: 0, title: "Refreshing product cache", status: "done" });
                const doneText = responseLanguage !== "English"
                  ? `✅ Cache actualizat: ${allProducts.length} produse, ${paymentMethods.length} metode de plată, ${allStatuses.length} statusuri.`
                  : `✅ Cache refreshed: ${allProducts.length} products, ${paymentMethods.length} payment methods, ${allStatuses.length} statuses.`;
                sendSSE({ choices: [{ delta: { content: doneText } }] });
              } catch (err) {
                sendSSE({ type: "pipeline_step", stepIndex: 0, title: "Refreshing product cache", status: "error" });
                const errText = responseLanguage !== "English"
                  ? "❌ Nu am putut actualiza cache-ul. Verificați conexiunea."
                  : "❌ Failed to refresh cache. Check your connection.";
                sendSSE({ choices: [{ delta: { content: errText } }] });
              }
            } else {
              sendSSE({ type: "pipeline_step", stepIndex: 0, title: "Refreshing product cache", status: "error" });
              const noConnText = responseLanguage !== "English"
                ? "❌ Nu aveți o conexiune WooCommerce activă."
                : "❌ No active WooCommerce connection found.";
              sendSSE({ choices: [{ delta: { content: noConnText } }] });
            }

            sendSSE({ type: "pipeline_complete" });
            const CREDIT_COST = 1;
            const deductRow2 = teamCreditRow || creditBalance;
            const newBalance = Math.max(0, (deductRow2?.balance || 1) - CREDIT_COST);
            await serviceClient.from("credit_balances").update({ balance: newBalance }).eq("user_id", deductRow2?.user_id || userId);
            await serviceClient.from("credit_transactions").insert({
              user_id: userId, amount: -CREDIT_COST, balance_after: newBalance, reason: "chat_message",
            });
            sendSSE({ type: "credit_usage", cost: CREDIT_COST, remaining_balance: newBalance });
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          // Emit "Understanding request" immediately
          sendSSE({ type: "pipeline_plan", title: "Execution Plan", steps: ["Understanding request"] });
          sendSSE({ type: "pipeline_step", stepIndex: 0, title: "Understanding request", status: "running" });

          while (maxIterations-- > 0) {
            if (maxIterations <= 2) {
              aiMessages.push({
                role: "system",
                content:
                  "CRITICAL: You are running low on processing steps. You MUST produce your final answer NOW using the data you already have. Do NOT call any more tools. Summarize and present what you have.",
              });
            }
            sendSSE({ type: "reasoning", text: "Thinking..." });

            const hasToolResult = aiMessages.some((m: any) => m.role === "tool");
            const iterationTools = selectToolsForIntent(lastUserMsg, hasToolResult, activeTools);

            if (shippingQuery && hasToolResult) {
              const sysMsg = aiMessages[0];
              const recentMsgs = aiMessages.slice(1).slice(-6);
              aiMessages = [sysMsg, ...recentMsgs];
            }

            const aiRequest = fetch(aiBaseUrl, {
              method: "POST",
              headers: { Authorization: aiAuthHeader, "Content-Type": "application/json" },
              body: JSON.stringify({ model: aiModel, messages: aiMessages, tools: iterationTools, stream: false }),
            });
            const keepAliveInterval = setInterval(() => {
              sendSSE({ type: "reasoning", text: "Still processing..." });
            }, 15000);
            let aiResp: Response;
            try {
              aiResp = await aiRequest;
            } finally {
              clearInterval(keepAliveInterval);
            }

            if (!aiResp.ok) {
              if (aiResp.status === 429) {
                sendSSE({ error: "Rate limited" });
                break;
              }
              if (aiResp.status === 402) {
                sendSSE({ error: "Credits exhausted" });
                break;
              }
              const errBody = await aiResp.text();
              console.error("AI gateway error:", aiResp.status, errBody);
              throw new Error(`AI gateway error: ${aiResp.status}`);
            }

            const aiData = await aiResp.json();
            if (aiData.usage) {
              totalUsage.prompt_tokens += aiData.usage.prompt_tokens || 0;
              totalUsage.completion_tokens += aiData.usage.completion_tokens || 0;
              totalUsage.total_tokens += aiData.usage.total_tokens || 0;
            }
            const choice = aiData.choices?.[0];
            if (!choice) break;

            const content = choice.message?.content || "";
            if (content) finalAssistantContent = content;

            if (choice.finish_reason === "tool_calls" || choice.message?.tool_calls?.length) {
              const toolCalls = choice.message.tool_calls;
              aiMessages.push({
                role: "assistant",
                content: coerceMessageContent(content),
                tool_calls: choice.message.tool_calls,
              });

              if (!planSent) {
                sendSSE({ type: "pipeline_step", stepIndex: 0, title: "Understanding request", status: "done" });
                semanticSteps = generateSemanticPlan(toolCalls);
                const allStepTitles = ["Understanding request", ...semanticSteps.map((s) => s.title)];
                sendSSE({ type: "pipeline_plan", title: "Execution Plan", steps: allStepTitles });
                stepIndex = 1;
                planSent = true;
              }

              if (semanticIdx === 0 && planSent) semanticIdx = 0;

              for (const tc of toolCalls) {
                let args: any;
                try {
                  args = JSON.parse(tc.function.arguments);
                } catch {
                  console.error("Failed to parse tool arguments:", tc.function.arguments);
                  sendSSE({
                    type: "reasoning",
                    text: `Failed to parse arguments for ${tc.function.name}, skipping...`,
                  });
                  aiMessages.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: JSON.stringify({ error: "Invalid arguments" }),
                  });
                  continue;
                }
                const toolName = tc.function.name;
                const stepLabel = TOOL_LABELS[toolName] || toolName;

                while (semanticIdx < semanticSteps.length) {
                  const ss = semanticSteps[semanticIdx];
                  if (ss.title.startsWith("Resolving") || ss.title.startsWith("Preparing")) {
                    sendSSE({
                      type: "pipeline_step",
                      stepIndex,
                      title: ss.title,
                      status: "running",
                      details: ss.details,
                    });
                    sendSSE({ type: "pipeline_step", stepIndex, title: ss.title, status: "done", details: ss.details });
                    stepIndex++;
                    semanticIdx++;
                  } else {
                    break;
                  }
                }

                const currentSemanticTitle =
                  semanticIdx < semanticSteps.length ? semanticSteps[semanticIdx].title : stepLabel;
                const currentSemanticDetails =
                  semanticIdx < semanticSteps.length ? semanticSteps[semanticIdx].details : undefined;

                sendSSE({ type: "reasoning", text: generateReasoningBefore(toolName, args) });

                sendSSE({
                  type: "pipeline_step",
                  stepIndex,
                  title: currentSemanticTitle,
                  status: "running",
                  details: currentSemanticDetails,
                  toolName,
                  args,
                });

                if (WRITE_TOOLS.has(toolName) && !approvalResponse) {
                  if (toolName === "create_order") {
                    sendSSE({
                      type: "order_form",
                      stepIndex,
                      toolName,
                      args,
                      toolCallId: tc.id,
                      prefill: args,
                    });

                    aiMessages.push({
                      role: "tool",
                      tool_call_id: tc.id,
                      content: JSON.stringify({ status: "done", message: "Order form displayed. The user will complete and submit the order via the form." }),
                    });

                    sendSSE({ type: "pipeline_step", stepIndex, title: currentSemanticTitle, status: "done" });
                    stepIndex++;
                    semanticIdx++;
                    continue;
                  } else {
                    sendSSE({
                      type: "approval_request",
                      stepIndex,
                      title: currentSemanticTitle,
                      summary: `${stepLabel} with: ${JSON.stringify(args)}`,
                      toolName,
                      args,
                      toolCallId: tc.id,
                    });
                  }

                  aiMessages.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: JSON.stringify({ status: "awaiting_approval", message: "Waiting for user approval..." }),
                  });

                  sendSSE({ type: "pipeline_step", stepIndex, title: currentSemanticTitle, status: "needs_approval" });
                  stepIndex++;
                  semanticIdx++;
                  continue;
                }

                const normalizedArgs =
                  toolName === "get_sales_report"
                    ? normalizeSalesReportDates(args)
                    : toolName === "compare_sales"
                      ? normalizeCompareSalesDates(args)
                      : args;

                let result: any;
                let richContent: any;
                let requestUri: string | undefined;

                try {
                  const toolResult = await executeTool(
                    toolName,
                    normalizedArgs,
                    supabaseUrl,
                    authHeader,
                    userId,
                    supabase,
                    defaultOrderStatuses,
                    sendSSE,
                  );
                  result = toolResult.result;
                  richContent = toolResult.richContent;
                  requestUri = toolResult.requestUri;
                } catch (toolErr) {
                  console.error(`Tool ${toolName} failed:`, toolErr);
                  const errMsg = toolErr instanceof Error ? toolErr.message : "Unknown tool error";
                  result = { error: errMsg };
                  sendSSE({ type: "reasoning", text: `Tool "${toolName}" failed: ${errMsg}. Continuing...` });
                  sendSSE({
                    type: "pipeline_step",
                    stepIndex,
                    title: currentSemanticTitle,
                    status: "error",
                    details: errMsg,
                  });
                  aiMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: errMsg }) });
                  stepIndex++;
                  semanticIdx++;
                  continue;
                }

                sendSSE({ type: "debug_api", toolName, args, result, requestUri });

                const reasoningAfter = generateReasoningAfter(toolName, result);
                if (reasoningAfter) sendSSE({ type: "reasoning", text: reasoningAfter });

                if (richContent) {
                  sendSSE({ type: "rich_content", contentType: richContent.type, data: richContent.data });
                }

                sendSSE({
                  type: "pipeline_step",
                  stepIndex,
                  title: currentSemanticTitle,
                  status: "done",
                  details: currentSemanticDetails,
                });

                aiMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: JSON.stringify(truncateForAI(toolName, result)),
                });
                stepIndex++;
                semanticIdx++;

                while (semanticIdx < semanticSteps.length) {
                  const ss = semanticSteps[semanticIdx];
                  if (ss.title === "Writing explanation") break;
                  if (
                    ss.title.startsWith("Fetching") ||
                    ss.title === "Awaiting approval" ||
                    ss.title.startsWith("Analyzing")
                  )
                    break;
                  sendSSE({
                    type: "pipeline_step",
                    stepIndex,
                    title: ss.title,
                    status: "running",
                    details: ss.details,
                  });
                  sendSSE({ type: "pipeline_step", stepIndex, title: ss.title, status: "done", details: ss.details });
                  stepIndex++;
                  semanticIdx++;
                }
              }
              continue;
            }

            // Post-tool synthesis
            sendSSE({ type: "reasoning", text: "Preparing your response..." });
            if (planSent && stepIndex > 0) {
              for (let i = semanticIdx; i < semanticSteps.length; i++) {
                const ss = semanticSteps[i];
                if (ss.title === "Writing explanation") {
                  sendSSE({ type: "pipeline_step", stepIndex, title: ss.title, status: "running" });
                  continue;
                }
                sendSSE({ type: "reasoning", text: `${ss.title}...` });
                sendSSE({ type: "pipeline_step", stepIndex, title: ss.title, status: "running" });
                sendSSE({ type: "pipeline_step", stepIndex, title: ss.title, status: "done" });
                stepIndex++;
              }
            } else if (!planSent) {
              sendSSE({ type: "pipeline_step", stepIndex: 0, title: "Understanding request", status: "done" });
            }

            if (content) {
              const dashboardRegex = /```dashboard\s*\n([\s\S]*?)```/g;
              let textContent = content;
              let match;
              while ((match = dashboardRegex.exec(content)) !== null) {
                try {
                  const dashboardData = JSON.parse(match[1].trim());
                  sendSSE({ type: "dashboard", data: dashboardData });
                  contentSent = true;
                  textContent = textContent.replace(match[0], "").trim();
                } catch {
                  /* ignore malformed JSON */
                }
              }
              if (textContent) {
                sendSSE({ choices: [{ delta: { content: textContent } }] });
                contentSent = true;
              }
            }

            if (planSent && stepIndex > 0) {
              sendSSE({ type: "pipeline_step", stepIndex, title: "Writing explanation", status: "done" });
              stepIndex++;
            }
            sendSSE({ type: "pipeline_complete", lastStepIndex: stepIndex });
            break;
          }

          // Fallback
          if (!contentSent) {
            sendSSE({ type: "reasoning", text: "Error: Ran out of processing steps before generating a response." });
            sendSSE({
              choices: [
                {
                  delta: {
                    content:
                      "⚠️ Am adunat datele dar am epuizat pașii de procesare înainte de a putea scrie analiza. Te rog încearcă din nou — voi fi mai concis de data aceasta.",
                  },
                },
              ],
            });
            sendSSE({ type: "pipeline_complete", lastStepIndex: stepIndex });
          }

          // ── Emit accumulated token usage ──
          if (totalUsage.total_tokens > 0) {
            sendSSE({ type: "token_usage", ...totalUsage });
          }

          // ── Credit deduction ──
          let creditCost = 1;
          const allToolNames = aiMessages
            .filter((m: any) => m.role === "assistant" && m.tool_calls)
            .flatMap((m: any) => m.tool_calls.map((tc: any) => tc.function.name));
          if (allToolNames.some((n: string) => WRITE_TOOLS.has(n))) {
            creditCost = 3;
          } else if (allToolNames.length > 0) {
            creditCost = 2;
          }
          try {
            const deductRow3 = teamCreditRow || null;
            const creditUserId = deductRow3?.user_id || userId;
            const { data: bal } = await serviceClient
              .from("credit_balances")
              .select("balance")
              .eq("user_id", creditUserId)
              .single();
            const newBalance = Math.max(0, (bal?.balance || 0) - creditCost);
            await serviceClient
              .from("credit_balances")
              .update({ balance: newBalance })
              .eq("user_id", creditUserId);
            await serviceClient.from("credit_transactions").insert({
              user_id: userId,
              amount: -creditCost,
              balance_after: newBalance,
              reason: "message",
              metadata: { tool_count: allToolNames.length, tier: creditCost },
            });
            sendSSE({ type: "credit_usage", cost: creditCost, remaining_balance: newBalance });
          } catch (creditErr) {
            console.error("Credit deduction error:", creditErr);
          }

          // ── Vector Memory: Store conversation summary ──
          if (openaiKey && finalAssistantContent && finalAssistantContent.length > 30) {
            const greetingRe = /^(hi|hello|hey|salut|buna|ola|ciao)\b/i;
            if (!greetingRe.test(lastUserMsg.trim())) {
              const summary = `Q: ${lastUserMsg.slice(0, 200)}\nA: ${finalAssistantContent.slice(0, 300)}`;
              (async () => {
                try {
                  const embResp = await fetch("https://api.openai.com/v1/embeddings", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ model: "text-embedding-3-small", input: summary }),
                  });
                  if (embResp.ok) {
                    const embData = await embResp.json();
                    await serviceClient.from("memory_embeddings").insert({
                      user_id: userId,
                      content: summary,
                      embedding: JSON.stringify(embData.data[0].embedding),
                      memory_type: "conversation_summary",
                      metadata: { conversation_id: conversationId },
                    });
                  }
                } catch (memStoreErr) {
                  console.error("Memory storage error (non-fatal):", memStoreErr);
                }
              })();
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          console.error("Stream error:", e);
          const errMsg = e instanceof Error ? e.message : "Unknown error";
          sendSSE({ type: "reasoning", text: `Error: ${errMsg}` });
          sendSSE({ error: errMsg });
          sendSSE({ choices: [{ delta: { content: `\n\n⚠️ Something went wrong: ${errMsg}. Please try again.` } }] });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
