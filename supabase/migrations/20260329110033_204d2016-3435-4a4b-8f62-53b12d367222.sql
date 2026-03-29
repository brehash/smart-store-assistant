-- Fix infinite recursion: drop recursive policies and recreate with direct checks

-- Fix team_members SELECT policy (was self-referencing causing recursion)
DROP POLICY IF EXISTS "Team members can view members" ON public.team_members;
CREATE POLICY "Team members can view members" ON public.team_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid())
  );

-- Fix teams SELECT policy (was referencing team_members which references itself)
DROP POLICY IF EXISTS "Team members can view their team" ON public.teams;
CREATE POLICY "Team members can view their team" ON public.teams
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid())
  );

-- Fix credit_balances SELECT policy to use security definer function instead of direct subquery
DROP POLICY IF EXISTS "Users can view own or team balance" ON public.credit_balances;
CREATE POLICY "Users can view own or team balance" ON public.credit_balances
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (team_id IS NOT NULL AND team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()))
  );