

# Show Generated GEO Content Before Approval

## Problem
Currently, `generate_geo_content` returns a summary card (JSON-LD ✓, FAQ ✓, etc.) but the prompt tells the AI to immediately call `update_product` WITHOUT showing the actual generated content. The user wants to see **what was generated** (the description, FAQ, meta description) before approving the update.

## Fix

### 1. Update prompt to show content before updating
**File**: `supabase/functions/chat/prompts.ts` (line 140)

Change the instruction from "Do NOT output the generated content as text" to:
- After `generate_geo_content` returns, present a brief summary of what was generated: the meta description, number of FAQs, and whether JSON-LD was included.
- Then call `update_product`/`update_page`/`update_post` — the approval card will let the user confirm.

### 2. Enrich the `geo_report` rich content card with generated preview
**File**: `supabase/functions/chat/tool-executor.ts` (~lines 1073-1096)

Add a `preview` section to the `richContent.data` object containing:
- `meta_description` — the generated meta description text
- `short_description` — the generated short description
- `faqCount` — number of FAQ items detected
- `hasJsonLd` — boolean

### 3. Update `GeoReportCard` to render the preview
**File**: `src/components/chat/GeoReportCard.tsx`

Add a "Generated Content Preview" section below the score/categories when `data.preview` exists:
- Show meta description in a bordered box
- Show short description
- Show "3 FAQs generated" and "JSON-LD ✓" badges
- This replaces the `score: -1` awkward display with a "Content Generated" header

### 4. Remove `_instruction` suppression
**File**: `supabase/functions/chat/tool-executor.ts` (line 1071)

Keep the `_instruction` to chain into `update_product`, but remove the "Do NOT output the generated content as text" part since the rich card now shows the preview.

## Files to modify
1. `supabase/functions/chat/prompts.ts` — allow AI to briefly describe generated content
2. `supabase/functions/chat/tool-executor.ts` — add preview data to richContent
3. `src/components/chat/GeoReportCard.tsx` — render preview section for generated content

