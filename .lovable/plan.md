

# Splitting `chat/index.ts` Into Manageable Modules

## The Problem
The file is 3,118 lines. Every time you ask to change anything in it, Lovable reads and processes the entire file, consuming more credits.

## Approach
Deno edge functions support relative imports, so we can split the file into focused modules within the same `supabase/functions/chat/` directory. Each module handles one concern. When you need a change, only the relevant file gets edited.

## Proposed File Structure

```text
supabase/functions/chat/
├── index.ts          (~200 lines) — Entry point, request handling, SSE stream orchestration
├── tools.ts          (~500 lines) — TOOLS array definitions (all 22+ tool schemas)
├── tool-executor.ts  (~600 lines) — executeTool() function + callWooProxy()
├── intent.ts         (~100 lines) — Intent regex groups, selectToolsForIntent(), isShippingIntent()
├── reasoning.ts      (~200 lines) — generateReasoningBefore/After, generateSemanticPlan, TOOL_LABELS
├── prompts.ts        (~200 lines) — System prompt builder, shipping prompt, date rules
├── utils.ts          (~100 lines) — formatDate, clampDay, normalizeSalesReportDates, normalizeCompareSalesDates, coerceMessageContent, sanitizeAiHistory, truncateForAI
├── types.ts          (~30 lines)  — Shared types (SemanticStep, WRITE_TOOLS set, etc.)
```

## What Each File Contains

1. **`types.ts`** — `SemanticStep` interface, `WRITE_TOOLS` set, shared type definitions
2. **`tools.ts`** — The massive `TOOLS` array (all function schemas for OpenAI tool calling)
3. **`intent.ts`** — `INTENT_GROUPS`, regex patterns, `selectToolsForIntent()`, `isShippingIntent()`
4. **`reasoning.ts`** — `TOOL_LABELS`, `generateReasoningBefore()`, `generateReasoningAfter()`, `generateSemanticPlan()`
5. **`utils.ts`** — Date helpers, `coerceMessageContent()`, `sanitizeAiHistory()`, `truncateForAI()`
6. **`tool-executor.ts`** — `callWooProxy()`, the giant `executeTool()` switch statement
7. **`prompts.ts`** — `buildSystemPrompt()` and `buildShippingPrompt()` functions (extracts the huge prompt strings)
8. **`index.ts`** — Imports from above, handles the HTTP request, auth, credit checks, SSE stream loop, approval flow, memory storage

## Impact on Credits
- Editing tool definitions? Only `tools.ts` gets touched (~500 lines vs 3,118)
- Changing a prompt rule? Only `prompts.ts` (~200 lines)
- Adding a new tool executor? Only `tool-executor.ts` (~600 lines)
- Fixing intent detection? Only `intent.ts` (~100 lines)

Estimated ~60-70% reduction in tokens processed per typical edit.

## Files Modified
- `supabase/functions/chat/index.ts` — Stripped down to imports + orchestration
- 7 new files created in `supabase/functions/chat/`

