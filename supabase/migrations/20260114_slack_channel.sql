-- Add slack_channel column to tasks table
-- This allows each task to send notifications to a specific Slack channel
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS slack_channel TEXT;

-- Add a comment explaining the field
COMMENT ON COLUMN tasks.slack_channel IS 'Slack channel name or ID for notifications (e.g., #gold-jewelry or C01ABC123)';
