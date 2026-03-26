
Root causes I verified in the current code/data:

- The chat menu is being rendered inside the same flex row as the title, but the title cell has no proper width constraint/reserved action space. With long labels, the row overflows and the 3-dots button gets pushed outside the visible sidebar.
- View deletion currently does the opposite of what you asked: the database relation is `ON DELETE SET NULL`, and the UI also locally moves chats out of the view instead of deleting them.
- Rich chat content is not persisted correctly:
  - only the first `rich_content` item is saved
  - reloading only reads a single `rich_content` object
  - pipeline/debug/approval state is saved from React state inside `setMessages`, which is unreliable
  - the approval continuation path saves only plain text, so metadata/rich content is lost
- Product/report requests are not enforced strongly enough at the backend, so the model can answer with plain text instead of actually calling tools.
- The active connection in the database currently has `order_statuses = []`, and the backend still falls back to hardcoded `completed,processing` for reports/comparisons.

Implementation plan:

1. Fix the sidebar chat row layout so the menu always shows
- Refactor each conversation row to reserve a fixed right-side action slot.
- Add proper `min-w-0`/truncate handling for the title so long labels never push actions out.
- Keep the pin and 3-dots inside that reserved slot, swapping cleanly on hover/open.
- Also replace the current inline “new view” insert with the modal flow you requested from the Views plus button.

2. Make views behave like real folders
- Add a migration to change `conversations.view_id` from `ON DELETE SET NULL` to `ON DELETE CASCADE`.
- Update view delete UI/logic so deleting a view deletes its chats, and messages follow via existing conversation cascade.
- Keep “new chat inside view” working after this change.

3. Make chat artifacts persist correctly
- Stop saving the final assistant message from inside a React state setter.
- Capture stream results in local accumulators and persist them once, explicitly and awaited.
- Save all rich outputs, not just the first one.
- Load messages by normalizing `rich_content` as either a single object or an array for backward compatibility.
- Persist and reload pipeline metadata, approvals, questions, and debug logs consistently.

4. Fix the approval follow-up path
- Make approve/edit continuations persist the same full assistant payload shape as normal responses.
- Ensure follow-up tool results, charts, dashboards, and pipeline updates survive reopening the chat.

5. Enforce actual tool usage for product/order/report requests
- Tighten the chat function prompt so:
  - product search must call `search_products`
  - order lookups must call `search_orders`
  - sales reports must call `get_sales_report` or `compare_sales`
  - sales/report answers must include a dashboard block
- Add a backend fallback pass: if the model returns plain text for a tool-required intent, re-prompt it to use the correct tool before streaming the final answer.

6. Fix dashboard/report rendering persistence
- Preserve dashboard JSON as rich content on save and restore it on load.
- Ensure chart/dashboard responses remain visible after reopening the conversation, not only during the first live run.

7. Fix order status behavior end to end
- Update the backend so reports/comparisons/searches use the saved statuses from settings consistently.
- Remove the hardcoded `completed,processing` fallback when user-configured statuses should apply; if no statuses are configured, either omit the filter or apply a clearly defined default in one place only.
- Review the settings save/load flow so selected statuses are actually persisted and hydrated back into the UI.

Files to change:
- `src/components/chat/ConversationSidebar.tsx`
- `src/pages/Index.tsx`
- `supabase/functions/chat/index.ts`
- `src/pages/Settings.tsx`
- new migration in `supabase/migrations/...` for the view delete cascade change

Validation after implementation:
- Hover a very long chat title and confirm the 3-dots menu remains visible and clickable.
- Create a view from the plus-button modal, create chats inside it, then delete the view and confirm the chats are deleted too.
- Run product search and confirm product cards appear live and still appear after reopening the chat.
- Run a sales report and confirm the dashboard appears live and still appears after reopening the chat.
- Change default order statuses in settings, save them, then verify report/order tool calls use those exact statuses instead of hardcoded ones.
