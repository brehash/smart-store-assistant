
-- Teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Team members table
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Team invitations table
CREATE TABLE public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Add team_id to credit_balances
ALTER TABLE public.credit_balances ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- RLS: teams
CREATE POLICY "Team members can view their team"
  ON public.teams FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = id AND tm.user_id = auth.uid())
  );

CREATE POLICY "Users can create teams"
  ON public.teams FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Team owner can update team"
  ON public.teams FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Team owner can delete team"
  ON public.teams FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- RLS: team_members
CREATE POLICY "Team members can view members"
  ON public.team_members FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.team_members tm2 WHERE tm2.team_id = team_id AND tm2.user_id = auth.uid())
  );

CREATE POLICY "Team owner can manage members"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Team owner can remove members"
  ON public.team_members FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
    OR user_id = auth.uid()
  );

-- RLS: team_invitations
CREATE POLICY "Team members can view invitations"
  ON public.team_invitations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_id AND tm.user_id = auth.uid())
  );

CREATE POLICY "Team owner can create invitations"
  ON public.team_invitations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
  );

CREATE POLICY "Team owner can manage invitations"
  ON public.team_invitations FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
  );

CREATE POLICY "Team owner can delete invitations"
  ON public.team_invitations FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
  );

-- Function to get team credit balance for a user (resolves through team membership)
CREATE OR REPLACE FUNCTION public.get_team_credit_balance(_user_id uuid)
RETURNS TABLE(balance integer, team_id uuid, monthly_allowance integer, last_refill_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cb.balance, cb.team_id, cb.monthly_allowance, cb.last_refill_at
  FROM public.credit_balances cb
  WHERE cb.team_id IS NOT NULL
    AND cb.team_id = (
      SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = _user_id LIMIT 1
    )
  LIMIT 1
$$;

-- Update credit_balances RLS to allow team members to view team balance
DROP POLICY IF EXISTS "Users can view own balance" ON public.credit_balances;
CREATE POLICY "Users can view own or team balance"
  ON public.credit_balances FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin')
    OR (
      team_id IS NOT NULL 
      AND EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = credit_balances.team_id AND tm.user_id = auth.uid())
    )
  );
