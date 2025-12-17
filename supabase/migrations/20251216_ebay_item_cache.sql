-- Cache table for eBay item details to reduce API calls
CREATE TABLE IF NOT EXISTS ebay_item_cache (
  ebay_item_id TEXT PRIMARY KEY,
  item_specifics JSONB,
  title TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Index for faster expiry lookups
CREATE INDEX IF NOT EXISTS idx_ebay_item_cache_expires_at ON ebay_item_cache(expires_at);

-- Function to clean up expired cache entries (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_item_cache()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ebay_item_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Enable RLS
ALTER TABLE ebay_item_cache ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write cache (shared cache)
CREATE POLICY "Allow all users to read cache" ON ebay_item_cache
  FOR SELECT USING (true);

CREATE POLICY "Allow all users to insert cache" ON ebay_item_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all users to update cache" ON ebay_item_cache
  FOR UPDATE USING (true);

CREATE POLICY "Allow all users to delete cache" ON ebay_item_cache
  FOR DELETE USING (true);

-- Table to track rejected items (items that failed filters)
-- This prevents re-fetching and re-checking items we already rejected
CREATE TABLE IF NOT EXISTS ebay_rejected_items (
  ebay_item_id TEXT PRIMARY KEY,
  task_id UUID NOT NULL,
  rejection_reason TEXT,
  rejected_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ebay_rejected_items_task ON ebay_rejected_items(task_id);
CREATE INDEX IF NOT EXISTS idx_ebay_rejected_items_expires ON ebay_rejected_items(expires_at);

-- Enable RLS
ALTER TABLE ebay_rejected_items ENABLE ROW LEVEL SECURITY;

-- Allow all users to read/write rejected items cache
CREATE POLICY "Allow all users to read rejected" ON ebay_rejected_items
  FOR SELECT USING (true);

CREATE POLICY "Allow all users to insert rejected" ON ebay_rejected_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all users to delete rejected" ON ebay_rejected_items
  FOR DELETE USING (true);
