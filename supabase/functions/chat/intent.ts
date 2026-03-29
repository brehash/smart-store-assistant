import { TOOLS } from "./tools.ts";

const SHIPPING_INTENT_RE = /(shipping|tracking|delivery|livrare|colet|awb|status.*comand|comand.*status|unde.*comand|unde.*colet|stare.*comand|stare.*colet)/i;
const GEO_INTENT_RE = /(geo|seo.*ai|optimiz.*ai|optimize.*search|ai.*search|generative.*engine|structured.*data|faq.*schema|json-ld|geo.*audit|audit.*geo|optimizeaz[aă].*seo|audit.*seo)/i;

export const INTENT_GROUPS: Record<string, { regex: RegExp; tools: string[] }> = {
  SHIPPING: {
    regex: SHIPPING_INTENT_RE,
    tools: ["check_shipping_status", "update_order_status", "search_orders"],
  },
  ANALYTICS: {
    regex: /(v[âa]nz[aă]ri|sales|revenue|report|raport|cifr[aă]|analytics|top.*produs|top.*product|top.*client|top.*customer|best.*customer|cei mai buni|performan[tț][aă]|compare|compar[aă])/i,
    tools: ["get_sales_report", "compare_sales", "get_product_sales", "get_product_sales_report", "get_top_customers"],
  },
  PRODUCT_MGMT: {
    regex: /(produs|product|stoc|stock|sku|categor|cre[ea]z[aă].*produs|adaug[aă].*produs|[șs]terge.*produs|modific[aă].*produs|actualizeaz[aă].*produs|create.*product|add.*product|delete.*product|update.*product)/i,
    tools: ["search_products", "get_product", "create_product", "update_product", "delete_product"],
  },
  ORDER_MGMT: {
    regex: /(comand[aă]|order|factur[aă]|invoice|plas[ea]z[aă].*comand|cre[ea]z[aă].*comand|[șs]terge.*comand|modific[aă].*comand|create.*order|place.*order|delete.*order|update.*order|meta_data)/i,
    tools: ["search_orders", "create_order", "update_order", "delete_order", "get_orders_with_meta"],
  },
  CONTENT: {
    regex: /(pagin[aă]|page|post|blog|articol|con[țt]inut|content|cre[ea]z[aă].*pagin|cre[ea]z[aă].*post|[șs]terge.*pagin|[șs]terge.*post|modific[aă].*pagin|modific[aă].*post|create.*page|create.*post|delete.*page|delete.*post|update.*page|update.*post)/i,
    tools: ["create_page", "update_page", "delete_page", "create_post", "update_post", "delete_post"],
  },
  GEO: {
    regex: GEO_INTENT_RE,
    tools: ["audit_geo", "generate_geo_content", "bulk_geo_audit"],
  },
};

export function selectToolsForIntent(lastUserMsg: string, hasToolResult: boolean, allTools: typeof TOOLS): typeof TOOLS {
  const matched = new Set<string>(["save_preference"]);
  let anyMatch = false;

  for (const group of Object.values(INTENT_GROUPS)) {
    if (group.regex.test(lastUserMsg)) {
      anyMatch = true;
      for (const t of group.tools) matched.add(t);
    }
  }

  if (!anyMatch) return allTools;

  return allTools.filter(t => matched.has(t.function.name));
}

export function isShippingIntent(lastUserMsg: string): boolean {
  return SHIPPING_INTENT_RE.test(lastUserMsg);
}
