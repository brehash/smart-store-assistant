

# Custom Meta Key Definitions — Per-User Memory

## Problem
The `get_orders_with_meta` tool has a hardcoded `RELEVANT_META_KEYS` list. Users with custom WooCommerce plugins have meta keys the AI doesn't know about and can't search for or interpret.

## Solution
Extend the existing `save_preference` system with a new preference type `"meta_definition"` that lets users teach the AI about custom meta keys through conversation (e.g., "when I ask about delivery notes, look for the meta key `_custom_delivery_note`").

## Changes

### 1. `supabase/functions/chat/tools.ts`
- Add `"meta_definition"` to the `save_preference` tool's `preference_type` enum
- Update the description to mention meta key definitions

### 2. `supabase/functions/chat/tool-executor.ts`
- In the `get_orders_with_meta` case: load user preferences of type `meta_definition` and merge their keys into `RELEVANT_META_KEYS` before filtering
- This way custom keys are included in the meta filtering automatically

### 3. `supabase/functions/chat/prompts.ts`
- Add a section to the system prompt explaining that the AI can learn custom meta key definitions from users
- Instruct the AI to call `save_preference` with `preference_type: "meta_definition"`, `key` as the meta key pattern, and `value` containing `{ description, category }` (e.g., `{ description: "Custom delivery note from courier", category: "shipping" }`)
- Instruct the AI to use saved meta definitions when interpreting `get_orders_with_meta` results

### 4. `supabase/functions/chat/index.ts`
- When building `prefsContext`, format `meta_definition` preferences distinctly so the AI knows which meta keys to look for and what they mean

## How It Works

1. User says: *"When I ask about delivery notes, the meta key is `_custom_note_field` and it contains the courier's note"*
2. AI calls `save_preference({ preference_type: "meta_definition", key: "_custom_note_field", value: { description: "Courier delivery note", category: "shipping" } })`
3. Next time `get_orders_with_meta` runs, it loads meta definitions and includes `_custom_note_field` in the filter
4. The system prompt tells the AI what each custom key means for correct interpretation

## No Database Changes
Uses the existing `user_preferences` table and `save_preference` tool — just a new `preference_type` value.

