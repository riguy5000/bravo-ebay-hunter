-- Table to track eBay API usage
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_label TEXT NOT NULL,
  call_type TEXT NOT NULL, -- 'search' or 'item_detail'
  endpoint TEXT,
  called_at TIMESTAMPTZ DEFAULT NOW(),
  date_bucket DATE DEFAULT CURRENT_DATE
);

-- Index for fast daily lookups
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(date_bucket);
CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage(api_key_label, date_bucket);

-- Aggregated daily stats view
CREATE OR REPLACE VIEW api_usage_daily AS
SELECT
  date_bucket,
  api_key_label,
  call_type,
  COUNT(*) as call_count
FROM api_usage
GROUP BY date_bucket, api_key_label, call_type
ORDER BY date_bucket DESC, api_key_label, call_type;

-- Function to get today's usage summary
CREATE OR REPLACE FUNCTION get_api_usage_today()
RETURNS TABLE (
  api_key TEXT,
  search_calls BIGINT,
  detail_calls BIGINT,
  total_calls BIGINT
)
LANGUAGE sql
AS $$
  SELECT
    api_key_label as api_key,
    COALESCE(SUM(CASE WHEN call_type = 'search' THEN 1 ELSE 0 END), 0) as search_calls,
    COALESCE(SUM(CASE WHEN call_type = 'item_detail' THEN 1 ELSE 0 END), 0) as detail_calls,
    COUNT(*) as total_calls
  FROM api_usage
  WHERE date_bucket = CURRENT_DATE
  GROUP BY api_key_label
  ORDER BY total_calls DESC;
$$;

-- Function to get usage for last N days
CREATE OR REPLACE FUNCTION get_api_usage_history(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  date DATE,
  api_key TEXT,
  search_calls BIGINT,
  detail_calls BIGINT,
  total_calls BIGINT
)
LANGUAGE sql
AS $$
  SELECT
    date_bucket as date,
    api_key_label as api_key,
    COALESCE(SUM(CASE WHEN call_type = 'search' THEN 1 ELSE 0 END), 0) as search_calls,
    COALESCE(SUM(CASE WHEN call_type = 'item_detail' THEN 1 ELSE 0 END), 0) as detail_calls,
    COUNT(*) as total_calls
  FROM api_usage
  WHERE date_bucket >= CURRENT_DATE - days_back
  GROUP BY date_bucket, api_key_label
  ORDER BY date_bucket DESC, total_calls DESC;
$$;

-- Clean up old usage data (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_api_usage()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM api_usage WHERE date_bucket < CURRENT_DATE - 30;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Enable RLS
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Allow all users to read/write (shared tracking)
CREATE POLICY "Allow all to read api_usage" ON api_usage FOR SELECT USING (true);
CREATE POLICY "Allow all to insert api_usage" ON api_usage FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all to delete api_usage" ON api_usage FOR DELETE USING (true);
