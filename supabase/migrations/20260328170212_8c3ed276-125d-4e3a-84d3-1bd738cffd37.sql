
-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  monthly_price_cents INTEGER NOT NULL DEFAULT 0,
  credits INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create app_settings table
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT 'true'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add plan_id to credit_balances
ALTER TABLE public.credit_balances ADD COLUMN plan_id UUID REFERENCES public.subscription_plans(id);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- RLS: subscription_plans
CREATE POLICY "Anyone authenticated can view active plans" ON public.subscription_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage plans" ON public.subscription_plans FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS: app_settings
CREATE POLICY "Anyone authenticated can view settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed subscription plans
INSERT INTO public.subscription_plans (name, slug, monthly_price_cents, credits, description, sort_order) VALUES
  ('Starter', 'starter', 900, 100, 'Perfect for small stores getting started', 1),
  ('Growth', 'growth', 2900, 500, 'For growing businesses with moderate usage', 2),
  ('Pro', 'pro', 5900, 1500, 'For power users who need high volume', 3),
  ('Enterprise', 'enterprise', 14900, 5000, 'Unlimited potential for large operations', 4);

-- Seed default app settings
INSERT INTO public.app_settings (key, value) VALUES ('enable_topup_modal', 'true'::jsonb);
