

## Fix: Order Intent Detection + Language Context

### Root Cause
The intent detection regex on line 1726 looks correct for "creaza o comanda", but there's a subtle issue: JavaScript's `\b` word boundary doesn't work reliably with Unicode characters like `ă`. When the user types "creează" (with diacritics), `\b` fails to match at the boundary.

Additionally, if the regex fails and the request falls through to the AI loop, the system prompt already includes the language instruction — but the AI still prefers to search products first rather than calling `create_order`.

### Fix

**File: `supabase/functions/chat/index.ts`**

1. **Make the regex more permissive** — remove `\b` boundaries, use looser matching, and add more Romanian variations:
   ```
   const orderIntentRe = /(cre(?:ea)?z[aă]|f[aă]|plaseaz[aă]|adaug[aă]|pune|place|create|make|add|new)\s.*?(comand[aă]|order)/i;
   ```
   Remove `\b` (unreliable with Unicode) and use `\s` + non-greedy `.*?` instead.

2. **Add fallback in the system prompt** — instruct the AI that when the user asks to create/place an order, it MUST call `create_order` immediately without searching products first. Add this to the system prompt near the tool instructions:
   ```
   When the user asks to create, place, or make a new order (in any language), you MUST call the create_order tool immediately. Do NOT search for products first — the order form will handle product selection.
   ```

This is a one-file change to `supabase/functions/chat/index.ts` — fix the regex and strengthen the system prompt instruction.

