-- Add columns to track Slack messages for reaction handling
-- slack_message_ts: Slack's message timestamp (acts as message ID)
-- slack_channel_id: The channel where the notification was posted
ALTER TABLE matches ADD COLUMN IF NOT EXISTS slack_message_ts TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS slack_channel_id TEXT;

-- Index for quick lookup when handling reactions
CREATE INDEX IF NOT EXISTS idx_matches_slack_message ON matches(slack_channel_id, slack_message_ts);
