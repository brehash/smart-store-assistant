

# Vector Memory with OpenAI Embeddings + pgvector

## Overview
Add semantic memory so the AI can retrieve relevant past conversations and preferences using similarity search instead of just injecting all preferences into the system prompt.

## Architecture

```text
User sends message
  → chat edge function
  → Generate embedding via OpenAI (text-embedding-3-small)
  → Query pgvector for top-K similar memories
  → Inject relevant memories into system prompt context
  → After assistant responds, store conversation summary as new embedding
```

## Changes

### 1. Database Migration — Enable pgvector + Create Table

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Memory embeddings table
CREATE TABLE public.memory_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  embedding extensions.vector(1536) NOT NULL,
  memory_type text NOT NULL DEFAULT 'conversation_summary',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast similarity search
CREATE INDEX memory_embeddings_user_idx ON public.memory_embeddings(user_id);
CREATE INDEX memory_embeddings_vector_idx ON public.memory_embeddings
  USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

-- RLS
ALTER TABLE public.memory_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own memories"
  ON public.memory_embeddings FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Similarity search function (bypasses RLS for service role usage)
CREATE OR REPLACE FUNCTION public.match_memories(
  _user_id uuid,
  _embedding extensions.vector(1536),
  _match_count int DEFAULT 5,
  _match_threshold float DEFAULT 0.7
)
RETURNS TABLE (id uuid, content text, memory_type text, metadata jsonb, similarity float)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    me.id, me.content, me.memory_type, me.metadata,
    1 - (me.embedding <=> _embedding) AS similarity
  FROM public.memory_embeddings me
  WHERE me.user_id = _user_id
    AND 1 - (me.embedding <=> _embedding) > _match_threshold
  ORDER BY me.embedding <=> _embedding
  LIMIT _match_count;
$$;
```

### 2. New Edge Function — `supabase/functions/embeddings/index.ts`

Handles two operations via a JSON body `action` field:

- **`embed_and_store`**: Takes `content`, `memory_type`, `metadata`. Calls OpenAI `text-embedding-3-small` to generate a 1536-dim vector, then inserts into `memory_embeddings`.
- **`search`**: Takes `query` text + optional `match_count`/`threshold`. Generates embedding for the query, calls `match_memories` RPC, returns ranked results.

Uses the existing `OPENAI_API_KEY` secret (already configured). Authenticates via JWT from the Authorization header to get user_id.

### 3. Chat Edge Function Updates — `supabase/functions/chat/index.ts`

**Before AI call** (after loading preferences, ~line 2108):
1. Generate embedding for the user's latest message using OpenAI API directly (inline, not via the embeddings function — avoids extra HTTP hop).
2. Call `match_memories` RPC with the embedding to get top 5 relevant memories.
3. Append matched memories to the system prompt as a "Relevant memories from past conversations" section.

**After AI response completes** (after the streaming loop ends):
1. If the conversation had meaningful content (not just a greeting), build a brief summary of the exchange (user question + assistant answer gist).
2. Fire-and-forget: call OpenAI to embed the summary, then insert into `memory_embeddings` with `memory_type: 'conversation_summary'` and metadata containing `conversation_id`.

**Memory types** supported:
- `conversation_summary` — auto-generated after each meaningful exchange
- `preference` — when `save_preference` tool is called, also store as an embedding for semantic retrieval
- `product_knowledge` — when the AI learns about specific products (optional, future)

### 4. Frontend — No Changes Required

The memory system is entirely backend. The existing chat UI continues to work as-is; it just gets better context injected automatically.

## Cost Impact
- **OpenAI embeddings**: ~$0.02 per 1M tokens with `text-embedding-3-small`. Each message generates ~2 API calls (1 for search, 1 for storage). At 100 messages/day ≈ $0.01/month.
- **Database storage**: 1536-dim vector = ~6KB per row. 10,000 memories ≈ 60MB.
- **No Lovable Cloud cost changes** — pgvector is a free Postgres extension.

## Files Modified/Created
1. **Migration SQL** — Enable pgvector, create `memory_embeddings` table + `match_memories` function
2. **`supabase/functions/embeddings/index.ts`** — New edge function for standalone embed/search operations
3. **`supabase/functions/chat/index.ts`** — Add memory retrieval before AI call + memory storage after response

