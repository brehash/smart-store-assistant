
-- Create credit_topup_packs table
CREATE TABLE public.credit_topup_packs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  credits integer NOT NULL,
  price_cents integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_topup_packs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active packs
CREATE POLICY "Authenticated users can view active packs"
ON public.credit_topup_packs
FOR SELECT
TO authenticated
USING (true);

-- Admins can manage packs
CREATE POLICY "Admins can manage packs"
ON public.credit_topup_packs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed the 4 packs
INSERT INTO public.credit_topup_packs (name, credits, price_cents, sort_order) VALUES
  ('Starter', 100, 1200, 1),
  ('Basic', 250, 2700, 2),
  ('Plus', 500, 4900, 3),
  ('Max', 1000, 8900, 4);
