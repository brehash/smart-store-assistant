import type { SemanticStep } from "./types.ts";

export const TOOL_LABELS: Record<string, string> = {
  search_products: "Searching products",
  get_product: "Getting product details",
  search_orders: "Searching orders",
  create_order: "Creating order",
  update_order_status: "Updating order status",
  update_order: "Updating order",
  delete_order: "Deleting order",
  create_product: "Creating product",
  update_product: "Updating product",
  delete_product: "Deleting product",
  create_page: "Creating page",
  update_page: "Updating page",
  delete_page: "Deleting page",
  create_post: "Creating post",
  update_post: "Updating post",
  delete_post: "Deleting post",
  get_sales_report: "Generating sales report",
  compare_sales: "Comparing sales periods",
  get_product_sales: "Analyzing product sales",
  get_product_sales_report: "Analyzing product performance",
  get_orders_with_meta: "Fetching orders with metadata",
  save_preference: "Saving preference",
  check_shipping_status: "Checking shipping status",
  audit_geo: "Auditing GEO readiness",
  generate_geo_content: "Generating GEO content",
  bulk_geo_audit: "Running bulk GEO audit",
  get_top_customers: "Analyzing top customers",
};

export function generateReasoningBefore(toolName: string, args: any): string {
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
    case "get_product_sales_report":
      return `Aggregating per-product sales from ${args.date_min} to ${args.date_max}...`;
    case "get_top_customers":
      return `Aggregating top customers from ${args.date_min} to ${args.date_max}...`;
    case "create_order":
      return `Preparing new order with ${args.line_items?.length || 0} items...`;
    case "update_order_status":
      return `Updating order #${args.order_id} to '${args.status}'...`;
    case "update_order":
      return `Updating order #${args.order_id}...`;
    case "delete_order":
      return `Deleting order #${args.order_id}${args.force ? " permanently" : ""}...`;
    case "create_product":
      return `Creating product "${args.name || "unnamed"}"...`;
    case "update_product":
      return `Updating product #${args.product_id}...`;
    case "delete_product":
      return `Deleting product #${args.product_id}${args.force ? " permanently" : ""}...`;
    case "create_page":
      return `Creating page "${args.title || "unnamed"}"...`;
    case "update_page":
      return `Updating page #${args.page_id}...`;
    case "delete_page":
      return `Deleting page #${args.page_id}${args.force ? " permanently" : ""}...`;
    case "create_post":
      return `Creating post "${args.title || "unnamed"}"...`;
    case "update_post":
      return `Updating post #${args.post_id}...`;
    case "delete_post":
      return `Deleting post #${args.post_id}${args.force ? " permanently" : ""}...`;
    case "get_orders_with_meta": {
      const parts: string[] = [];
      if (args.after) parts.push(`from ${args.after}`);
      if (args.before) parts.push(`to ${args.before}`);
      return `Fetching orders with full metadata ${parts.join(" ")}...`;
    }
    case "save_preference":
      return `Saving preference: "${args.key}"...`;
    case "check_shipping_status":
      return `Checking shipping status for order #${args.order_id}...`;
    case "audit_geo":
      return `Auditing GEO readiness for ${args.entity_type} #${args.entity_id}...`;
    case "generate_geo_content":
      return `Generating GEO-optimized content for ${args.entity_type} #${args.entity_id}...`;
    case "bulk_geo_audit":
      return `Running bulk GEO audit on ${args.product_ids?.length || "all cached"} products...`;
    default:
      return `Running ${toolName}...`;
  }
}

export function generateReasoningAfter(toolName: string, result: any): string | null {
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
        if (result?.name)
          return `Got: ${result.name}${result.stock_quantity != null ? ` — ${result.stock_quantity} in stock` : ""}`;
        return null;
      }
      case "search_orders": {
        if (Array.isArray(result)) return `Found ${result.length} order${result.length !== 1 ? "s" : ""}.`;
        return null;
      }
      case "get_orders_with_meta": {
        if (Array.isArray(result)) {
          const withMeta = result.filter((o: any) => o.meta_data?.length > 0).length;
          return `Found ${result.length} order${result.length !== 1 ? "s" : ""}. ${withMeta} have metadata.`;
        }
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
      case "get_product_sales_report": {
        if (Array.isArray(result?.products)) {
          const count = result.products.length;
          const top = result.products[0];
          return `${count} products found. Top: ${top?.product_name || "N/A"} (${top?.total_revenue || 0} lei, ${top?.total_quantity || 0} units).`;
        }
        return null;
      }
      case "get_top_customers": {
        if (Array.isArray(result?.customers)) {
          const count = result.customers.length;
          const top = result.customers[0];
          return `${count} customers found. Top: ${top?.customer_name || "N/A"} (${top?.total_revenue || 0} lei, ${top?.order_count || 0} orders).`;
        }
        return null;
      }
      case "update_order":
      case "update_order_status":
        if (result?.id) return `Order #${result.id} updated (status: ${result.status}).`;
        return result?.error ? `Error: ${result.error}` : null;
      case "delete_order":
        return result?.id ? `Order #${result.id} deleted.` : result?.error ? `Error: ${result.error}` : null;
      case "create_product":
        return result?.id
          ? `Product created: #${result.id} "${result.name}".`
          : result?.error
            ? `Error: ${result.error}`
            : null;
      case "update_product":
        return result?.id ? `Product #${result.id} updated.` : result?.error ? `Error: ${result.error}` : null;
      case "delete_product":
        return result?.id ? `Product #${result.id} deleted.` : result?.error ? `Error: ${result.error}` : null;
      case "create_page":
        return result?.id
          ? `Page created: #${result.id} "${result.title?.rendered || result.title}".`
          : result?.error
            ? `Error: ${result.error}`
            : null;
      case "update_page":
        return result?.id ? `Page #${result.id} updated.` : result?.error ? `Error: ${result.error}` : null;
      case "delete_page":
        return result?.id ? `Page #${result.id} deleted.` : result?.error ? `Error: ${result.error}` : null;
      case "create_post":
        return result?.id
          ? `Post created: #${result.id} "${result.title?.rendered || result.title}".`
          : result?.error
            ? `Error: ${result.error}`
            : null;
      case "update_post":
        return result?.id ? `Post #${result.id} updated.` : result?.error ? `Error: ${result.error}` : null;
      case "delete_post":
        return result?.id ? `Post #${result.id} deleted.` : result?.error ? `Error: ${result.error}` : null;
      case "check_shipping_status": {
        if (result?.error) return `Error: ${result.error}`;
        if (result?.status_name) return `Order #${result.order_id} — AWB: ${result.awb} — Status: ${result.status_name}`;
        return null;
      }
      case "audit_geo": {
        if (result?.score != null) return `GEO score: ${result.score}/100 for "${result.entityName || "entity"}".`;
        if (result?.error) return `Error: ${result.error}`;
        return null;
      }
      case "generate_geo_content": {
        if (result?.optimized) return `GEO content generated. Awaiting approval to apply changes.`;
        if (result?.error) return `Error: ${result.error}`;
        return null;
      }
      case "bulk_geo_audit": {
        if (result?.items?.length) return `Audited ${result.items.length} items. Average score: ${result.averageScore}/100.`;
        if (result?.error) return `Error: ${result.error}`;
        return null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function generateSemanticPlan(toolCalls: any[]): SemanticStep[] {
  const steps: SemanticStep[] = [];

  for (const tc of toolCalls) {
    const name = tc.function.name;
    let args: any;
    try {
      args = JSON.parse(tc.function.arguments);
    } catch {
      args = {};
    }

    switch (name) {
      case "search_products":
        steps.push({ title: "Searching product catalog", details: args.search || undefined });
        break;
      case "get_product":
        steps.push({ title: "Fetching product details", details: `Product #${args.product_id}` });
        break;
      case "search_orders": {
        const details = args.search || args.status || undefined;
        steps.push({ title: "Searching orders", details });
        break;
      }
      case "get_sales_report": {
        if (args.date_min && args.date_max) {
          steps.push({ title: "Resolving date range", details: `${args.date_min} → ${args.date_max}` });
        }
        steps.push({ title: "Fetching sales data" });
        steps.push({ title: "Building charts" });
        break;
      }
      case "compare_sales": {
        const labelA = args.period_a_label || "Period A";
        const labelB = args.period_b_label || "Period B";
        steps.push({ title: "Resolving date ranges" });
        steps.push({ title: "Fetching sales data", details: labelA });
        steps.push({ title: "Fetching sales data", details: labelB });
        steps.push({ title: "Comparing periods" });
        break;
      }
      case "get_product_sales": {
        steps.push({ title: "Fetching product sales history", details: `Product #${args.product_id}` });
        steps.push({ title: "Calculating burn rate" });
        break;
      }
      case "get_product_sales_report": {
        const dateDetail = args.date_min && args.date_max ? `${args.date_min} → ${args.date_max}` : undefined;
        steps.push({ title: "Fetching orders for period", details: dateDetail });
        steps.push({ title: "Aggregating by product" });
        steps.push({ title: "Building product report" });
        break;
      }
      case "get_top_customers": {
        const dateDetail = args.date_min && args.date_max ? `${args.date_min} → ${args.date_max}` : undefined;
        steps.push({ title: "Fetching orders for period", details: dateDetail });
        steps.push({ title: "Aggregating by customer" });
        steps.push({ title: "Building customer report" });
        break;
      }
      case "create_order":
      case "update_order_status":
      case "update_order":
      case "delete_order":
        steps.push({ title: "Preparing order action" });
        steps.push({ title: "Awaiting approval" });
        break;
      case "create_product":
      case "update_product":
      case "delete_product":
        steps.push({ title: "Preparing product action" });
        steps.push({ title: "Awaiting approval" });
        break;
      case "create_page":
      case "update_page":
      case "delete_page":
        steps.push({ title: "Preparing page action" });
        steps.push({ title: "Awaiting approval" });
        break;
      case "create_post":
      case "update_post":
      case "delete_post":
        steps.push({ title: "Preparing post action" });
        steps.push({ title: "Awaiting approval" });
        break;
      case "save_preference":
        steps.push({ title: "Saving preference", details: args.key || undefined });
        break;
      case "check_shipping_status":
        steps.push({ title: "Fetching order details", details: `Order #${args.order_id}` });
        steps.push({ title: "Detecting shipping provider" });
        steps.push({ title: "Checking shipment status" });
        break;
      case "audit_geo":
        steps.push({ title: "Fetching entity data", details: `${args.entity_type} #${args.entity_id}` });
        steps.push({ title: "Analyzing GEO readiness" });
        steps.push({ title: "Building report" });
        break;
      case "generate_geo_content":
        steps.push({ title: "Fetching current content", details: `${args.entity_type} #${args.entity_id}` });
        steps.push({ title: "Generating optimized content" });
        steps.push({ title: "Awaiting approval" });
        break;
      case "bulk_geo_audit":
        steps.push({ title: "Fetching products" });
        steps.push({ title: "Analyzing GEO readiness" });
        steps.push({ title: "Building summary table" });
        break;
      default:
        steps.push({ title: TOOL_LABELS[name] || name });
    }
  }

  steps.push({ title: "Writing explanation" });
  return steps;
}
