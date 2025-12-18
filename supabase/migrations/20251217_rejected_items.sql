-- Create rejected_items table to cache rejected eBay items
-- This prevents re-fetching item details for items we've already rejected

CREATE TABLE IF NOT EXISTS rejected_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  ebay_listing_id TEXT NOT NULL,
  rejection_reason TEXT NOT NULL,
  rejected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '48 hours'),

  -- Unique constraint per task+listing combo
  CONSTRAINT rejected_items_task_listing_unique UNIQUE (task_id, ebay_listing_id)
);

-- Index for fast lookups by task_id and expiration
CREATE INDEX idx_rejected_items_task_id ON rejected_items(task_id);
CREATE INDEX idx_rejected_items_expires_at ON rejected_items(expires_at);
CREATE INDEX idx_rejected_items_lookup ON rejected_items(task_id, ebay_listing_id);

-- Enable RLS
ALTER TABLE rejected_items ENABLE ROW LEVEL SECURITY;

-- RLS policy - users can only see their own rejected items (through tasks)
CREATE POLICY "Users can view their own rejected items"
  ON rejected_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = rejected_items.task_id
      AND tasks.user_id = auth.uid()
    )
  );

-- Policy for service role (worker) to insert/delete
CREATE POLICY "Service role can manage rejected items"
  ON rejected_items
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to clean up expired rejected items (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_rejected_items()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rejected_items
  WHERE expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION cleanup_expired_rejected_items() TO service_role;

COMMENT ON TABLE rejected_items IS 'Cache of rejected eBay items to avoid re-fetching details';
COMMENT ON COLUMN rejected_items.expires_at IS 'Items expire after 48 hours in case price/conditions change';
