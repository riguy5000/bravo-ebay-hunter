
-- Remove the problematic trigger that causes permission errors
DROP TRIGGER IF EXISTS task_cron_management ON tasks;

-- Keep the scheduling functions but modify them to work with edge functions
-- (The functions themselves are fine, we just can't call them from triggers with user permissions)

-- Remove the automatic scheduling of existing tasks since it causes permission errors
-- We'll handle this through the edge function instead
