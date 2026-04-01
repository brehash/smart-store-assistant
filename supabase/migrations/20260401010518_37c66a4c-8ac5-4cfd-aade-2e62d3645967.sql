
CREATE TABLE public.message_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rating text NOT NULL CHECK (rating IN ('up', 'down')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (message_id, user_id)
);

ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own feedback"
  ON public.message_feedback
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback"
  ON public.message_feedback
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
