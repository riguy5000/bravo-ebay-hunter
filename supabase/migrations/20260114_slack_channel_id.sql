-- Add slack_channel_id column to tasks table
-- This stores the Slack channel ID for archiving when task is deleted
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS slack_channel_id TEXT;
