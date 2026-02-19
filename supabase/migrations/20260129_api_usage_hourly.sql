-- Hourly API usage view for monitoring
CREATE OR REPLACE VIEW api_usage_hourly AS
SELECT
  date_trunc('hour', called_at) as hour,
  api_key_label,
  call_type,
  COUNT(*) as call_count
FROM api_usage
WHERE called_at >= NOW() - INTERVAL '24 hours'
GROUP BY date_trunc('hour', called_at), api_key_label, call_type
ORDER BY hour DESC, api_key_label, call_type;

-- Function to get hourly breakdown for today
CREATE OR REPLACE FUNCTION get_api_usage_hourly(hours_back INTEGER DEFAULT 24)
RETURNS TABLE (
  hour TIMESTAMPTZ,
  api_key TEXT,
  search_calls BIGINT,
  detail_calls BIGINT,
  total_calls BIGINT
)
LANGUAGE sql
AS $$
  SELECT
    date_trunc('hour', called_at) as hour,
    api_key_label as api_key,
    COALESCE(SUM(CASE WHEN call_type = 'search' THEN 1 ELSE 0 END), 0) as search_calls,
    COALESCE(SUM(CASE WHEN call_type = 'item_detail' THEN 1 ELSE 0 END), 0) as detail_calls,
    COUNT(*) as total_calls
  FROM api_usage
  WHERE called_at >= NOW() - (hours_back || ' hours')::INTERVAL
  GROUP BY date_trunc('hour', called_at), api_key_label
  ORDER BY hour DESC, total_calls DESC;
$$;

-- Function to get total calls per hour (all keys combined)
CREATE OR REPLACE FUNCTION get_api_usage_hourly_totals(hours_back INTEGER DEFAULT 24)
RETURNS TABLE (
  hour TIMESTAMPTZ,
  search_calls BIGINT,
  detail_calls BIGINT,
  total_calls BIGINT
)
LANGUAGE sql
AS $$
  SELECT
    date_trunc('hour', called_at) as hour,
    COALESCE(SUM(CASE WHEN call_type = 'search' THEN 1 ELSE 0 END), 0) as search_calls,
    COALESCE(SUM(CASE WHEN call_type = 'item_detail' THEN 1 ELSE 0 END), 0) as detail_calls,
    COUNT(*) as total_calls
  FROM api_usage
  WHERE called_at >= NOW() - (hours_back || ' hours')::INTERVAL
  GROUP BY date_trunc('hour', called_at)
  ORDER BY hour DESC;
$$;
