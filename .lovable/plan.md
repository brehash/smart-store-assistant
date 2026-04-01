

# Fix GEO Tool — Stop JSON Dumping

## Root Cause

The problem is a **data flow issue**, not a UI rendering bug. Here's what happens:

1. `generate_geo_content` returns the full generated HTML content (description, short_description, meta_description, meta_fields) in `result`
2. `truncateForAI` in `utils.ts` **preserves all of it** (lines 269-286) — including the massive HTML description
3. This entire blob gets serialized as the tool result content sent back to the LLM
4. The LLM sees thousands of chars of HTML/JSON and dumps it into chat text instead of following the `_instruction`

The `richContent` path works fine — the card IS emitted via SSE. But the AI also sees the full data and echoes it.

## Fix (2 files)

### 1. `supabase/functions/chat/tool-executor.ts` (~line 1077)

Split the return: send only a **minimal summary** in `result` (what the AI sees), keep full data only in `richContent` (what the UI renders).

```typescript
return {
  result: {
    status: "generated",
    entityName,
    entity_type,
    entity_id,
    seo_plugin: hasYoast ? "yoast" : hasRankMath ? "rankmath" : "none",
    generated_fields: ["description", "short_description", "meta_description", 
                       ...(geoOutput.meta_fields?.length ? ["meta_fields"] : [])],
    _instruction: `The preview card already shows the generated content. Do NOT output JSON or raw data. Confirm briefly, then IMMEDIATELY call update_${entity_type} with id ${entity_id}. Use these exact values: description="${geoOutput.optimized_description}", short_description="${geoOutput.short_description}", meta_data=${JSON.stringify(geoOutput.meta_fields || [])}`,
  },
  richContent: { /* unchanged — keeps full preview data */ },
};
```

The key change: the `description` and `short_description` HTML are moved OUT of `result` and INTO `_instruction` as inline parameters for the `update_product` call. The AI gets a clean, small result with explicit instructions on what to pass.

### 2. `supabase/functions/chat/utils.ts` (~line 269)

Simplify the `generate_geo_content` truncation to return only the minimal fields, since the heavy data is no longer in `result`:

```typescript
if (toolName === "generate_geo_content") {
  return {
    status: result.status,
    entityName: result.entityName,
    entity_type: result.entity_type,
    entity_id: result.entity_id,
    generated_fields: result.generated_fields,
    _instruction: result._instruction,
  };
}
```

This removes `description`, `short_description`, `meta_description`, and `meta_fields` from the AI-visible result entirely. The `_instruction` already contains the values needed for the chained `update_product` call.

## Why this works

- The AI sees: `{status: "generated", entityName: "50gr pasta neagra", entity_type: "product", entity_id: 123, generated_fields: [...], _instruction: "call update_product with..."}`
- The user sees: the rich GeoReportCard with preview badges and meta description
- No JSON dump because there's no JSON to dump — the heavy content is only in `_instruction` which the AI treats as a directive, not displayable content

## Files to modify
1. **`supabase/functions/chat/tool-executor.ts`** — Move generated content from `result` to `_instruction` inline params
2. **`supabase/functions/chat/utils.ts`** — Strip `generate_geo_content` truncation to minimal fields only

