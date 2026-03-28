import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
      description:
        "Get sales analytics — revenue, order count, top products, trends. Always use date_min and date_max for accurate results.",
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
      name: "get_product_sales",
      description:
        "Get sales history for a specific product over a date range. Returns units sold, daily breakdown, revenue from this product, and orders containing it. Use this to analyze stock burn rate and restock timing. Call this AFTER search_products to get sales velocity data.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "number", description: "WooCommerce product ID" },
          days: { type: "number", description: "Number of days to look back (default 60)" },
          date_min: { type: "string", description: "Override start date (YYYY-MM-DD)" },
          date_max: { type: "string", description: "Override end date (YYYY-MM-DD)" },
        },
        required: ["product_id"],
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

// ── Deterministic date utilities ──
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clampDay(year: number, month: number, day: number): Date {
  // month is 0-indexed; clamp day to last day of that month
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

/**
 * Normalize date args for get_sales_report / compare_sales so that
 * "this month vs last month same period" always produces correct ranges.
 */
function normalizeSalesReportDates(args: any): any {
  const now = new Date();
  const today = formatDate(now);
  const period = (args.period || "").toLowerCase();

  if (period === "today") return { ...args, date_min: today, date_max: today };
  if (period === "week") {
    return { ...args, date_min: formatDate(new Date(now.getTime() - 6 * 864e5)), date_max: today };
  }
  if (period === "month") {
    return { ...args, date_min: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)), date_max: today };
  }
  if (period === "year") {
    return { ...args, date_min: `${now.getFullYear()}-01-01`, date_max: today };
  }
  return args;
}

function normalizeCompareSalesDates(args: any): any {
  // If both periods are provided, validate and fix "same period" mismatches
  if (!args.period_a_start || !args.period_a_end || !args.period_b_start || !args.period_b_end) return args;

  const aStart = new Date(args.period_a_start);
  const aEnd = new Date(args.period_a_end);
  const bStart = new Date(args.period_b_start);
  const bEnd = new Date(args.period_b_end);

  // Detect if period A and period B have the same dates (LLM bug)
  const aSame = aStart.getTime() === bStart.getTime() && aEnd.getTime() === bEnd.getTime();
  // Detect if period B doesn't match the same day-span as period A
  const aDays = Math.round((aEnd.getTime() - aStart.getTime()) / 864e5);
  const bDays = Math.round((bEnd.getTime() - bStart.getTime()) / 864e5);
  const spanMismatch = Math.abs(aDays - bDays) > 1;

  if (aSame || spanMismatch) {
    // Assume period A is "current" and period B should be the equivalent previous period
    // Shift B to one month before A with same day span
    const prevStart = clampDay(aStart.getFullYear(), aStart.getMonth() - 1, aStart.getDate());
    const prevEnd = clampDay(aEnd.getFullYear(), aEnd.getMonth() - 1, aEnd.getDate());
    return {
      ...args,
      period_b_start: formatDate(prevStart),
      period_b_end: formatDate(prevEnd),
    };
  }
  return args;
}

const TOOL_LABELS: Record<string, string> = {
  search_products: "Searching products",
  get_product: "Getting product details",
  search_orders: "Searching orders",
  create_order: "Creating order",
  update_order_status: "Updating order status",
  get_sales_report: "Generating sales report",
  compare_sales: "Comparing sales periods",
  get_product_sales: "Analyzing product sales",
  save_preference: "Saving preference",
};

interface SemanticStep {
  title: string;
  details?: string;
}

function coerceMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item && typeof (item as { text?: unknown }).text === "string") {
          return (item as { text: string }).text;
        }

        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .join("\n")
      .trim();
  }

  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function sanitizeAiHistory(messages: Array<{ role: string; content: unknown }>) {
  return messages
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: coerceMessageContent(message.content),
    }));
}

/** Truncate large tool results before feeding back to AI context */
function truncateForAI(toolName: string, result: any): any {
  try {
    const str = JSON.stringify(result);
    if (str.length < 3000) return result;

    if (toolName === "get_sales_report") {
      return {
        totalRevenue: result.totalRevenue,
        orderCount: result.orderCount,
        averageOrderValue: result.averageOrderValue,
        topProducts: Array.isArray(result.topProducts) ? result.topProducts.slice(0, 10) : result.topProducts,
        dailyBreakdown: Array.isArray(result.dailyBreakdown)
          ? `${result.dailyBreakdown.length} days of data (truncated for context)`
          : result.dailyBreakdown,
      };
    }

    if (toolName === "get_product_sales") {
      return {
        total_units_sold: result.total_units_sold,
        total_revenue: result.total_revenue,
        days_analyzed: result.days_analyzed,
        daily_burn_rate: result.daily_burn_rate,
        daily_breakdown: Array.isArray(result.daily_breakdown)
          ? `${result.daily_breakdown.length} days (truncated)`
          : result.daily_breakdown,
      };
    }

    if (toolName === "compare_sales") {
      return {
        period_a_revenue: result.period_a_revenue,
        period_b_revenue: result.period_b_revenue,
        change_revenue: result.change_revenue,
        period_a_orders: result.period_a_orders,
        period_b_orders: result.period_b_orders,
        change_orders: result.change_orders,
        topProducts: Array.isArray(result.topProducts) ? result.topProducts.slice(0, 10) : result.topProducts,
      };
    }

    if (toolName === "search_orders" && Array.isArray(result)) {
      return result.slice(0, 10).map((item: any) => ({
        id: item.id,
        status: item.status,
        total: item.total,
        date_created: item.date_created,
        billing: item.billing ? { first_name: item.billing.first_name, last_name: item.billing.last_name } : undefined,
      }));
    }

    if (toolName === "search_products" && Array.isArray(result)) {
      return result.slice(0, 10).map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        stock_quantity: item.stock_quantity,
        total_sales: item.total_sales,
      }));
    }

    // Generic fallback: truncate string
    if (str.length > 4000) {
      return { summary: `Data received (${str.length} chars, truncated for context). Key fields preserved above.` };
    }
    return result;
  } catch {
    return { summary: "Data received (truncated for context)" };
  }
}

function generateReasoningBefore(toolName: string, args: any): string {
  switch (toolName) {
    case "search_products":
      return `Looking up products matching '${args.search || ""}' in catalog...`;
    case "get_product":
      return `Fetching full details for product #${args.product_id}...`;
    case "search_orders": {
      const parts: string[] = [];
      if (args.search) parts.push(`matching '${args.search}'`);
      if (args.status) parts.push(`with status '${args.status}'`);
      if (args.after || args.before) parts.push(`in date range`);
      return `Searching orders ${parts.join(" ") || ""}...`;
    }
    case "get_sales_report":
      return `Pulling sales data${args.date_min ? ` from ${args.date_min} to ${args.date_max}` : ""}...`;
    case "compare_sales":
      return `Comparing ${args.period_a_label || "Period A"} vs ${args.period_b_label || "Period B"}...`;
    case "get_product_sales":
      return `Fetching sales history for product #${args.product_id} over last ${args.days || 60} days...`;
    case "create_order":
      return `Preparing new order with ${args.line_items?.length || 0} items...`;
    case "update_order_status":
      return `Updating order #${args.order_id} to '${args.status}'...`;
    case "save_preference":
      return `Saving preference: "${args.key}"...`;
    default:
      return `Running ${toolName}...`;
  }
}

function generateReasoningAfter(toolName: string, result: any): string | null {
  try {
    switch (toolName) {
      case "search_products": {
        if (Array.isArray(result)) {
          const count = result.length;
          if (count === 0) return "No products found.";
          const first = result[0];
          return `Found ${count} product${count > 1 ? "s" : ""}. ${first.name ? `First: ${first.name}` : ""}${first.stock_quantity != null ? ` (stock: ${first.stock_quantity})` : ""}`;
        }
        return null;
      }
      case "get_product": {
        if (result?.name) return `Got: ${result.name}${result.stock_quantity != null ? ` — ${result.stock_quantity} in stock` : ""}`;
        return null;
      }
      case "search_orders": {
        if (Array.isArray(result)) return `Found ${result.length} order${result.length !== 1 ? "s" : ""}.`;
        return null;
      }
      case "get_sales_report": {
        if (result?.orderCount != null) return `${result.orderCount} orders, ${result.totalRevenue} lei total revenue.`;
        return null;
      }
      case "get_product_sales": {
        if (result?.total_units_sold != null) {
          return `${result.total_units_sold} units sold over ${result.days_analyzed} days. Burn rate: ${result.daily_burn_rate}/day.`;
        }
        return null;
      }
      case "compare_sales": {
        if (result?.change_revenue != null) {
          const dir = result.change_revenue >= 0 ? "+" : "";
          return `Revenue difference: ${dir}${result.change_revenue} lei, orders difference: ${result.change_orders >= 0 ? "+" : ""}${result.change_orders}.`;
        }
        return null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}


function generateSemanticPlan(toolCalls: any[]): SemanticStep[] {
  const steps: SemanticStep[] = [];

  for (const tc of toolCalls) {
    const name = tc.function.name;
    const args = JSON.parse(tc.function.arguments);

    switch (name) {
      case "compare_sales": {
        const labelA = args.period_a_label || "Period A";
        const labelB = args.period_b_label || "Period B";
        const dateDetail = args.period_a_start && args.period_b_start
          ? `${args.period_a_start} → ${args.period_a_end} vs ${args.period_b_start} → ${args.period_b_end}`
          : undefined;
        steps.push({ title: "Resolving date ranges", details: dateDetail });
        steps.push({ title: `Fetching orders for ${labelA}` });
        steps.push({ title: `Fetching orders for ${labelB}` });
        steps.push({ title: "Comparing periods" });
        steps.push({ title: "Building dashboard" });
        break;
      }
      case "get_sales_report": {
        const dateDetail = args.date_min && args.date_max
          ? `${args.date_min} → ${args.date_max}`
          : args.period || undefined;
        steps.push({ title: "Resolving date range", details: dateDetail });
        steps.push({ title: "Fetching orders" });
        steps.push({ title: "Calculating metrics" });
        steps.push({ title: "Building dashboard" });
        break;
      }
      case "search_products":
        steps.push({ title: "Searching product catalog", details: args.search ? `Query: "${args.search}"` : undefined });
        steps.push({ title: "Rendering results" });
        break;
      case "get_product":
        steps.push({ title: "Fetching product details", details: args.product_id ? `ID: ${args.product_id}` : undefined });
        break;
      case "search_orders":
        steps.push({ title: "Searching orders", details: args.search || args.status || undefined });
        steps.push({ title: "Rendering results" });
        break;
      case "get_product_sales": {
        const daysVal = args.days || 60;
        steps.push({ title: "Analyzing sales velocity", details: `Product #${args.product_id} — last ${daysVal} days` });
        steps.push({ title: "Calculating burn rate" });
        steps.push({ title: "Building inventory report" });
        break;
      }
      case "create_order":
      case "update_order_status":
        steps.push({ title: "Preparing order action" });
        steps.push({ title: "Awaiting approval" });
        break;
      case "save_preference":
        steps.push({ title: "Saving preference", details: args.key || undefined });
        break;
      default:
        steps.push({ title: TOOL_LABELS[name] || name });
    }
  }

  // Add post-tool synthesis steps
  steps.push({ title: "Writing explanation" });
  return steps;
}

async function callWooProxy(supabaseUrl: string, authHeader: string, payload: any) {
  const resp = await fetch(`${supabaseUrl}/functions/v1/woo-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(payload),
  });
  // Harden against truncated/non-JSON responses
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error("callWooProxy: failed to parse response as JSON, length:", text.length, "preview:", text.slice(0, 200));
    return { error: "Invalid response from store API", raw_preview: text.slice(0, 300) };
  }
}

async function executeTool(
  toolName: string,
  args: any,
  supabaseUrl: string,
  authHeader: string,
  userId: string,
  supabase: any,
  defaultOrderStatuses: string[] = [],
): Promise<{ result: any; richContent?: any; requestUri?: string }> {
  switch (toolName) {
    case "search_products": {
      const params = new URLSearchParams();
      params.set("search", args.search);
      if (args.category) params.set("category", args.category);
      params.set("per_page", String(args.per_page || 10));
      const endpoint = `products?${params.toString()}`;
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint });
      return {
        result: data,
        richContent: { type: "products", data: Array.isArray(data) ? data : [] },
        requestUri: `GET /wp-json/wc/v3/${endpoint}`,
      };
    }
    case "get_product": {
      const endpoint = `products/${args.product_id}`;
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint });
      return {
        result: data,
        richContent: { type: "products", data: [data] },
        requestUri: `GET /wp-json/wc/v3/${endpoint}`,
      };
    }
    case "search_orders": {
      const params = new URLSearchParams();
      if (args.status) params.set("status", args.status);
      else if (defaultOrderStatuses.length) params.set("status", defaultOrderStatuses.join(","));
      if (args.search) params.set("search", args.search);
      if (args.after) params.set("after", args.after);
      if (args.before) params.set("before", args.before);
      params.set("per_page", String(args.per_page || 10));
      const endpoint = `orders?${params.toString()}`;
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint });
      return {
        result: data,
        richContent: { type: "orders", data: Array.isArray(data) ? data : [] },
        requestUri: `GET /wp-json/wc/v3/${endpoint}`,
      };
    }
    case "create_order": {
      const endpoint = "orders";
      const data = await callWooProxy(supabaseUrl, authHeader, {
        endpoint,
        method: "POST",
        body: { line_items: args.line_items, customer_id: args.customer_id || 0, status: args.status || "processing" },
      });
      return { result: data, requestUri: `POST /wp-json/wc/v3/${endpoint}` };
    }
    case "update_order_status": {
      const endpoint = `orders/${args.order_id}`;
      const data = await callWooProxy(supabaseUrl, authHeader, {
        endpoint,
        method: "PUT",
        body: { status: args.status },
      });
      return { result: data, requestUri: `PUT /wp-json/wc/v3/${endpoint}` };
    }
    case "get_sales_report": {
      const params = new URLSearchParams();
      params.set("per_page", "100");
      if (defaultOrderStatuses.length) params.set("status", defaultOrderStatuses.join(","));
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
      const chartData = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
      return {
        result: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          orderCount: orders.length,
          dailyBreakdown: chartData,
        },
        richContent: {
          type: "chart",
          data: {
            type: "bar",
            title: `Sales Report (${args.period || "custom"})`,
            data: chartData,
            dataKey: "value",
            nameKey: "name",
          },
        },
        requestUri: `GET /wp-json/wc/v3/${endpoint}`,
      };
    }
    case "compare_sales": {
      const fetchPeriod = async (start: string, end: string) => {
        const params = new URLSearchParams();
        params.set("per_page", "100");
        if (defaultOrderStatuses.length) params.set("status", defaultOrderStatuses.join(","));
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
        richContent: {
          type: "chart",
          data: {
            type: "grouped_bar",
            title: `${labelA} vs ${labelB}`,
            data: chartData,
            dataKeys: [labelA, labelB],
            nameKey: "name",
          },
        },
        requestUri: `GET /wp-json/wc/v3/orders (x2 periods)`,
      };
    }
    case "get_product_sales": {
      const days = args.days || 60;
      const now = new Date();
      const endDate = args.date_max || formatDate(now);
      const startDate = args.date_min || formatDate(new Date(now.getTime() - days * 864e5));

      // Fetch orders in the date range (paginated, up to 3 pages of 100)
      let allOrders: any[] = [];
      for (let page = 1; page <= 3; page++) {
        const params = new URLSearchParams();
        params.set("per_page", "100");
        params.set("page", String(page));
        params.set("after", `${startDate}T00:00:00`);
        params.set("before", `${endDate}T23:59:59`);
        if (defaultOrderStatuses.length) params.set("status", defaultOrderStatuses.join(","));
        const orders = await callWooProxy(supabaseUrl, authHeader, { endpoint: `orders?${params.toString()}` });
        if (!Array.isArray(orders) || orders.length === 0) break;
        allOrders = allOrders.concat(orders);
        if (orders.length < 100) break;
      }

      const productId = args.product_id;
      let totalUnits = 0;
      let totalRevenue = 0;
      const dailyUnits: Record<string, number> = {};
      const matchingOrders: any[] = [];

      // Fill all days with 0
      const cur = new Date(startDate);
      const end = new Date(endDate);
      while (cur <= end) {
        dailyUnits[formatDate(cur)] = 0;
        cur.setDate(cur.getDate() + 1);
      }

      for (const order of allOrders) {
        const lineItems = order.line_items || [];
        for (const li of lineItems) {
          // Match by product_id or variation parent
          if (li.product_id === productId || li.variation_id === productId || (li.parent_name && li.product_id === productId)) {
            const qty = li.quantity || 0;
            const rev = parseFloat(li.total || "0");
            totalUnits += qty;
            totalRevenue += rev;
            const date = order.date_created?.split("T")[0] || "unknown";
            dailyUnits[date] = (dailyUnits[date] || 0) + qty;
            matchingOrders.push({
              order_id: order.id,
              date: date,
              quantity: qty,
              total: rev,
              status: order.status,
            });
          }
        }
      }

      const actualDays = Math.max(1, Math.round((end.getTime() - new Date(startDate).getTime()) / 864e5));
      const burnRate = Math.round((totalUnits / actualDays) * 100) / 100;
      const weeklyRate = Math.round(burnRate * 7 * 100) / 100;

      const chartData = Object.entries(dailyUnits)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, value]) => ({ name, value }));

      return {
        result: {
          product_id: productId,
          period: `${startDate} → ${endDate}`,
          total_units_sold: totalUnits,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          days_analyzed: actualDays,
          daily_burn_rate: burnRate,
          weekly_burn_rate: weeklyRate,
          daily_breakdown: chartData,
          matching_orders: matchingOrders.slice(0, 20),
          orders_scanned: allOrders.length,
        },
        richContent: {
          type: "chart",
          data: {
            type: "line",
            title: `Units Sold — Product #${productId} (${startDate} → ${endDate})`,
            data: chartData,
            dataKey: "value",
            nameKey: "name",
          },
        },
        requestUri: `GET /wp-json/wc/v3/orders (filtered for product #${productId})`,
      };
    }
    case "save_preference": {
      await supabase
        .from("user_preferences")
        .upsert(
          { user_id: userId, preference_type: args.preference_type, key: args.key, value: args.value },
          { onConflict: "user_id,preference_type,key" },
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

    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("preference_type, key, value")
      .eq("user_id", userId);
    let prefsContext = "";
    if (prefs?.length) {
      prefsContext =
        "\n\nUser's saved preferences/aliases:\n" +
        prefs.map((p: any) => `- ${p.preference_type}: "${p.key}" → ${JSON.stringify(p.value)}`).join("\n");
    }

    const { data: connData } = await supabase
      .from("woo_connections")
      .select("response_language, order_statuses")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    const responseLanguage = connData?.response_language || "English";
    const userOpenAIKey = Deno.env.get("OPENAI_API_KEY") || null;
    const defaultOrderStatuses: string[] = (connData as any)?.order_statuses || [];

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

    const systemPrompt = `You are a WooCommerce store assistant. You help manage their online store through conversation.${languageInstruction}

Your capabilities:
- Search and browse products (shown as interactive visual cards automatically)
- Create and manage orders
- Provide sales analytics and insights with charts and dashboards
- Learn the user's preferences and product aliases

CRITICAL TOOL USAGE RULES — YOU MUST FOLLOW THESE:
1. When the user asks to search, find, browse, or look up products: you MUST call the search_products tool. NEVER answer with a plain text list of products. The frontend renders product cards from the tool result automatically.
2. When the user asks about orders, recent orders, or order lookups: you MUST call the search_orders tool.
3. When the user asks for a sales report, revenue, analytics, or dashboard: you MUST call get_sales_report or compare_sales. After receiving the data you MUST also emit a \`\`\`dashboard code block with cards and charts.
4. When the user asks to compare periods: you MUST call compare_sales with proper date ranges and then emit a \`\`\`dashboard code block.
5. NEVER respond with plain text summaries of data that should come from a tool. If data is needed, call the tool first.
6. NEVER ask the user for information you can look up with tools. NEVER ask permission to run a tool. NEVER explain what data you need before fetching it. Just call the tool. This applies especially in follow-up messages where you realize you need more data.

AUTONOMOUS DATA GATHERING (ABSOLUTE RULE):
- You MUST NEVER tell the user you need more data or ask permission to fetch data. If you need product-level data, sales breakdowns, order details, or ANY information available through your tools — CALL THE TOOLS IMMEDIATELY without asking.
- If the user asks a question and you realize you don't have enough data to answer, your ONLY correct response is to call the appropriate tools. NEVER say "let me know if you want me to fetch this" or "I need to pull this data first, shall I proceed?"
- When the user asks about predictions, estimates, or forecasts: ALWAYS call get_sales_report with date ranges to get product-level data, then analyze it. Do not explain what you would need — just get it.
- For product dominance / top products analysis: call get_sales_report for the relevant period. The tool returns top_products data. Use it directly.
- WRONG: "I need product-level data. Should I fetch it?"
- RIGHT: *calls get_sales_report tool with current month dates*

STOCK & INVENTORY ANALYSIS (CRITICAL — MULTI-TOOL CHAINING):
- When the user asks about stock levels, restock timing, inventory, or "when should I buy more":
  1. FIRST call search_products to find the product and get current stock quantity (stock_quantity field)
  2. THEN call get_product_sales with the product_id to get sales velocity over the last 60 days
  3. From the results, calculate:
     - burn_rate = total_units_sold / days_analyzed
     - days_of_stock_remaining = current_stock / burn_rate
     - estimated_stockout_date = today + days_of_stock_remaining
     - recommended_reorder_date = stockout_date minus ~7-10 days for supplier lead time
  4. Present a visual \`\`\`dashboard block with:
     - Stat cards: Current Stock, Units Sold (period), Burn Rate/day, Days Until Stockout, Recommended Reorder Date
     - The sales velocity chart is rendered automatically from the tool
     - Table: recent orders containing this product (from get_product_sales results)
     - Insights list: stockout prediction, reorder recommendation, trend observations
- You MUST chain these tools automatically. NEVER ask the user how many they sell per week/month — you have the tools to look it up!
- If multiple product variants match, analyze each one separately and present combined insights.

MULTI-TOOL EXECUTION:
- When the user's request requires data from multiple sources (e.g. "create a dashboard comparing this month to last month"), call ALL necessary tools. You can call multiple tools in a single response or across multiple turns. Do not stop after one tool call if more data is needed.
- For comparisons, call tools separately for each period/dataset needed.
- For inventory analysis, call search_products FIRST, then use the product IDs from the results to call get_product_sales.

When the user refers to a product casually (e.g. "pasta bourbon"), search for it first. If you identify a pattern or alias, save it as a preference.

When creating orders, always search for products first to confirm the right items, then create the order.

PRODUCT DISPLAY RULES:
- When products are found, do NOT list product details in text — they are displayed as interactive cards automatically.
- Just provide a brief summary like "Found X products matching your search." or "Here are the results:".

DASHBOARD/REPORT DISPLAY RULES:
- After analyzing sales data (get_sales_report, compare_sales, get_product_sales for inventory), you MUST include a structured dashboard JSON block in your response.
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

DATE CALCULATION RULES (CRITICAL):
- Today's date is: ${formatDate(new Date())}
- "This month" = first day of current month → today.
- "Last month same period" = first day of previous month → same day-of-month as today (capped to last day of that month).
  Example: if today is 2026-03-26, "this month" = 2026-03-01 to 2026-03-26, "last month same period" = 2026-02-01 to 2026-02-26.
- "This week" = 7 days ago → today. "Last week same period" = 14 days ago → 8 days ago.
- NEVER use the same dates for both periods in a comparison. Each period must have distinct date ranges.

Be conversational, efficient, and proactive. Use markdown for formatting. Currency is RON (lei).${defaultStatusStr}${prefsContext}${viewContext}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY && !userOpenAIKey) throw new Error("No AI API key configured");

    const useOpenAI = !!userOpenAIKey;
    const aiBaseUrl = useOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiAuthHeader = useOpenAI ? `Bearer ${userOpenAIKey}` : `Bearer ${LOVABLE_API_KEY}`;
    const aiModel = useOpenAI ? "gpt-5.4-nano" : "google/gemini-3-flash-preview";

    // Trim conversation history to last 20 messages to prevent context bloat
    const trimmedHistory = sanitizeAiHistory(messages).slice(-20);
    let aiMessages: any[] = [{ role: "system", content: systemPrompt }, ...trimmedHistory];
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
          let semanticSteps: SemanticStep[] = [];

          // Emit "Understanding request" immediately
          sendSSE({ type: "pipeline_plan", title: "Execution Plan", steps: ["Understanding request"] });
          sendSSE({ type: "pipeline_step", stepIndex: 0, title: "Understanding request", status: "running" });

          while (maxIterations-- > 0) {
            // Iteration pressure: force final answer when running low
            if (maxIterations <= 2) {
              aiMessages.push({
                role: "system",
                content: "CRITICAL: You are running low on processing steps. You MUST produce your final answer NOW using the data you already have. Do NOT call any more tools. Summarize and present what you have.",
              });
            }
            sendSSE({ type: "reasoning", text: "Thinking..." });

            // Keep-alive: send periodic pings during AI fetch to prevent connection drops
            const aiRequest = fetch(aiBaseUrl, {
              method: "POST",
              headers: { Authorization: aiAuthHeader, "Content-Type": "application/json" },
              body: JSON.stringify({ model: aiModel, messages: aiMessages, tools: TOOLS, stream: false }),
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
            const choice = aiData.choices?.[0];
            if (!choice) break;

            const content = choice.message?.content || "";

            if (choice.finish_reason === "tool_calls" || choice.message?.tool_calls?.length) {
              const toolCalls = choice.message.tool_calls;
               aiMessages.push({
                 role: "assistant",
                 content: coerceMessageContent(content),
                 tool_calls: choice.message.tool_calls,
               });

              // Mark "Understanding request" as done and emit semantic plan
              if (!planSent) {
                sendSSE({ type: "pipeline_step", stepIndex: 0, title: "Understanding request", status: "done" });
                semanticSteps = generateSemanticPlan(toolCalls);
                const allStepTitles = ["Understanding request", ...semanticSteps.map(s => s.title)];
                sendSSE({ type: "pipeline_plan", title: "Execution Plan", steps: allStepTitles });
                stepIndex = 1; // step 0 was "Understanding request"
                planSent = true;
              }

              // Track which semantic step we're on
              let semanticIdx = 0;

              for (const tc of toolCalls) {
                let args: any;
                try {
                  args = JSON.parse(tc.function.arguments);
                } catch {
                  console.error("Failed to parse tool arguments:", tc.function.arguments);
                  sendSSE({ type: "reasoning", text: `Failed to parse arguments for ${tc.function.name}, skipping...` });
                  aiMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "Invalid arguments" }) });
                  continue;
                }
                const toolName = tc.function.name;
                const stepLabel = TOOL_LABELS[toolName] || toolName;

                // Advance semantic steps that are pre-tool (e.g. "Resolving date ranges")
                while (semanticIdx < semanticSteps.length) {
                  const ss = semanticSteps[semanticIdx];
                  // Check if this is a "pre-execution" step (resolving, preparing)
                  if (ss.title.startsWith("Resolving") || ss.title.startsWith("Preparing")) {
                    sendSSE({ type: "pipeline_step", stepIndex, title: ss.title, status: "running", details: ss.details });
                    sendSSE({ type: "pipeline_step", stepIndex, title: ss.title, status: "done", details: ss.details });
                    stepIndex++;
                    semanticIdx++;
                  } else {
                    break;
                  }
                }

                // Get the current semantic step title for this tool execution
                const currentSemanticTitle = semanticIdx < semanticSteps.length
                  ? semanticSteps[semanticIdx].title
                  : stepLabel;
                const currentSemanticDetails = semanticIdx < semanticSteps.length
                  ? semanticSteps[semanticIdx].details
                  : undefined;

                // Emit reasoning before tool call
                sendSSE({ type: "reasoning", text: generateReasoningBefore(toolName, args) });

                sendSSE({ type: "pipeline_step", stepIndex, title: currentSemanticTitle, status: "running", details: currentSemanticDetails, toolName, args });

                if (WRITE_TOOLS.has(toolName) && !approvalResponse) {
                  sendSSE({
                    type: "approval_request",
                    stepIndex,
                    title: currentSemanticTitle,
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

                  sendSSE({ type: "pipeline_step", stepIndex, title: currentSemanticTitle, status: "needs_approval" });
                  stepIndex++;
                  semanticIdx++;
                  continue;
                }

                // Normalize dates for sales tools
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
                  );
                  result = toolResult.result;
                  richContent = toolResult.richContent;
                  requestUri = toolResult.requestUri;
                } catch (toolErr) {
                  console.error(`Tool ${toolName} failed:`, toolErr);
                  const errMsg = toolErr instanceof Error ? toolErr.message : "Unknown tool error";
                  result = { error: errMsg };
                  sendSSE({ type: "reasoning", text: `Tool "${toolName}" failed: ${errMsg}. Continuing...` });
                  sendSSE({ type: "pipeline_step", stepIndex, title: currentSemanticTitle, status: "error", details: errMsg });
                  aiMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: errMsg }) });
                  stepIndex++;
                  semanticIdx++;
                  continue;
                }

                sendSSE({ type: "debug_api", toolName, args, result, requestUri });

                const reasoningAfter = generateReasoningAfter(toolName, result);
                if (reasoningAfter) sendSSE({ type: "reasoning", text: reasoningAfter });

                if (richContent) {
                  sendSSE({ type: "rich_content", ...richContent });
                }

                sendSSE({
                  type: "pipeline_step",
                  stepIndex,
                  title: currentSemanticTitle,
                  status: "done",
                  details: currentSemanticDetails,
                });

                // Truncate large results before feeding back to AI to prevent context bloat
                aiMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(truncateForAI(toolName, result)) });
                stepIndex++;
                semanticIdx++;

                // Mark any remaining intermediate semantic steps (e.g. "Comparing periods") as done
                while (semanticIdx < semanticSteps.length) {
                  const ss = semanticSteps[semanticIdx];
                  if (ss.title === "Writing explanation" || ss.title === "Building dashboard" || ss.title === "Rendering results" || ss.title === "Building inventory report") break;
                  if (ss.title.startsWith("Fetching") || ss.title === "Awaiting approval" || ss.title.startsWith("Analyzing")) break;
                  sendSSE({ type: "pipeline_step", stepIndex, title: ss.title, status: "running", details: ss.details });
                  sendSSE({ type: "pipeline_step", stepIndex, title: ss.title, status: "done", details: ss.details });
                  stepIndex++;
                  semanticIdx++;
                }
              }
              continue;
            }

            // Post-tool synthesis: tick remaining semantic steps
            sendSSE({ type: "reasoning", text: "Preparing your response..." });
            if (planSent && stepIndex > 0) {
              // Mark remaining semantic steps (Building dashboard, Writing explanation)
              for (let i = 0; i < semanticSteps.length; i++) {
                const ss = semanticSteps[i];
                if (ss.title === "Building dashboard" || ss.title === "Rendering results" || ss.title === "Building inventory report" || ss.title === "Calculating burn rate") {
                  sendSSE({ type: "reasoning", text: `${ss.title}...` });
                  sendSSE({ type: "pipeline_step", stepIndex, title: ss.title, status: "running" });
                  sendSSE({ type: "pipeline_step", stepIndex, title: ss.title, status: "done" });
                  stepIndex++;
                }
                if (ss.title === "Writing explanation") {
                  sendSSE({ type: "pipeline_step", stepIndex, title: ss.title, status: "running" });
                }
              }
            } else if (!planSent) {
              // No tools were called — mark Understanding request as done
              sendSSE({ type: "pipeline_step", stepIndex: 0, title: "Understanding request", status: "done" });
            }

            if (content) {
              // Parse dashboard blocks from content
              const dashboardRegex = /```dashboard\s*\n([\s\S]*?)```/g;
              let textContent = content;
              let match;
              while ((match = dashboardRegex.exec(content)) !== null) {
                try {
                  const dashboardData = JSON.parse(match[1].trim());
                  sendSSE({ type: "dashboard", data: dashboardData });
                  textContent = textContent.replace(match[0], "").trim();
                } catch {
                  /* ignore malformed JSON */
                }
              }
              if (textContent) {
                sendSSE({ choices: [{ delta: { content: textContent } }] });
              }
            }

            // Mark writing explanation step done and send pipeline_complete
            if (planSent && stepIndex > 0) {
              sendSSE({ type: "pipeline_step", stepIndex, title: "Writing explanation", status: "done" });
              stepIndex++;
            }
            sendSSE({ type: "pipeline_complete", lastStepIndex: stepIndex });
            break;
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          console.error("Stream error:", e);
          const errMsg = e instanceof Error ? e.message : "Unknown error";
          // Emit a visible error reasoning so the user sees what happened
          sendSSE({ type: "reasoning", text: `Error: ${errMsg}` });
          // Emit error as structured SSE so frontend can handle it
          sendSSE({ error: errMsg });
          // Also emit a text delta so the assistant bubble has content
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
