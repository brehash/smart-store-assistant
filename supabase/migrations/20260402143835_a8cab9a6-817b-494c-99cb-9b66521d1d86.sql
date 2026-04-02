
ALTER TABLE public.cron_job_logs ADD COLUMN user_id uuid;

CREATE POLICY "Users can view own cron logs"
ON public.cron_job_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
