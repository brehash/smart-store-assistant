-- Allow team members to read the team owner's woo_cache
CREATE POLICY "Team members can view owner cache"
ON public.woo_cache
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT t.owner_id
    FROM public.teams t
    JOIN public.team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = auth.uid()
  )
);

-- Allow team members to read the team owner's woo_connections (read-only)
CREATE POLICY "Team members can view owner connections"
ON public.woo_connections
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT t.owner_id
    FROM public.teams t
    JOIN public.team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = auth.uid()
  )
);