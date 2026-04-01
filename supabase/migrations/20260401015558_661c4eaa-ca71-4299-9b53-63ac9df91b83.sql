
-- Security definer functions to avoid RLS recursion on team_members
CREATE OR REPLACE FUNCTION public.get_user_team_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.team_members WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id)
$$;

-- Fix team_members SELECT policy (was self-referencing)
DROP POLICY IF EXISTS "Team members can view members" ON public.team_members;
CREATE POLICY "Team members can view members" ON public.team_members
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR team_id IN (SELECT public.get_user_team_ids(auth.uid())));

-- Fix teams SELECT policy
DROP POLICY IF EXISTS "Team members can view their team" ON public.teams;
CREATE POLICY "Team members can view their team" ON public.teams
FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR id IN (SELECT public.get_user_team_ids(auth.uid())));

-- Fix woo_connections team SELECT policy
DROP POLICY IF EXISTS "Team members can view owner connections" ON public.woo_connections;
CREATE POLICY "Team members can view owner connections" ON public.woo_connections
FOR SELECT TO authenticated
USING (user_id IN (
  SELECT t.owner_id FROM public.teams t
  WHERE t.id IN (SELECT public.get_user_team_ids(auth.uid()))
));

-- Fix woo_cache team SELECT policy
DROP POLICY IF EXISTS "Team members can view owner cache" ON public.woo_cache;
CREATE POLICY "Team members can view owner cache" ON public.woo_cache
FOR SELECT TO authenticated
USING (user_id IN (
  SELECT t.owner_id FROM public.teams t
  WHERE t.id IN (SELECT public.get_user_team_ids(auth.uid()))
));

-- Fix team_invitations SELECT policy (was self-referencing with wrong alias)
DROP POLICY IF EXISTS "Team members can view invitations" ON public.team_invitations;
CREATE POLICY "Team members can view invitations" ON public.team_invitations
FOR SELECT TO authenticated
USING (team_id IN (SELECT public.get_user_team_ids(auth.uid())));

-- Fix credit_balances SELECT policy
DROP POLICY IF EXISTS "Users can view own or team balance" ON public.credit_balances;
CREATE POLICY "Users can view own or team balance" ON public.credit_balances
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (team_id IS NOT NULL AND team_id IN (SELECT public.get_user_team_ids(auth.uid())))
);
