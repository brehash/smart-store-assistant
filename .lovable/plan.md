

# Store Preference Embeddings for Semantic Search

## Overview
When `save_preference` is called in the chat function, also generate an embedding and store it in `memory_embeddings` with `memory_type: 'preference'`. This makes user preferences retrievable via semantic similarity search alongside conversation summaries.

## Change

### `supabase/functions/chat/index.ts` — `save_preference` case (~line 1462)

After the existing upsert into `user_preferences`, add a fire-and-forget block that:

1. Builds a descriptive text: `"Preference [${args.preference_type}]: ${args.key} = ${JSON.stringify(args.value)}"`
2. Calls OpenAI `text-embedding-3-small` to generate the embedding
3. Inserts into `memory_embeddings` with `memory_type: 'preference'` and metadata containing the preference key and type

This reuses the same pattern already used for conversation summary storage (lines 2887-2912). The `openaiKey` and `serviceClient` variables are already in scope.

### No other files need changes
The embeddings search function and retrieval logic already handle all `memory_type` values — preferences will automatically appear in semantic search results alongside conversation summaries.

