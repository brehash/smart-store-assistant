
CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON public.webhook_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service can insert events" ON public.webhook_events FOR INSERT TO public WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_events;
