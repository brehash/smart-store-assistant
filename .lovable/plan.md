

# Fix GEO Tool — Revised Plan (Keep OpenAI model as-is)

## Issues to Fix

### 1. Products slider STILL shows during GEO flow
**Root cause**: `geoFlowActive` is only set from tool call batches (line 529), but `search_products` runs in batch 1 and `generate_geo_content` in batch 2. By the time the GEO tool appears, the slider is already emitted.

**Fix**: Import `GEO_INTENT_RE` from `intent.ts` and set `geoFlowActive = true` from the **user message** right after line 257, before any tool execution begins.

```typescript
// intent.ts — export the regex
export { GEO_INTENT_RE };

// index.ts — after line 257
import { GEO_INTENT_RE } from "./intent.ts";
if (GEO_INTENT_RE.test(lastUserMsg)) geoFlowActive = true;
```

### 2. Entity validation — prevent "Unknown" entity
**File**: `tool-executor.ts` line 952

Add early validation: if `entity_id` is falsy or 0, return error immediately.

### 3. GEO prompt generates content about Yoast instead of the product
**Root cause**: The prompt says `SEO Plugin: Yoast SEO` prominently, and the AI confuses this with the product to optimize.

**Fix**: Restructure the prompt (line 988-1006) to clearly separate product info from plugin metadata, and add a guardrail:
- Move product name/description to the top as the primary focus
- Move SEO plugin info to a small metadata note at the end
- Add: `"Generate content ONLY about the product '${entityName}'. Do NOT generate content about SEO plugins."`

### 4. AI dumps raw JSON in chat
**Fix**: Update `_instruction` (line 1071) to explicitly say: `"The preview card already shows the generated content. Do NOT output JSON or raw data. Briefly confirm what was generated in natural language, then IMMEDIATELY call update_${entity_type}."`

### 5. Update prompts.ts GEO section
Strengthen line 140 to say the AI must NOT output tool results as JSON text — the rich card handles visualization.

## Files to Modify
1. **`supabase/functions/chat/intent.ts`** — Export `GEO_INTENT_RE`
2. **`supabase/functions/chat/index.ts`** — Add message-level GEO intent detection after line 257
3. **`supabase/functions/chat/tool-executor.ts`** — Add entity_id validation, restructure GEO prompt, update `_instruction` (keep OpenAI model `gpt-5.4-mini` unchanged)
4. **`supabase/functions/chat/prompts.ts`** — Strengthen GEO output instructions

