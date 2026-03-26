
Fix the issue in two layers: backend stream reliability and frontend message lifecycle.

1. Stabilize the backend stream
- Fix the tool-response parsing path in `supabase/functions/chat/index.ts`.
- Right now the stream reaches `search_products`, then crashes while parsing the tool response (`Unexpected end of JSON input`), which is why reasoning stops mid-flow and no final answer renders.
- Harden `callWooProxy` / tool execution so non-JSON or truncated WooCommerce responses do not kill the whole chat stream.
- When a tool fails, emit:
  - a visible `reasoning` update like “The catalog response was incomplete, retrying…”
  - a `pipeline_step` error state for that step
  - a final assistant fallback explanation instead of disappearing
- Keep sending `[DONE]` only after the stream has emitted a user-visible result or error summary.

2. Surface streamed errors on the frontend
- Update `src/lib/chat-stream.ts` to recognize SSE payloads shaped like `{ error: "..." }`.
- Route those to `onError(...)` immediately instead of silently ignoring them.
- Keep the inactivity timeout, but also treat backend-emitted errors as terminal so the UI does not sit in a fake loading state.

3. Prevent the assistant bubble from “vanishing”
- In `src/pages/Index.tsx`, keep the in-progress assistant message even if the stream fails.
- On error/timeout, convert the last temporary assistant message into a persisted error-state message instead of leaving a half-built transient message that later disappears on reload or resend.
- Also guard against duplicate submissions while a previous request is still unresolved, since the network logs show the same prompt being sent twice.

4. Make reasoning behave like a temporary overlay, then collapse
- Refine `src/components/chat/ReasoningBubbles.tsx` so live thoughts are treated as transient streaming items.
- While streaming:
  - show the latest thought prominently
  - fade older thoughts
  - optionally cap to the latest 3–4 lines
- After completion:
  - hide the individual live lines
  - replace them with one compact summary row like “Thought for 8s · 6 steps”
  - keep the full history available behind expand/collapse
- After failure:
  - preserve the summary row too, but label it clearly, e.g. “Process stopped after 4 steps”.

5. Keep one clean final message layout
- In `src/components/chat/ChatMessage.tsx`, preserve this order for assistant messages:
  1. collapsed reasoning summary
  2. pipeline card
  3. final rendered explanation/dashboard
- Ensure the live reasoning lines do not remain permanently visible after success; they should collapse into that single line as you requested.

6. Clean up pipeline completion states
- In `src/pages/Index.tsx`, keep merging step states as already done, but add explicit handling for:
  - failed step
  - timed out step
  - partial completion
- This avoids the current situation where the plan looks half-finished with no explanation.

7. Expected result after implementation
- You send one message once.
- The chat immediately shows thinking/reasoning.
- Tool activity continues updating instead of freezing.
- If tools succeed, the thought lines collapse into one summary and the final answer/dashboard remains visible.
- If tools fail or timeout, the chat still renders a visible explanation and the pipeline shows where it stopped instead of disappearing.

Technical details
- Files to update:
  - `supabase/functions/chat/index.ts`
  - `supabase/functions/woo-proxy/index.ts`
  - `src/lib/chat-stream.ts`
  - `src/pages/Index.tsx`
  - `src/components/chat/ReasoningBubbles.tsx`
  - `src/components/chat/ChatMessage.tsx`
- Confirmed root cause from logs:
  - backend crash after tool execution: `Stream error: SyntaxError: Unexpected end of JSON input`
  - client currently ignores SSE `{ error: ... }` payloads
  - duplicate sends are happening for the same conversation/prompt after failure
