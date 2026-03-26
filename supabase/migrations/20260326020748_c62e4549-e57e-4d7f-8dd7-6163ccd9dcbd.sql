-- 1. Views table
CREATE TABLE public.views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'New View',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own views" ON public.views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own views" ON public.views FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own views" ON public.views FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own views" ON public.views FOR DELETE USING (auth.uid() = user_id);

-- 2. Add view_id to conversations
ALTER TABLE public.conversations ADD COLUMN view_id uuid REFERENCES public.views(id) ON DELETE SET NULL;

-- 3. Add metadata to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 4. FK cascade on messages.conversation_id
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

-- 5. Add order_statuses to woo_connections
ALTER TABLE public.woo_connections ADD COLUMN order_statuses text[] NOT NULL DEFAULT '{}'::text[];