-- Notification Errors table for tracking Slack notification failures
-- This allows debugging notification issues after PM2 logs rotate

CREATE TABLE notification_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL,
  match_type TEXT NOT NULL, -- 'jewelry', 'gemstone', 'watch'
  task_id UUID,
  channel TEXT,
  error_message TEXT,
  error_source TEXT, -- 'initial' or 'retry'
  attempt_number INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_errors_created_at ON notification_errors(created_at DESC);
CREATE INDEX idx_notification_errors_match_id ON notification_errors(match_id);

-- Enable RLS
ALTER TABLE notification_errors ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can do anything" ON notification_errors
  FOR ALL
  USING (true)
  WITH CHECK (true);
