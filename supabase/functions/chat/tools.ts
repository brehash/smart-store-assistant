export const TOOLS = [
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
      name: "get_product_sales_report",
      description:
        "Get per-product sales breakdown for a date range. Returns each product with its total revenue, units sold, order count, and average price. Use for product dominance, top sellers, best/worst performers, and product-level analysis questions.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string", description: "Start date (YYYY-MM-DD)" },
          date_max: { type: "string", description: "End date (YYYY-MM-DD)" },
          limit: { type: "number", description: "Max products to return (default 50)" },
        },
        required: ["date_min", "date_max"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_orders_with_meta",
      description:
        "Fetch orders for a date range with FULL meta_data included. Use this when the user asks about invoices (facturi), AWBs, tracking numbers, or any custom order attributes. Returns meta_data, line_items, billing, and all order fields needed for classification and analysis.",
      parameters: {
        type: "object",
        properties: {
          after: { type: "string", description: "Start date (ISO 8601, e.g. 2024-01-01T00:00:00)" },
          before: { type: "string", description: "End date (ISO 8601, e.g. 2024-01-31T23:59:59)" },
          status: { type: "string", description: "Order status filter (optional)" },
          per_page: { type: "number", description: "Number of results per page (default 100, max 100)" },
        },
        required: ["after", "before"],
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
  // ── CRUD: Orders ──
  {
    type: "function",
    function: {
      name: "update_order",
      description:
        "Update an existing WooCommerce order. Can change status, billing, shipping, line_items, or add a note.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "number", description: "Order ID to update" },
          status: {
            type: "string",
            description: "New status: pending, processing, on-hold, completed, cancelled, refunded, failed",
          },
          billing: { type: "object", description: "Billing address fields to update" },
          shipping: { type: "object", description: "Shipping address fields to update" },
          line_items: { type: "array", description: "Line items to add/update", items: { type: "object" } },
          note: { type: "string", description: "Order note to add" },
        },
        required: ["order_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_order",
      description: "Delete a WooCommerce order. Use force=true for permanent deletion, otherwise it moves to trash.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "number", description: "Order ID to delete" },
          force: { type: "boolean", description: "True for permanent delete, false for trash (default: false)" },
        },
        required: ["order_id"],
      },
    },
  },
  // ── CRUD: Products ──
  {
    type: "function",
    function: {
      name: "create_product",
      description: "Create a new WooCommerce product.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Product name" },
          type: { type: "string", description: "Product type: simple, grouped, external, variable (default: simple)" },
          regular_price: { type: "string", description: "Regular price" },
          description: { type: "string", description: "Product description (HTML)" },
          short_description: { type: "string", description: "Short description" },
          sku: { type: "string", description: "SKU" },
          stock_quantity: { type: "number", description: "Stock quantity" },
          manage_stock: { type: "boolean", description: "Whether to manage stock (default: false)" },
          categories: {
            type: "array",
            items: { type: "object", properties: { id: { type: "number" } } },
            description: "Category IDs",
          },
          images: {
            type: "array",
            items: { type: "object", properties: { src: { type: "string" } } },
            description: "Image URLs",
          },
          status: { type: "string", description: "Status: draft, pending, publish (default: publish)" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_product",
      description: "Update an existing WooCommerce product.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "number", description: "Product ID to update" },
          name: { type: "string", description: "New product name" },
          regular_price: { type: "string", description: "New regular price" },
          sale_price: { type: "string", description: "Sale price (empty string to remove)" },
          description: { type: "string", description: "New description" },
          short_description: { type: "string", description: "New short description" },
          sku: { type: "string", description: "New SKU" },
          stock_quantity: { type: "number", description: "New stock quantity" },
          manage_stock: { type: "boolean", description: "Whether to manage stock" },
          status: { type: "string", description: "Status: draft, pending, publish, private" },
          categories: {
            type: "array",
            items: { type: "object", properties: { id: { type: "number" } } },
            description: "Category IDs",
          },
          meta_data: {
            type: "array",
            items: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } } },
            description: "Custom meta fields (e.g. SEO plugin fields like _yoast_wpseo_metadesc)",
          },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_product",
      description: "Delete a WooCommerce product. Use force=true for permanent deletion.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "number", description: "Product ID to delete" },
          force: { type: "boolean", description: "True for permanent delete (default: false)" },
        },
        required: ["product_id"],
      },
    },
  },
  // ── CRUD: Pages (WordPress) ──
  {
    type: "function",
    function: {
      name: "create_page",
      description: "Create a new WordPress page.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Page title" },
          content: { type: "string", description: "Page content (HTML)" },
          status: { type: "string", description: "Status: draft, publish, pending, private (default: draft)" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_page",
      description: "Update an existing WordPress page.",
      parameters: {
        type: "object",
        properties: {
          page_id: { type: "number", description: "Page ID to update" },
          title: { type: "string", description: "New title" },
          content: { type: "string", description: "New content (HTML)" },
          status: { type: "string", description: "Status: draft, publish, pending, private" },
          meta: { type: "object", description: "Custom meta fields (key-value pairs for SEO plugins etc.)" },
        },
        required: ["page_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_page",
      description: "Delete a WordPress page. Use force=true for permanent deletion.",
      parameters: {
        type: "object",
        properties: {
          page_id: { type: "number", description: "Page ID to delete" },
          force: { type: "boolean", description: "True for permanent delete (default: false)" },
        },
        required: ["page_id"],
      },
    },
  },
  // ── CRUD: Posts (WordPress) ──
  {
    type: "function",
    function: {
      name: "create_post",
      description: "Create a new WordPress blog post.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Post title" },
          content: { type: "string", description: "Post content (HTML)" },
          status: { type: "string", description: "Status: draft, publish, pending, private (default: draft)" },
          categories: { type: "array", items: { type: "number" }, description: "Category IDs" },
          tags: { type: "array", items: { type: "number" }, description: "Tag IDs" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_post",
      description: "Update an existing WordPress blog post.",
      parameters: {
        type: "object",
        properties: {
          post_id: { type: "number", description: "Post ID to update" },
          title: { type: "string", description: "New title" },
          content: { type: "string", description: "New content (HTML)" },
          status: { type: "string", description: "Status: draft, publish, pending, private" },
          categories: { type: "array", items: { type: "number" }, description: "Category IDs" },
          tags: { type: "array", items: { type: "number" }, description: "Tag IDs" },
          meta: { type: "object", description: "Custom meta fields (key-value pairs for SEO plugins etc.)" },
        },
        required: ["post_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_post",
      description: "Delete a WordPress blog post. Use force=true for permanent deletion.",
      parameters: {
        type: "object",
        properties: {
          post_id: { type: "number", description: "Post ID to delete" },
          force: { type: "boolean", description: "True for permanent delete (default: false)" },
        },
        required: ["post_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_shipping_status",
      description: "Check the shipping/delivery status of an order. Requires the WooCommerce order number (NOT an AWB). The tool automatically detects the shipping provider from order metadata and checks the status.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "number", description: "WooCommerce order ID/number" },
        },
        required: ["order_id"],
      },
    },
  },
  // ── GEO (Generative Engine Optimization) ──
  {
    type: "function",
    function: {
      name: "audit_geo",
      description: "Audit a product, page, or post for GEO (Generative Engine Optimization) readiness. Returns a 0-100 score with category breakdowns and recommendations.",
      parameters: {
        type: "object",
        properties: {
          entity_id: { type: "number", description: "Product ID, page ID, or post ID" },
          entity_type: { type: "string", enum: ["product", "page", "post"], description: "Type of entity to audit" },
        },
        required: ["entity_id", "entity_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_geo_content",
      description: "Generate GEO-optimized content for a product, page, or post. Creates optimized description with FAQ schema, JSON-LD, and meta description. Plugin-aware (Yoast/RankMath).",
      parameters: {
        type: "object",
        properties: {
          entity_id: { type: "number", description: "Product ID, page ID, or post ID" },
          entity_type: { type: "string", enum: ["product", "page", "post"], description: "Type of entity" },
        },
        required: ["entity_id", "entity_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_geo_audit",
      description: "Audit multiple products for GEO readiness. Returns a summary table sorted by priority (lowest score first).",
      parameters: {
        type: "object",
        properties: {
          product_ids: { type: "array", items: { type: "number" }, description: "Product IDs to audit. Pass empty array to use cached products." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_customers",
      description:
        "Get top customers by revenue for a date range. Returns each customer with total revenue, order count, and average order value. Use for 'top clients', 'best customers', 'top clienti', 'cei mai buni clienti' queries.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string", description: "Start date (YYYY-MM-DD)" },
          date_max: { type: "string", description: "End date (YYYY-MM-DD)" },
          limit: { type: "number", description: "Max customers to return (default 5)" },
        },
        required: ["date_min", "date_max"],
      },
    },
  },
];
