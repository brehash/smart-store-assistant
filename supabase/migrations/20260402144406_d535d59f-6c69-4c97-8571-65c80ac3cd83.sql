CREATE POLICY "Team members can view owner cron logs"
ON public.cron_job_logs
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT t.owner_id
    FROM teams t
    WHERE t.id IN (SELECT get_user_team_ids(auth.uid()))
  )
);