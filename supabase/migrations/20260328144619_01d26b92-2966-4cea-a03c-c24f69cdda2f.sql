
-- Credit balances table
CREATE TABLE public.credit_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance integer NOT NULL DEFAULT 100,
  monthly_allowance integer NOT NULL DEFAULT 100,
  last_refill_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own balance" ON public.credit_balances
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage balances" ON public.credit_balances
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Credit transactions table
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  reason text NOT NULL,
  message_id uuid NULL,
  metadata jsonb NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert transactions" ON public.credit_transactions
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to auto-update updated_at on credit_balances
CREATE TRIGGER update_credit_balances_updated_at
  BEFORE UPDATE ON public.credit_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to refill credits if 30+ days since last refill
CREATE OR REPLACE FUNCTION public.refill_credits_if_due(_user_id uuid)
RETURNS public.credit_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result public.credit_balances;
BEGIN
  -- Insert default row if not exists
  INSERT INTO public.credit_balances (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Check if refill is due (30+ days)
  UPDATE public.credit_balances
  SET balance = monthly_allowance,
      last_refill_at = now()
  WHERE user_id = _user_id
    AND last_refill_at < now() - interval '30 days';

  -- Return current balance
  SELECT * INTO result FROM public.credit_balances WHERE user_id = _user_id;
  RETURN result;
END;
$$;
