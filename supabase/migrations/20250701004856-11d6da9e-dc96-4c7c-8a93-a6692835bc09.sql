
-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests from cron jobs
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add last_run tracking to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS last_run timestamp with time zone,
ADD COLUMN IF NOT EXISTS cron_job_id bigint;

-- Create function to schedule individual task cron jobs
CREATE OR REPLACE FUNCTION schedule_task_cron(task_id_param uuid, poll_interval_param integer)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    job_id bigint;
    cron_expression text;
    sql_command text;
BEGIN
    -- Convert seconds to cron expression
    -- For intervals less than 60 seconds, we'll use minute-based scheduling with multiple runs
    IF poll_interval_param < 60 THEN
        cron_expression := format('*/%s * * * *', GREATEST(1, poll_interval_param / 60));
    ELSE
        cron_expression := format('0 */%s * * *', poll_interval_param / 60);
    END IF;
    
    -- Build the SQL command for the cron job
    sql_command := format('select net.http_post(url:=''https://hzinvalidlnlhindttbu.supabase.co/functions/v1/task-scheduler'', headers:=''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6aW52YWxpZGxubGhpbmR0dGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNjM5NTksImV4cCI6MjA2NjczOTk1OX0.Wj8TYNXOlMVGZjrOONL3gWx-IAq6T-6ajpzM82ehuJY"}''::jsonb, body:=''{"taskId": "%s"}''::jsonb) as request_id;', task_id_param);
    
    -- Schedule the cron job
    SELECT cron.schedule(
        format('task_%s', task_id_param),
        cron_expression,
        sql_command
    ) INTO job_id;
    
    RETURN job_id;
END;
$$;

-- Create function to unschedule task cron jobs
CREATE OR REPLACE FUNCTION unschedule_task_cron(task_id_param uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Unschedule the cron job
    PERFORM cron.unschedule(format('task_%s', task_id_param));
END;
$$;

-- Create trigger function to automatically manage cron jobs
CREATE OR REPLACE FUNCTION manage_task_cron_jobs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    job_id bigint;
BEGIN
    -- Handle INSERT (new tasks)
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'active' THEN
            job_id := schedule_task_cron(NEW.id, COALESCE(NEW.poll_interval, 300));
            UPDATE tasks SET cron_job_id = job_id WHERE id = NEW.id;
        END IF;
        RETURN NEW;
    END IF;
    
    -- Handle UPDATE (status changes)
    IF TG_OP = 'UPDATE' THEN
        -- If status changed from inactive to active
        IF OLD.status != 'active' AND NEW.status = 'active' THEN
            job_id := schedule_task_cron(NEW.id, COALESCE(NEW.poll_interval, 300));
            NEW.cron_job_id := job_id;
        -- If status changed from active to inactive
        ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
            PERFORM unschedule_task_cron(NEW.id);
            NEW.cron_job_id := NULL;
        -- If poll_interval changed for active task
        ELSIF NEW.status = 'active' AND (OLD.poll_interval IS DISTINCT FROM NEW.poll_interval) THEN
            PERFORM unschedule_task_cron(NEW.id);
            job_id := schedule_task_cron(NEW.id, COALESCE(NEW.poll_interval, 300));
            NEW.cron_job_id := job_id;
        END IF;
        RETURN NEW;
    END IF;
    
    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'active' THEN
            PERFORM unschedule_task_cron(OLD.id);
        END IF;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Create trigger to automatically manage cron jobs for tasks
DROP TRIGGER IF EXISTS task_cron_management ON tasks;
CREATE TRIGGER task_cron_management
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION manage_task_cron_jobs();

-- Schedule existing active tasks
DO $$
DECLARE
    task_record RECORD;
    job_id bigint;
BEGIN
    FOR task_record IN 
        SELECT id, poll_interval FROM tasks WHERE status = 'active'
    LOOP
        job_id := schedule_task_cron(task_record.id, COALESCE(task_record.poll_interval, 300));
        UPDATE tasks SET cron_job_id = job_id WHERE id = task_record.id;
    END LOOP;
END;
$$;
