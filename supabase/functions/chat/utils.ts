export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function clampDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

export function normalizeSalesReportDates(args: any): any {
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

export function normalizeCompareSalesDates(args: any): any {
  if (!args.period_a_start || !args.period_a_end || !args.period_b_start || !args.period_b_end) return args;

  const aStart = new Date(args.period_a_start);
  const aEnd = new Date(args.period_a_end);
  const bStart = new Date(args.period_b_start);
  const bEnd = new Date(args.period_b_end);

  const aSame = aStart.getTime() === bStart.getTime() && aEnd.getTime() === bEnd.getTime();
  const aDays = Math.round((aEnd.getTime() - aStart.getTime()) / 864e5);
  const bDays = Math.round((bEnd.getTime() - bStart.getTime()) / 864e5);
  const spanMismatch = Math.abs(aDays - bDays) > 1;

  if (aSame || spanMismatch) {
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

export function coerceMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (
          item &&
          typeof item === "object" &&
          "text" in item &&
          typeof (item as { text?: unknown }).text === "string"
        ) {
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

export function sanitizeAiHistory(messages: Array<{ role: string; content: unknown }>) {
  return messages
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: coerceMessageContent(message.content),
    }));
}

export function truncateForAI(toolName: string, result: any): any {
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

    if (toolName === "get_product_sales_report") {
      return {
        total_revenue: result.total_revenue,
        total_orders: result.total_orders,
        product_count: result.product_count,
        products: Array.isArray(result.products) ? result.products.slice(0, 20) : result.products,
      };
    }

    if (toolName === "get_top_customers") {
      return {
        total_revenue: result.total_revenue,
        total_orders: result.total_orders,
        customer_count: result.customer_count,
        customers: Array.isArray(result.customers) ? result.customers.slice(0, 20) : result.customers,
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

    if (toolName === "get_orders_with_meta" && Array.isArray(result)) {
      return result.slice(0, 30).map((item: any) => ({
        id: item.id,
        status: item.status,
        total: item.total,
        currency: item.currency,
        date_created: item.date_created,
        billing: item.billing ? { first_name: item.billing.first_name, last_name: item.billing.last_name } : undefined,
        meta_data: item.meta_data,
        line_items: Array.isArray(item.line_items)
          ? item.line_items.map((li: any) => ({ name: li.name, quantity: li.quantity }))
          : [],
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

    if (toolName === "check_shipping_status") {
      return {
        order_id: result.order_id,
        awb: result.awb,
        courier: result.courier,
        service: result.service,
        status_name: result.status_name,
        is_delivered: result.is_delivered,
        order_status: result.order_status,
        current_status: result.current_status,
        history_count: Array.isArray(result.history) ? result.history.length : 0,
      };
    }

    if (toolName === "audit_geo") {
      return { score: result.score, entityName: result.entityName, categories: result.categories, recommendations: result.recommendations?.slice(0, 5) };
    }
    if (toolName === "generate_geo_content") {
      return { optimized: result.optimized, entityName: result.entityName, meta_description: result.meta_description, meta_fields: result.meta_fields, seo_plugin: result.seo_plugin };
    }
    if (toolName === "bulk_geo_audit") {
      return { items: result.items?.slice(0, 20), averageScore: result.averageScore };
    }

    if (str.length > 4000) {
      return { summary: `Data received (${str.length} chars, truncated for context). Key fields preserved above.` };
    }
    return result;
  } catch {
    return { summary: "Data received (truncated for context)" };
  }
}
