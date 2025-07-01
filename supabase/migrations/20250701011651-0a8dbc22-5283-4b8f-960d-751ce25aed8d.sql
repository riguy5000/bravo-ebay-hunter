
-- Fix the cron schema permission issue by updating the database functions
-- to work properly with service role permissions

-- Drop and recreate the schedule_task_cron function with proper permissions
DROP FUNCTION IF EXISTS schedule_task_cron(uuid, integer);

CREATE OR REPLACE FUNCTION schedule_task_cron(task_id_param uuid, poll_interval_param integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    job_id bigint;
    cron_expression text;
    sql_command text;
BEGIN
    -- Convert seconds to cron expression
    -- For intervals less than 60 seconds, we'll use minute-based scheduling
    IF poll_interval_param < 60 THEN
        cron_expression := format('*/%s * * * *', GREATEST(1, poll_interval_param / 60));
    ELSE
        cron_expression := format('0 */%s * * *', poll_interval_param / 60);
    END IF;
    
    -- Build the SQL command for the cron job
    sql_command := format('select net.http_post(url:=''https://hzinvalidlnlhindttbu.supabase.co/functions/v1/task-scheduler'', headers:=''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6aW52YWxpZGxubGhpbmR0dGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNjM5NTksImV4cCI6MjA2NjczOTk1OX0.Wj8TYNXOlMVGZjrOONL3gWx-IAq6T-6ajpzM82ehuJY"}''::jsonb, body:=''{"taskId": "%s"}''::jsonb) as request_id;', task_id_param);
    
    -- Schedule the cron job with proper permissions
    SELECT cron.schedule(
        format('task_%s', task_id_param),
        cron_expression,
        sql_command
    ) INTO job_id;
    
    RETURN job_id;
END;
$$;

-- Drop and recreate the unschedule_task_cron function with proper permissions
DROP FUNCTION IF EXISTS unschedule_task_cron(uuid);

CREATE OR REPLACE FUNCTION unschedule_task_cron(task_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Unschedule the cron job with proper permissions
    PERFORM cron.unschedule(format('task_%s', task_id_param));
END;
$$;

-- Grant execute permissions to the service role
GRANT EXECUTE ON FUNCTION schedule_task_cron(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION unschedule_task_cron(uuid) TO service_role;

-- Also grant to postgres role to ensure cron access
GRANT EXECUTE ON FUNCTION schedule_task_cron(uuid, integer) TO postgres;
GRANT EXECUTE ON FUNCTION unschedule_task_cron(uuid) TO postgres;
