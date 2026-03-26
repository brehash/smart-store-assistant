

## Make the AI Proactively Chain Tools for Stock/Inventory Analysis

### Problem
When the user asks about stock levels and restock timing, the AI finds the product but then asks the user for sales data instead of fetching it automatically. The AI should chain multiple tools on its own: find the product → fetch recent orders containing it → calculate burn rate → present a visual inventory report.

### What changes

**File: `supabase/functions/chat/index.ts`**

1. **Add a new `get_product_sales` tool** that fetches orders from the last N days and filters them by a specific product ID, returning:
   - Total units sold
   - Daily/weekly breakdown
   - List of orders containing the product
   - Average units per order

   Tool definition:
   ```typescript
   {
     name: "get_product_sales",
     description: "Get sales history for a specific product over a date range. Returns units sold, daily breakdown, and orders containing this product. Use this to analyze stock burn rate and restock timing.",
     parameters: {
       product_id: number,       // required
       days: number,             // default 60
       date_min: string,         // optional override
       date_max: string          // optional override
     }
   }
   ```

2. **Implement `get_product_sales` in `executeTool`**:
   - Fetch orders from the last N days (paginated, up to 100 per page, max ~300)
   - Filter line items matching the product ID (including variation parent IDs)
   - Aggregate: total units, revenue from that product, daily breakdown
   - Return structured data the AI can use for burn-rate math
   - Also return a `richContent` chart showing daily/weekly units sold

3. **Update the system prompt** with explicit multi-tool chaining instructions for inventory/stock intents:
   ```
   STOCK & INVENTORY ANALYSIS:
   - When the user asks about stock levels, restock timing, or inventory for a product:
     1. FIRST call search_products to find the product and get current stock quantity
     2. THEN call get_product_sales with the product_id to get sales velocity over 30-60 days
     3. Calculate burn rate = units_sold / days
     4. Calculate days_of_stock_remaining = current_stock / burn_rate
     5. Present a visual dashboard with: current stock, burn rate, estimated stockout date, restock recommendation
   - NEVER ask the user for sales data you can look up yourself
   - ALWAYS chain these tools automatically in a single flow
   ```

4. **Update `generateSemanticPlan`** to handle the new tool:
   - `get_product_sales` → "Analyzing sales velocity" with details like "Product #123 — last 60 days"

5. **Update prompt to require dashboard output for inventory analysis** — the AI must emit a `dashboard` block with:
   - Stat cards: Current Stock, Units Sold (30d), Burn Rate/day, Days Until Stockout, Recommended Reorder Date
   - Chart: daily/weekly units sold trend line
   - Table: recent orders containing the product
   - List: insights and restock recommendation

### Pipeline example for "show me stock for pasta bourbon and when to reorder"

```text
✓ Understanding request
✓ Searching product catalog
    Query: "pasta bourbon"
✓ Analyzing sales velocity
    Product #245 — last 60 days
✓ Calculating burn rate
● Building inventory report
○ Writing recommendation
```

### Visual output example
The AI response should include a dashboard with:
- **Cards**: Stock: 39 | Sold (30d): 47 | Burn Rate: 1.6/day | Days Left: ~24
- **Chart**: Line chart of daily units sold over 60 days
- **Table**: Recent orders with this product
- **Insights**: "At current rate, stock runs out around April 19. Recommend reordering by April 10 to allow supplier lead time."

### Files to modify
| File | Changes |
|------|---------|
| `supabase/functions/chat/index.ts` | Add `get_product_sales` tool definition, implement in `executeTool`, update system prompt with inventory chaining rules, update `generateSemanticPlan` |

