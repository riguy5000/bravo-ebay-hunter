-- Function to get all task-related cron jobs
CREATE OR REPLACE FUNCTION get_task_cron_jobs()
RETURNS TABLE (jobid bigint, jobname text, schedule text, active boolean)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jobid, jobname, schedule, active
  FROM cron.job
  WHERE jobname LIKE 'task_%';
$$;
