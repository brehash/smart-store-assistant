CREATE TABLE public.woo_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cache_key text NOT NULL,
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cache_key)
);

ALTER TABLE public.woo_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cache" ON public.woo_cache
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);