-- Add notification_sent column to all match tables
ALTER TABLE matches_jewelry ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE matches_gemstone ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE matches_watch ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE;

-- Create index for efficient querying of unsent notifications
CREATE INDEX IF NOT EXISTS idx_matches_jewelry_notification_sent ON matches_jewelry(notification_sent) WHERE notification_sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_matches_gemstone_notification_sent ON matches_gemstone(notification_sent) WHERE notification_sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_matches_watch_notification_sent ON matches_watch(notification_sent) WHERE notification_sent = FALSE;
