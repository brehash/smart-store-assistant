import { formatDate, stripResultForAI } from "./utils.ts";

export async function callWooProxy(supabaseUrl: string, authHeader: string, payload: any) {
  const resp = await fetch(`${supabaseUrl}/functions/v1/woo-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(payload),
  });
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(
      "callWooProxy: failed to parse response as JSON, length:",
      text.length,
      "preview:",
      text.slice(0, 200),
    );
    return { error: "Invalid response from store API", raw_preview: text.slice(0, 300) };
  }
}

export async function executeTool(
  toolName: string,
  args: any,
  supabaseUrl: string,
  authHeader: string,
  userId: string,
  supabase: any,
  defaultOrderStatuses: string[] = [],
  sendSSE?: (data: any) => void,
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
        result: stripResultForAI("search_products", data),
        richContent: { type: "products", data: Array.isArray(data) ? data : [] },
        requestUri: `GET /wp-json/wc/v3/${endpoint}`,
      };
    }
    case "get_product": {
      const endpoint = `products/${args.product_id}`;
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint });
      return {
        result: stripResultForAI("get_product", data),
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
        result: stripResultForAI("search_orders", data),
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
      return { result: stripResultForAI("create_order", data), requestUri: `POST /wp-json/wc/v3/${endpoint}` };
    }
    case "update_order_status": {
      const endpoint = `orders/${args.order_id}`;
      const data = await callWooProxy(supabaseUrl, authHeader, {
        endpoint,
        method: "PUT",
        body: { status: args.status },
      });
      return { result: stripResultForAI("update_order_status", data), requestUri: `PUT /wp-json/wc/v3/${endpoint}` };
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

      // Paginate through all orders (up to 1000)
      let orders: any[] = [];
      for (let page = 1; page <= 10; page++) {
        params.set("page", String(page));
        const endpoint = `orders?${params.toString()}`;
        const pageOrders = await callWooProxy(supabaseUrl, authHeader, { endpoint });
        if (!Array.isArray(pageOrders)) break;
        orders = orders.concat(pageOrders);
        if (pageOrders.length < 100) break;
      }
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
        requestUri: `GET /wp-json/wc/v3/orders (${orders.length} orders fetched)`,
      };
    }
    case "compare_sales": {
      const fetchPeriod = async (start: string, end: string) => {
        const params = new URLSearchParams();
        params.set("per_page", "100");
        if (defaultOrderStatuses.length) params.set("status", defaultOrderStatuses.join(","));
        params.set("after", `${start}T00:00:00`);
        params.set("before", `${end}T23:59:59`);
        let allOrders: any[] = [];
        for (let page = 1; page <= 10; page++) {
          params.set("page", String(page));
          const pageOrders = await callWooProxy(supabaseUrl, authHeader, { endpoint: `orders?${params.toString()}` });
          if (!Array.isArray(pageOrders)) break;
          allOrders = allOrders.concat(pageOrders);
          if (pageOrders.length < 100) break;
        }
        const revenue = allOrders.reduce((s: number, o: any) => s + parseFloat(o.total || "0"), 0);
        return { revenue: Math.round(revenue * 100) / 100, count: allOrders.length };
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

      const cur = new Date(startDate);
      const end = new Date(endDate);
      while (cur <= end) {
        dailyUnits[formatDate(cur)] = 0;
        cur.setDate(cur.getDate() + 1);
      }

      for (const order of allOrders) {
        const lineItems = order.line_items || [];
        for (const li of lineItems) {
          if (
            li.product_id === productId ||
            li.variation_id === productId ||
            (li.parent_name && li.product_id === productId)
          ) {
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
    case "get_product_sales_report": {
      const startDate = args.date_min;
      const endDate = args.date_max;
      const limit = args.limit || 50;

      let allOrders: any[] = [];
      for (let page = 1; page <= 5; page++) {
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

      const INVOICE_META_KEYS = ['invoice','factura','oblio','wc_invoice','billing_invoice','serie','numar','fiscal'];
      const orderHasInvoice = (order: any): boolean => {
        const meta = order.meta_data || [];
        return meta.some((m: any) => {
          const k = (m.key || '').toLowerCase();
          if (k === 'av_facturare') return false;
          return INVOICE_META_KEYS.some(ik => k.includes(ik)) && m.value;
        });
      };

      const productMap: Record<
        number,
        {
          product_id: number;
          product_name: string;
          total_revenue: number;
          total_quantity: number;
          invoiced_qty: number;
          not_invoiced_qty: number;
          order_count: number;
          order_ids: Set<number>;
        }
      > = {};

      for (const order of allOrders) {
        const hasInvoice = orderHasInvoice(order);
        for (const li of order.line_items || []) {
          const pid = li.product_id;
          if (!productMap[pid]) {
            productMap[pid] = {
              product_id: pid,
              product_name: li.name || `Product #${pid}`,
              total_revenue: 0,
              total_quantity: 0,
              invoiced_qty: 0,
              not_invoiced_qty: 0,
              order_count: 0,
              order_ids: new Set(),
            };
          }
          const qty = li.quantity || 0;
          productMap[pid].total_revenue += parseFloat(li.total || "0");
          productMap[pid].total_quantity += qty;
          if (hasInvoice) {
            productMap[pid].invoiced_qty += qty;
          } else {
            productMap[pid].not_invoiced_qty += qty;
          }
          if (!productMap[pid].order_ids.has(order.id)) {
            productMap[pid].order_ids.add(order.id);
            productMap[pid].order_count++;
          }
        }
      }

      // Compute totals from ALL products before slicing
      const allProducts = Object.values(productMap);
      const totalRevenue = allProducts.reduce((s, p) => s + p.total_revenue, 0);
      const totalQuantity = allProducts.reduce((s, p) => s + p.total_quantity, 0);
      const totalInvoicedQty = allProducts.reduce((s, p) => s + p.invoiced_qty, 0);
      const totalNotInvoicedQty = allProducts.reduce((s, p) => s + p.not_invoiced_qty, 0);

      const products = allProducts
        .map((p) => ({
          product_id: p.product_id,
          product_name: p.product_name,
          total_revenue: Math.round(p.total_revenue * 100) / 100,
          total_quantity: p.total_quantity,
          invoiced_qty: p.invoiced_qty,
          not_invoiced_qty: p.not_invoiced_qty,
          order_count: p.order_count,
          average_price: p.total_quantity > 0 ? Math.round((p.total_revenue / p.total_quantity) * 100) / 100 : 0,
        }))
        .sort((a, b) => b.total_quantity - a.total_quantity)
        .slice(0, limit);

      return {
        result: {
          period: `${startDate} → ${endDate}`,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          total_orders: allOrders.length,
          product_count: allProducts.length,
          total_quantity: totalQuantity,
          invoice_summary: { total_invoiced_qty: totalInvoicedQty, total_not_invoiced_qty: totalNotInvoicedQty },
          products,
        },
        richContent: {
          type: "chart",
          data: {
            type: "bar",
            title: `Product Sales (${startDate} → ${endDate})`,
            data: products.slice(0, 15).map((p) => ({ name: p.product_name.slice(0, 25), value: p.total_quantity })),
            dataKey: "value",
            nameKey: "name",
          },
        },
        requestUri: `GET /wp-json/wc/v3/orders (aggregated by product)`,
      };
    }
    case "get_top_customers": {
      const startDate = args.date_min;
      const endDate = args.date_max;
      const limit = args.limit || 5;

      let allOrders: any[] = [];
      for (let page = 1; page <= 5; page++) {
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

      const customerMap: Record<string, {
        customer_name: string;
        email: string;
        total_revenue: number;
        order_count: number;
      }> = {};

      for (const order of allOrders) {
        const billing = order.billing || {};
        const name = `${billing.first_name || ""} ${billing.last_name || ""}`.trim() || "Unknown";
        const email = billing.email || "unknown";
        const key = email.toLowerCase();
        if (!customerMap[key]) {
          customerMap[key] = { customer_name: name, email, total_revenue: 0, order_count: 0 };
        }
        customerMap[key].total_revenue += parseFloat(order.total || "0");
        customerMap[key].order_count++;
      }

      const customers = Object.values(customerMap)
        .map(c => ({
          ...c,
          total_revenue: Math.round(c.total_revenue * 100) / 100,
          average_order_value: c.order_count > 0 ? Math.round((c.total_revenue / c.order_count) * 100) / 100 : 0,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, limit);

      const totalRevenue = customers.reduce((s, c) => s + c.total_revenue, 0);

      return {
        result: {
          period: `${startDate} → ${endDate}`,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          total_orders: allOrders.length,
          customer_count: customers.length,
          customers,
        },
        richContent: {
          type: "chart",
          data: {
            type: "bar",
            title: `Top Customers (${startDate} → ${endDate})`,
            data: customers.map(c => ({ name: c.customer_name.slice(0, 20), value: c.total_revenue })),
            dataKey: "value",
            nameKey: "name",
          },
        },
        requestUri: `GET /wp-json/wc/v3/orders (aggregated by customer)`,
      };
    }
    case "save_preference": {
      await supabase
        .from("user_preferences")
        .upsert(
          { user_id: userId, preference_type: args.preference_type, key: args.key, value: args.value },
          { onConflict: "user_id,preference_type,key" },
        );

      const oaiKey = Deno.env.get("OPENAI_API_KEY");
      if (oaiKey) {
        const prefText = `Preference [${args.preference_type}]: ${args.key} = ${JSON.stringify(args.value)}`;
        (async () => {
          try {
            const embResp = await fetch("https://api.openai.com/v1/embeddings", {
              method: "POST",
              headers: { Authorization: `Bearer ${oaiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: "text-embedding-3-small", input: prefText }),
            });
            if (embResp.ok) {
              const embData = await embResp.json();
              const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
              const { createClient: cc } = await import("https://esm.sh/@supabase/supabase-js@2");
              const svc = cc(supabaseUrl2, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {});
              await svc.from("memory_embeddings").insert({
                user_id: userId,
                content: prefText,
                embedding: JSON.stringify(embData.data[0].embedding),
                memory_type: "preference",
                metadata: { preference_type: args.preference_type, key: args.key },
              });
            }
          } catch (memErr) {
            console.error("Preference embedding storage error (non-fatal):", memErr);
          }
        })();
      }

      return { result: { success: true, message: `Saved preference: "${args.key}"` } };
    }
    case "get_orders_with_meta": {
      const BASE_META_KEYS = [
        'invoice', 'factura', 'facturi', 'oblio', 'awb', 'tracking', 'colet',
        'curier', 'fan_courier', 'sameday', 'cargus', 'dpd', 'gls',
        'wc_invoice', 'billing_invoice', 'serie', 'numar', 'fiscal',
        'link', 'url', 'pdf', 'download',
      ];
      // Load user-defined custom meta keys
      const { data: metaDefs } = await supabase
        .from("user_preferences")
        .select("key")
        .eq("user_id", userId)
        .eq("preference_type", "meta_definition");
      const customMetaKeys = (metaDefs || []).map((p: any) => p.key.toLowerCase());
      const RELEVANT_META_KEYS = [...BASE_META_KEYS, ...customMetaKeys];
      const isRelevantMetaKey = (key: string) => {
        const k = key.toLowerCase();
        return RELEVANT_META_KEYS.some(prefix => k.includes(prefix));
      };
      const perPage = Math.min(args.per_page || 100, 100);
      let allOrders: any[] = [];
      for (let page = 1; page <= 5; page++) {
        const params = new URLSearchParams();
        params.set("per_page", String(perPage));
        params.set("page", String(page));
        if (args.after) params.set("after", args.after);
        if (args.before) params.set("before", args.before);
        if (args.status) params.set("status", args.status);
        else if (defaultOrderStatuses.length) params.set("status", defaultOrderStatuses.join(","));
        const orders = await callWooProxy(supabaseUrl, authHeader, { endpoint: `orders?${params.toString()}` });
        if (!Array.isArray(orders) || orders.length === 0) break;
        allOrders = allOrders.concat(orders);
        if (orders.length < perPage) break;
      }
      const cleaned = allOrders.map((o: any) => {
        const filteredMeta = Array.isArray(o.meta_data)
          ? o.meta_data.filter((m: any) => isRelevantMetaKey(m.key || ""))
          : [];
        return {
          id: o.id,
          status: o.status,
          total: o.total,
          currency: o.currency,
          date_created: o.date_created,
          billing: o.billing ? { first_name: o.billing.first_name, last_name: o.billing.last_name } : undefined,
          meta_data: filteredMeta,
        };
      });
      return {
        result: cleaned,
        requestUri: `GET /wp-json/wc/v3/orders (with meta_data, ${allOrders.length} orders)`,
      };
    }
    // ── CRUD: Orders ──
    case "update_order": {
      const endpoint = `orders/${args.order_id}`;
      const body: any = {};
      if (args.status) body.status = args.status;
      if (args.billing) body.billing = args.billing;
      if (args.shipping) body.shipping = args.shipping;
      if (args.line_items) body.line_items = args.line_items;
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint, method: "PUT", body });
      if (args.note) {
        await callWooProxy(supabaseUrl, authHeader, {
          endpoint: `orders/${args.order_id}/notes`,
          method: "POST",
          body: { note: args.note },
        });
      }
      return { result: stripResultForAI("update_order", data), requestUri: `PUT /wp-json/wc/v3/${endpoint}` };
    }
    case "delete_order": {
      const endpoint = `orders/${args.order_id}`;
      const force = args.force ? "?force=true" : "";
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint: `${endpoint}${force}`, method: "DELETE" });
      return { result: stripResultForAI("delete_order", data), requestUri: `DELETE /wp-json/wc/v3/${endpoint}` };
    }
    // ── CRUD: Products ──
    case "create_product": {
      const body: any = { name: args.name };
      if (args.type) body.type = args.type;
      if (args.regular_price) body.regular_price = args.regular_price;
      if (args.description) body.description = args.description;
      if (args.short_description) body.short_description = args.short_description;
      if (args.sku) body.sku = args.sku;
      if (args.stock_quantity != null) body.stock_quantity = args.stock_quantity;
      if (args.manage_stock != null) body.manage_stock = args.manage_stock;
      if (args.categories) body.categories = args.categories;
      if (args.images) body.images = args.images;
      if (args.status) body.status = args.status;
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint: "products", method: "POST", body });
      return {
        result: stripResultForAI("create_product", data),
        richContent: data?.id ? { type: "products", data: [data] } : undefined,
        requestUri: `POST /wp-json/wc/v3/products`,
      };
    }
    case "update_product": {
      const endpoint = `products/${args.product_id}`;
      const { product_id, ...rest } = args;
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint, method: "PUT", body: rest });
      return {
        result: stripResultForAI("update_product", data),
        richContent: data?.id ? { type: "products", data: [data] } : undefined,
        requestUri: `PUT /wp-json/wc/v3/${endpoint}`,
      };
    }
    case "delete_product": {
      const endpoint = `products/${args.product_id}`;
      const force = args.force ? "?force=true" : "";
      const data = await callWooProxy(supabaseUrl, authHeader, { endpoint: `${endpoint}${force}`, method: "DELETE" });
      return { result: stripResultForAI("delete_product", data), requestUri: `DELETE /wp-json/wc/v3/${endpoint}` };
    }
    // ── CRUD: Pages (WordPress) ──
    case "create_page": {
      const body: any = { title: args.title, status: args.status || "draft" };
      if (args.content) body.content = args.content;
      const data = await callWooProxy(supabaseUrl, authHeader, {
        endpoint: "pages",
        method: "POST",
        body,
        apiPrefix: "wp/v2",
      });
      return { result: stripResultForAI("create_page", data), requestUri: `POST /wp-json/wp/v2/pages` };
    }
    case "update_page": {
      const { page_id, ...rest } = args;
      const data = await callWooProxy(supabaseUrl, authHeader, {
        endpoint: `pages/${page_id}`,
        method: "PUT",
        body: rest,
        apiPrefix: "wp/v2",
      });
      return { result: stripResultForAI("update_page", data), requestUri: `PUT /wp-json/wp/v2/pages/${page_id}` };
    }
    case "delete_page": {
      const force = args.force ? "?force=true" : "";
      const data = await callWooProxy(supabaseUrl, authHeader, {
        endpoint: `pages/${args.page_id}${force}`,
        method: "DELETE",
        apiPrefix: "wp/v2",
      });
      return { result: stripResultForAI("delete_page", data), requestUri: `DELETE /wp-json/wp/v2/pages/${args.page_id}` };
    }
    // ── CRUD: Posts (WordPress) ──
    case "create_post": {
      const body: any = { title: args.title, status: args.status || "draft" };
      if (args.content) body.content = args.content;
      if (args.categories) body.categories = args.categories;
      if (args.tags) body.tags = args.tags;
      const data = await callWooProxy(supabaseUrl, authHeader, {
        endpoint: "posts",
        method: "POST",
        body,
        apiPrefix: "wp/v2",
      });
      return { result: stripResultForAI("create_post", data), requestUri: `POST /wp-json/wp/v2/posts` };
    }
    case "update_post": {
      const { post_id, ...rest } = args;
      const data = await callWooProxy(supabaseUrl, authHeader, {
        endpoint: `posts/${post_id}`,
        method: "PUT",
        body: rest,
        apiPrefix: "wp/v2",
      });
      return { result: stripResultForAI("update_post", data), requestUri: `PUT /wp-json/wp/v2/posts/${post_id}` };
    }
    case "delete_post": {
      const force = args.force ? "?force=true" : "";
      const data = await callWooProxy(supabaseUrl, authHeader, {
        endpoint: `posts/${args.post_id}${force}`,
        method: "DELETE",
        apiPrefix: "wp/v2",
      });
      return { result: stripResultForAI("delete_post", data), requestUri: `DELETE /wp-json/wp/v2/posts/${args.post_id}` };
    }
    case "check_shipping_status": {
      const orderData = await callWooProxy(supabaseUrl, authHeader, { endpoint: `orders/${args.order_id}` });
      if (orderData?.error || !orderData?.id) {
        return { result: { error: `Could not fetch order #${args.order_id}: ${orderData?.error || "Not found"}` } };
      }

      const metaData = orderData.meta_data || [];
      
      const SHIPPING_PROVIDERS: { metaKey: string; provider: string; integrationKey: string }[] = [
        { metaKey: "_coleteonline_courier_order", provider: "Colete Online", integrationKey: "colete_online" },
      ];

      let detectedProvider: typeof SHIPPING_PROVIDERS[0] | null = null;
      let shippingMeta: any = null;

      for (const provider of SHIPPING_PROVIDERS) {
        const meta = metaData.find((m: any) => m.key === provider.metaKey);
        if (meta) {
          detectedProvider = provider;
          shippingMeta = meta;
          break;
        }
      }

      if (!detectedProvider || !shippingMeta) {
        return { result: { error: `No shipping tracking data found on order #${args.order_id}. This order does not have AWB/shipping metadata from any supported provider.` } };
      }

      const { data: integrationData } = await supabase
        .from("woo_integrations")
        .select("config, is_enabled")
        .eq("user_id", userId)
        .eq("integration_key", detectedProvider.integrationKey)
        .maybeSingle();

      if (!integrationData || !integrationData.is_enabled) {
        return { result: { error: `This order uses ${detectedProvider.provider} shipping but you haven't connected the ${detectedProvider.provider} integration yet. Go to Settings > Integrations to enable it.` } };
      }

      async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const resp = await fetch(url, options);
          if (resp.status === 429) {
            const retryAfter = parseInt(resp.headers.get("Retry-After") || "5", 10);
            const waitSec = Math.min(retryAfter, 30);
            console.log(`429 from ${url}, retrying in ${waitSec}s (attempt ${attempt + 1}/${maxRetries})`);
            if (sendSSE) {
              sendSSE({ type: "reasoning", text: `⏳ Rate limited by Colete Online. Retrying in ${waitSec} seconds...` });
            }
            await new Promise(r => setTimeout(r, waitSec * 1000));
            if (sendSSE) {
              sendSSE({ type: "reasoning", text: `🔄 Retrying request now (attempt ${attempt + 2}/${maxRetries + 1})...` });
            }
            continue;
          }
          return resp;
        }
        if (sendSSE) {
          sendSSE({ type: "reasoning", text: `⚠️ Final attempt after rate limiting...` });
        }
        return fetch(url, options);
      }

      if (detectedProvider.integrationKey === "colete_online") {
        let metaValue = shippingMeta.value;
        if (typeof metaValue === "string") {
          try { metaValue = JSON.parse(metaValue); } catch { /* keep as-is */ }
        }

        const uniqueId = metaValue?.result?.uniqueId;
        const awb = metaValue?.result?.awb;
        const courierName = metaValue?.result?.service?.service?.courierName;
        const serviceName = metaValue?.result?.service?.service?.name;

        if (!uniqueId) {
          return { result: { error: `${detectedProvider.provider} metadata found on order #${args.order_id} but missing uniqueId.` } };
        }

        const clientId = (integrationData.config as any).client_id;
        const clientSecret = (integrationData.config as any).client_secret;
        if (!clientId || !clientSecret) {
          return { result: { error: `${detectedProvider.provider} Client ID or Client Secret is missing. Go to Settings > Integrations to configure.` } };
        }

        const basicAuth = btoa(`${clientId}:${clientSecret}`);
        const tokenResp = await fetchWithRetry("https://auth.colete-online.ro/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${basicAuth}`,
          },
          body: "grant_type=client_credentials",
        });

        if (tokenResp.status === 429) {
          const retryAfter = tokenResp.headers.get("Retry-After") || "unknown";
          return { result: { error: `Rate limited by Colete Online. Please try again in ${retryAfter} seconds.` } };
        }
        if (!tokenResp.ok) {
          return { result: { error: `${detectedProvider.provider} authentication failed (${tokenResp.status}). Check your credentials in Settings > Integrations.` } };
        }

        const tokenData = await tokenResp.json();
        const accessToken = tokenData.access_token;

        const statusResp = await fetchWithRetry(`https://api.colete-online.ro/v1/order/status/${uniqueId}`, {
          headers: { "Authorization": `Bearer ${accessToken}` },
        });

        if (statusResp.status === 429) {
          const retryAfter = statusResp.headers.get("Retry-After") || "unknown";
          return { result: { error: `Rate limited by Colete Online. Please try again in ${retryAfter} seconds.` } };
        }
        if (!statusResp.ok) {
          return { result: { error: `${detectedProvider.provider} status API error (${statusResp.status}) for uniqueId ${uniqueId}.` } };
        }

        const statusData = await statusResp.json();
        const history = statusData.history || [];
        const latestEvent = history.length > 0 ? history[history.length - 1] : null;

        const awbFinal = awb || statusData?.summary?.awb || "N/A";
        const courierFinal = courierName || "Unknown";
        const serviceFinal = serviceName || "Unknown";
        const currentStatus = latestEvent ? {
          code: latestEvent.code,
          name: latestEvent.statusTextParts?.ro?.name || "Unknown",
          reason: latestEvent.statusTextParts?.ro?.reason || "",
          date: latestEvent.dateTime,
          comment: latestEvent.comment?.ro || "",
        } : null;
        const isDelivered = latestEvent?.code === 20800 || latestEvent?.code === 30500;
        const mappedHistory = history.map((h: any) => ({
          code: h.code,
          name: h.statusTextParts?.ro?.name || "",
          reason: h.statusTextParts?.ro?.reason || "",
          date: h.dateTime,
          comment: h.comment?.ro || "",
        }));

        const shippingData = {
          order_id: args.order_id,
          provider: detectedProvider.provider,
          awb: awbFinal,
          uniqueId,
          courier: courierFinal,
          service: serviceFinal,
          current_status: currentStatus,
          status_name: currentStatus?.name || "Unknown",
          is_delivered: isDelivered,
          order_status: orderData.status,
          history: mappedHistory,
        };

        return {
          result: shippingData,
          richContent: { type: "shipping", data: shippingData },
          requestUri: `GET /v1/order/status/${uniqueId}`,
        };
      }

      return { result: { error: `Provider ${detectedProvider.provider} detected but handler not implemented yet.` } };
    }
    // ── GEO Tools ──
    case "audit_geo": {
      const { entity_id, entity_type } = args;
      let entityData: any;
      if (entity_type === "product") {
        entityData = await callWooProxy(supabaseUrl, authHeader, { endpoint: `products/${entity_id}` });
      } else if (entity_type === "page") {
        entityData = await callWooProxy(supabaseUrl, authHeader, { endpoint: `pages/${entity_id}`, apiPrefix: "wp/v2" });
      } else {
        entityData = await callWooProxy(supabaseUrl, authHeader, { endpoint: `posts/${entity_id}`, apiPrefix: "wp/v2" });
      }

      if (!entityData || entityData.error) {
        return { result: { error: `Could not fetch ${entity_type} #${entity_id}: ${entityData?.error || "Not found"}` } };
      }

      const entityName = entityData.name || entityData.title?.rendered || entityData.title || "Unknown";
      const description = (entityData.description || entityData.content?.rendered || "").replace(/<[^>]*>/g, "");
      const descLen = description.length;
      const hasHeadings = /<h[2-6]/i.test(entityData.description || entityData.content?.rendered || "");
      const hasFaqSchema = /FAQPage/i.test(entityData.description || entityData.content?.rendered || "");
      const hasJsonLd = /application\/ld\+json/i.test(entityData.description || entityData.content?.rendered || "");
      const hasDetailsSummary = /<details/i.test(entityData.description || entityData.content?.rendered || "");
      const hasMeta = (entityData.meta_data || []).some((m: any) =>
        ["_yoast_wpseo_metadesc", "rank_math_description"].includes(m.key) && m.value
      );

      const categories = {
        content_depth: {
          score: Math.min(25, Math.round((descLen / 2000) * 25)),
          max: 25,
          details: `${descLen} chars (target: 1500+)`,
        },
        structure: {
          score: (hasHeadings ? 10 : 0) + (descLen > 300 ? 5 : 0),
          max: 15,
          details: `Headings: ${hasHeadings ? "✓" : "✗"}, Min length: ${descLen > 300 ? "✓" : "✗"}`,
        },
        faq_schema: {
          score: (hasFaqSchema ? 10 : 0) + (hasDetailsSummary ? 10 : 0),
          max: 20,
          details: `FAQ schema: ${hasFaqSchema ? "✓" : "✗"}, Collapsible FAQ: ${hasDetailsSummary ? "✓" : "✗"}`,
        },
        structured_data: {
          score: hasJsonLd ? 20 : 0,
          max: 20,
          details: `JSON-LD: ${hasJsonLd ? "✓" : "✗"}`,
        },
        meta_seo: {
          score: hasMeta ? 20 : 0,
          max: 20,
          details: `Meta description: ${hasMeta ? "✓" : "✗"}`,
        },
      };

      const totalScore = Object.values(categories).reduce((s, c) => s + c.score, 0);

      const recommendations: string[] = [];
      if (descLen < 800) recommendations.push("Expand description to 800+ characters with detailed, citation-worthy content");
      if (!hasHeadings) recommendations.push("Add H2/H3 headings for better content structure");
      if (!hasFaqSchema) recommendations.push("Add FAQPage schema markup for rich results");
      if (!hasJsonLd) recommendations.push("Add JSON-LD structured data for AI search visibility");
      if (!hasDetailsSummary) recommendations.push("Add collapsible FAQ section using <details>/<summary> tags");
      if (!hasMeta) recommendations.push("Add meta description via Yoast/RankMath or similar plugin");

      const categoriesArray = Object.entries(categories).map(([key, val]) => ({
        name: key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        score: val.score,
        maxScore: val.max,
        details: val.details,
      }));

      const recsArray = recommendations.map((text, i) => ({
        text,
        priority: i < 2 ? "high" : i < 4 ? "medium" : "low",
        category: "general",
      }));

      const reportData = {
        mode: "single" as const,
        entityName,
        entityType: entity_type,
        entityId: entity_id,
        score: totalScore,
        categories: categoriesArray,
        recommendations: recsArray,
      };

      return {
        result: { score: totalScore, entityName, entity_type, entity_id, categories, recommendations },
        richContent: { type: "geo_report", data: reportData },
        requestUri: `GET /wp-json/${entity_type === "product" ? "wc/v3" : "wp/v2"}/${entity_type}s/${entity_id}`,
      };
    }
    case "generate_geo_content": {
      const { entity_id, entity_type } = args;
      let entityData: any;
      if (entity_type === "product") {
        entityData = await callWooProxy(supabaseUrl, authHeader, { endpoint: `products/${entity_id}` });
      } else if (entity_type === "page") {
        entityData = await callWooProxy(supabaseUrl, authHeader, { endpoint: `pages/${entity_id}`, apiPrefix: "wp/v2" });
      } else {
        entityData = await callWooProxy(supabaseUrl, authHeader, { endpoint: `posts/${entity_id}`, apiPrefix: "wp/v2" });
      }

      if (!entityData || entityData.error) {
        return { result: { error: `Could not fetch ${entity_type} #${entity_id}: ${entityData?.error || "Not found"}` } };
      }

      const entityName = entityData.name || entityData.title?.rendered || entityData.title || "Unknown";
      const currentDesc = entityData.description || entityData.content?.rendered || "";

      const { data: connData2 } = await supabase
        .from("woo_connections")
        .select("active_plugins")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      const activePlugins: string[] = (connData2 as any)?.active_plugins || [];
      const hasYoast = activePlugins.some(p => p.includes("wordpress-seo"));
      const hasRankMath = activePlugins.some(p => p.includes("seo-by-rank-math"));

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const userOpenAIKey = Deno.env.get("OPENAI_API_KEY") || null;
      const useOpenAI = !!userOpenAIKey;
      const geoAiUrl = useOpenAI
        ? "https://api.openai.com/v1/chat/completions"
        : "https://ai.gateway.lovable.dev/v1/chat/completions";
      const geoAiAuth = useOpenAI ? `Bearer ${userOpenAIKey}` : `Bearer ${LOVABLE_API_KEY}`;
      const geoModel = useOpenAI ? "gpt-5.4-mini" : "google/gemini-3-flash-preview";

      const geoPrompt = `You are a GEO (Generative Engine Optimization) expert. Optimize this ${entity_type} for AI search engines.

Entity: "${entityName}" (${entity_type} #${entity_id})
Current description:
${currentDesc.slice(0, 3000)}

SEO Plugin: ${hasYoast ? "Yoast SEO" : hasRankMath ? "RankMath" : "None detected"}

Generate an optimized version with:
1. "optimized_description": Full HTML description that includes:
   - Citation-worthy, detailed content (800+ chars)
   - A visible FAQ section using <details> and <summary> tags (3-5 relevant FAQs)
   - An inline <script type="application/ld+json"> block with FAQPage schema at the end
2. "meta_description": A 150-160 char meta description optimized for AI search
3. "short_description": An optimized short description (50-100 chars)
4. "meta_fields": Array of {key, value} for SEO plugin meta fields:
${hasYoast ? '   - {key: "_yoast_wpseo_metadesc", value: "..."}\n   - {key: "_yoast_wpseo_title", value: "..."}' : hasRankMath ? '   - {key: "rank_math_description", value: "..."}\n   - {key: "rank_math_title", value: "..."}' : '   - Empty array (no SEO plugin detected, JSON-LD is already in description)'}

Maintain the original language of the content. If the content is in Romanian, write in Romanian.`;

      const geoResp = await fetch(geoAiUrl, {
        method: "POST",
        headers: { Authorization: geoAiAuth, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: geoModel,
          messages: [{ role: "user", content: geoPrompt }],
          tools: [{
            type: "function",
            function: {
              name: "generate_geo_output",
              description: "Return the GEO-optimized content",
              parameters: {
                type: "object",
                properties: {
                  optimized_description: { type: "string", description: "HTML description with FAQs and JSON-LD" },
                  meta_description: { type: "string", description: "150-160 char meta description" },
                  short_description: { type: "string", description: "Optimized short description" },
                  meta_fields: {
                    type: "array",
                    items: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } } },
                  },
                },
                required: ["optimized_description", "meta_description", "short_description", "meta_fields"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "generate_geo_output" } },
          stream: false,
        }),
      });

      if (!geoResp.ok) {
        return { result: { error: `AI generation failed (${geoResp.status})` } };
      }

      const geoData = await geoResp.json();
      const toolCall = geoData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        return { result: { error: "AI did not return structured output" } };
      }

      let geoOutput: any;
      try {
        geoOutput = JSON.parse(toolCall.function.arguments);
      } catch {
        return { result: { error: "Failed to parse AI output" } };
      }

      const hasJsonLdGenerated = geoOutput.optimized_description?.includes("application/ld+json");
      const hasFaqGenerated = geoOutput.optimized_description?.includes("<details");
      const hasMetaFields = geoOutput.meta_fields?.length > 0;

      return {
        result: {
          optimized: true,
          entityName,
          entity_type,
          entity_id,
          description: geoOutput.optimized_description,
          short_description: geoOutput.short_description,
          meta_description: geoOutput.meta_description,
          meta_fields: geoOutput.meta_fields,
          seo_plugin: hasYoast ? "yoast" : hasRankMath ? "rankmath" : "none",
          _instruction: `IMPORTANT: Now call update_${entity_type} with id ${entity_id} to apply these changes. Pass description, short_description, and meta_data/meta fields. Briefly summarize the generated content before calling the update tool.`,
        },
        richContent: {
          type: "geo_report",
          data: {
            mode: "single" as const,
            entityName,
            entityType: entity_type,
            entityId: entity_id,
            score: -1,
            generationSummary: {
              jsonLd: hasJsonLdGenerated,
              faqSchema: hasFaqGenerated,
              metaDescription: !!geoOutput.meta_description,
              seoPlugin: hasYoast ? "Yoast SEO" : hasRankMath ? "RankMath" : "None",
              metaFieldsCount: geoOutput.meta_fields?.length || 0,
            },
            categories: [
              { name: "JSON-LD Schema", score: hasJsonLdGenerated ? 20 : 0, maxScore: 20, details: hasJsonLdGenerated ? "✓ Generated" : "✗ Missing" },
              { name: "FAQ Section", score: hasFaqGenerated ? 20 : 0, maxScore: 20, details: hasFaqGenerated ? "✓ Generated" : "✗ Missing" },
              { name: "Meta Description", score: geoOutput.meta_description ? 20 : 0, maxScore: 20, details: geoOutput.meta_description ? "✓ Generated" : "✗ Missing" },
              { name: "SEO Plugin Meta", score: hasMetaFields ? 20 : 0, maxScore: 20, details: hasMetaFields ? `✓ ${geoOutput.meta_fields.length} fields` : "✗ No plugin" },
            ],
            recommendations: [],
          },
        },
        requestUri: `GET /wp-json/${entity_type === "product" ? "wc/v3" : "wp/v2"}/${entity_type}s/${entity_id}`,
      };
    }
    case "bulk_geo_audit": {
      let productIds: number[] = args.product_ids || [];

      if (!productIds.length) {
        const { data: cachedProducts } = await supabase
          .from("woo_cache")
          .select("data")
          .eq("user_id", userId)
          .eq("cache_key", "products")
          .maybeSingle();
        if (cachedProducts?.data && Array.isArray(cachedProducts.data)) {
          productIds = (cachedProducts.data as any[]).slice(0, 20).map((p: any) => p.id);
        }
      }

      if (!productIds.length) {
        return { result: { error: "No products to audit. Please refresh your product cache first or provide product IDs." } };
      }

      const items: any[] = [];
      for (const pid of productIds.slice(0, 20)) {
        try {
          const product = await callWooProxy(supabaseUrl, authHeader, { endpoint: `products/${pid}` });
          if (!product?.id) continue;

          const desc = (product.description || "").replace(/<[^>]*>/g, "");
          const descLen = desc.length;
          const hasHeadings = /<h[2-6]/i.test(product.description || "");
          const hasFaq = /FAQPage|application\/ld\+json/i.test(product.description || "");
          const hasMeta = (product.meta_data || []).some((m: any) =>
            ["_yoast_wpseo_metadesc", "rank_math_description"].includes(m.key) && m.value
          );

          const score = Math.min(100,
            Math.min(20, Math.round((descLen / 1500) * 20)) +
            (hasHeadings ? 15 : 0) + (descLen > 300 ? 5 : 0) +
            (hasFaq ? 20 : 0) +
            (hasMeta ? 20 : 0) +
            (/application\/ld\+json/i.test(product.description || "") ? 10 : 0) +
            (/<details/i.test(product.description || "") ? 10 : 0)
          );

          let topIssue = "Looks good";
          if (descLen < 300) topIssue = "Description too short";
          else if (!hasFaq) topIssue = "No FAQ schema";
          else if (!hasMeta) topIssue = "No meta description";
          else if (!hasHeadings) topIssue = "No heading structure";

          items.push({ id: pid, name: product.name, score, topIssue, type: "product" });
        } catch { /* skip failed products */ }
      }

      const averageScore = items.length ? Math.round(items.reduce((s, i) => s + i.score, 0) / items.length) : 0;

      const reportData = { mode: "bulk", items, averageScore };
      return {
        result: { items, averageScore },
        richContent: { type: "geo_report", data: reportData },
        requestUri: `GET /wp-json/wc/v3/products (x${items.length})`,
      };
    }
    default:
      return { result: { error: `Unknown tool: ${toolName}` } };
  }
}
