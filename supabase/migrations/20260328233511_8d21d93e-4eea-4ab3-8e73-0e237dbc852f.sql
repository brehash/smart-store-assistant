
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

-- User lookup index
CREATE INDEX memory_embeddings_user_idx ON public.memory_embeddings(user_id);

-- RLS
ALTER TABLE public.memory_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own memories"
  ON public.memory_embeddings FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
