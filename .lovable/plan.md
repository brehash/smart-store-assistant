

## Add CRUD Tools for Orders, Products, Pages & Posts (with Approval)

### Overview
Add write tools (create/update/delete) for orders, products, pages, and posts. All write operations require user approval before execution via the existing ApprovalCard UI.

### Key Challenge: WooCommerce vs WordPress API
The current `woo-proxy` hardcodes the path to `/wp-json/wc/v3/`. Pages and posts use the WordPress REST API at `/wp-json/wp/v2/`. The proxy needs a small update to support an optional `apiPrefix` parameter.

---

### Changes

#### 1. Update `supabase/functions/woo-proxy/index.ts`
- Add optional `apiPrefix` parameter (default: `wc/v3`)
- Also support `DELETE` method in fetch options
- URL becomes: `${baseUrl}/wp-json/${apiPrefix}/${endpoint}...`

#### 2. Update `supabase/functions/chat/index.ts`

**New tool definitions (added to `TOOLS` array):**

| Tool | WooCommerce Endpoint | Method | Key Parameters |
|------|---------------------|--------|----------------|
| `update_order` | `orders/{id}` | PUT | `order_id`, `status`, `billing`, `shipping`, `line_items`, `note` |
| `delete_order` | `orders/{id}` | DELETE | `order_id`, `force` (permanent delete) |
| `create_product` | `products` | POST | `name`, `type`, `regular_price`, `description`, `sku`, `stock_quantity`, `categories`, `images` |
| `update_product` | `products/{id}` | PUT | `product_id`, `name`, `regular_price`, `sale_price`, `stock_quantity`, `status`, `description` |
| `delete_product` | `products/{id}` | DELETE | `product_id`, `force` |
| `create_page` | `wp/v2/pages` | POST | `title`, `content`, `status` |
| `update_page` | `wp/v2/pages/{id}` | PUT | `page_id`, `title`, `content`, `status` |
| `delete_page` | `wp/v2/pages/{id}` | DELETE | `page_id`, `force` |
| `create_post` | `wp/v2/posts` | POST | `title`, `content`, `status`, `categories` |
| `update_post` | `wp/v2/posts/{id}` | PUT | `post_id`, `title`, `content`, `status` |
| `delete_post` | `wp/v2/posts/{id}` | DELETE | `post_id`, `force` |

**Update `WRITE_TOOLS` set** to include all new write tools.

**Update `executeTool`** with cases for each new tool. For pages/posts, pass `apiPrefix: "wp/v2"` to `callWooProxy`.

**Update `callWooProxy`** to accept and forward an optional `apiPrefix` parameter.

**Update `TOOL_LABELS`** with human-readable labels for each new tool.

**Update `generateSemanticPlan`** with semantic steps for each new tool (e.g., "Preparing product update" → "Awaiting approval").

**Update `generateReasoningBefore/After`** with contextual messages for each tool.

**Update system prompt** to instruct the AI:
- For order modifications: search the order first, then call update/delete
- For product creation: confirm details with the user via the approval card
- For pages/posts: use WordPress endpoints

#### 3. No frontend changes needed
The existing `ApprovalCard` component and approval flow in `Index.tsx` already handle any tool in `WRITE_TOOLS` generically. New tools will automatically get the Approve/Skip/Edit UI.

---

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/woo-proxy/index.ts` | Add `apiPrefix` param, support DELETE method |
| `supabase/functions/chat/index.ts` | Add 11 new tool definitions, execution logic, labels, semantic plans, reasoning, update WRITE_TOOLS and system prompt |

