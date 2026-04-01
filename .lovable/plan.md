

# Fix GEO Content Generation — 4 Bugs

## Issues Found

1. **Product #0 / AI asks for ID it already has**: `generate_geo_content` is in `WRITE_TOOLS`, so the AI shows an approval card BEFORE executing the tool. At that point, the AI often hasn't properly resolved the product ID from search results — it passes `entity_id: 0` because it's constructing args prematurely. Root cause: `generate_geo_content` shouldn't be a write tool — it only generates content, doesn't modify anything. The actual write is the subsequent `update_product` call.

2. **Approval card + raw JSON dumped as text**: Because `generate_geo_content` is a write tool, the approval flow triggers. But the AI ALSO outputs the generated content's approval structure as raw JSON text in the chat message, because the prompt instructs it to present approval for GEO changes — creating a duplicate approval (one from the system, one from the AI's text output).

3. **Cards disappear on tab switch**: The GEO report and approval card rich content isn't persisted to message metadata, so it's lost on re-render.

4. **Content not actually applied**: With `entity_id: 0`, the product fetch fails or returns wrong data, so the subsequent `update_product` never applies real changes.

## Root Cause

`generate_geo_content` is incorrectly classified as a `WRITE_TOOL`. It's a **read/generate** operation — it fetches entity data and generates optimized content via AI, but writes nothing. The write happens when the AI subsequently calls `update_product` (which IS correctly a write tool and will trigger its own approval).

## Plan

### 1. Remove `generate_geo_content` from WRITE_TOOLS
**File**: `supabase/functions/chat/types.ts`
- Remove `"generate_geo_content"` from the `WRITE_TOOLS` set
- This lets `generate_geo_content` execute immediately (like `audit_geo`), then the AI chains into `update_product` which triggers the real approval

### 2. Add `richContent` to `generate_geo_content` result
**File**: `supabase/functions/chat/tool-executor.ts`
- Return a rich content card showing what was generated (SEO meta status, JSON-LD status) — similar to the second screenshot the user showed
- This gives visual feedback without dumping raw JSON

### 3. Update prompt for GEO tool chaining
**File**: `supabase/functions/chat/prompts.ts`
- Add explicit instruction: "After `generate_geo_content` returns optimized content, IMMEDIATELY call `update_product`/`update_page`/`update_post` with the generated `description`, `short_description`, and `meta_data` fields. Do NOT output the generated content as text. The update tool will trigger the approval card automatically."
- Add: "When the user asks to optimize a product for GEO/SEO and you already have the product from search results or context, use that product's ID directly. Do NOT ask the user for the ID."

### 4. Persist GEO rich content in message metadata
**File**: `src/pages/Index.tsx` (or wherever SSE messages are processed)
- Ensure `geo_report` type rich content is saved to message metadata for reload persistence (same pattern used for dashboards, approval states)

## Files to modify
1. `supabase/functions/chat/types.ts` — remove `generate_geo_content` from WRITE_TOOLS
2. `supabase/functions/chat/tool-executor.ts` — add richContent to generate_geo_content result
3. `supabase/functions/chat/prompts.ts` — improve GEO chaining instructions
4. `src/pages/Index.tsx` — persist GEO rich content (if not already handled)

