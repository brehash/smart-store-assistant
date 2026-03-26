

## Fix AI Gateway 400 Error, forwardRef Warnings, and Implement Semantic Pipeline

### Three issues to resolve

**1. AI Gateway 400 error (critical — breaks chat completely)**

Line 601 spreads the entire AI response message object into `aiMessages`, which includes extra fields (like `refusal`, `annotations`, etc.) that the gateway rejects on the next iteration. Additionally, `content: null` can cause issues with some models.

Fix in `supabase/functions/chat/index.ts`:
- Sanitize the assistant message to only include `role`, `content` (as empty string, not null), and `tool_calls`
- Log the actual 400 error body before throwing so we get diagnostics

```typescript
// Line 590 — log error body
const errBody = await aiResp.text();
console.error("AI gateway error:", aiResp.status, errBody);
throw new Error(`AI gateway error: ${aiResp.status}`);

// Line 601 — sanitize message
aiMessages.push({
  role: "assistant",
  content: content || "",
  tool_calls: choice.message.tool_calls,
});
```

**2. forwardRef warnings (non-fatal, cosmetic)**

The `DropdownMenu` in `ConversationSidebar.tsx` wraps a plain `<button>` with `DropdownMenuTrigger asChild`. The warning comes from Radix trying to forward a ref. The fix is minor — no component wrapping needed since the trigger is already a native `<button>` element. The actual warning source may be from how `DropdownMenuContent` renders internally with the shadcn wrapper. We'll verify and apply `forwardRef` where needed in the dropdown-menu UI component.

**3. Semantic pipeline mapper**

Replace the generic tool-name-based pipeline with intent-aware steps in `supabase/functions/chat/index.ts`:

- Add `generateSemanticPlan()` function that maps tool calls to human-readable steps
- Emit "Understanding request" as step 0 immediately before the AI call
- After first AI response with tool calls, emit the full semantic plan with details (resolved dates, search queries)
- After tools finish, emit "Analyzing received data" and "Crafting response" steps

### Files to modify

| File | Changes |
|------|---------|
| `supabase/functions/chat/index.ts` | Fix message sanitization (line 601), add error body logging (line 590), add semantic pipeline mapper, emit immediate "Understanding request" step |
| `src/components/chat/ConversationSidebar.tsx` | Minor: no changes needed if the warning is from Radix internals |
| `src/components/ui/dropdown-menu.tsx` | Verify forwardRef wrapping on DropdownMenuContent |

### Validation
- Send "sales report this month compared to last month same period"
- Confirm no 400 error, chat responds with dashboard
- Confirm pipeline shows semantic steps with date details
- Confirm no forwardRef console warnings

