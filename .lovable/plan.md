

## Fix: AI Must Autonomously Gather Data Instead of Asking

### Problem
The AI tells the user "I need product-level data, let me know if I should fetch it" instead of just calling the tools automatically. This happens despite the system prompt saying "NEVER ask the user for information you can look up with tools." The issue is twofold:
1. The instruction isn't strong enough — the AI still hesitates on multi-turn follow-ups
2. On multi-turn conversations, after history trimming to 20 messages, the AI loses context about what tools are available and defaults to asking

### Fix: Strengthen System Prompt (`supabase/functions/chat/index.ts`)

Add a much more aggressive autonomy instruction to the system prompt:

**Add after the existing CRITICAL TOOL USAGE RULES (around line 882):**

```
AUTONOMOUS DATA GATHERING (ABSOLUTE RULE):
- You MUST NEVER tell the user you need more data or ask permission to fetch data. 
  If you need product-level data, sales breakdowns, order details, or ANY information 
  available through your tools — CALL THE TOOLS IMMEDIATELY without asking.
- If the user asks a question and you realize you don't have enough data to answer, 
  your ONLY correct response is to call the appropriate tools. NEVER say "let me know 
  if you want me to fetch this" or "I need to pull this data first, shall I proceed?"
- When the user asks about predictions, estimates, or forecasts: ALWAYS call 
  get_sales_report with date ranges to get product-level data, then analyze it. 
  Do not explain what you would need — just get it.
- For product dominance / top products analysis: call get_sales_report for the 
  relevant period. The tool returns top_products data. Use it directly.
- WRONG: "I need product-level data. Should I fetch it?"
- RIGHT: *calls get_sales_report tool with current month dates*
```

**Also strengthen the existing rule 6 (line 882):**
Change from:
```
6. NEVER ask the user for information you can look up with tools.
```
To:
```
6. NEVER ask the user for information you can look up with tools. NEVER ask permission 
   to run a tool. NEVER explain what data you need before fetching it. Just call the tool. 
   This applies especially in follow-up messages where you realize you need more data.
```

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/chat/index.ts` | Strengthen system prompt with autonomous data gathering rules |

