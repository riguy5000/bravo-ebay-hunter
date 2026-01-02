-- Worker Health Metrics table for Health Check Dashboard
-- Stores metrics from each worker poll cycle

CREATE TABLE IF NOT EXISTS public.worker_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id TEXT DEFAULT 'default',
  cycle_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  cycle_duration_ms INTEGER,
  tasks_processed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  total_items_found INTEGER DEFAULT 0,
  total_matches INTEGER DEFAULT 0,
  total_excluded INTEGER DEFAULT 0,
  memory_usage_mb NUMERIC(10,2),
  api_key_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for efficient queries (newest first)
CREATE INDEX IF NOT EXISTS idx_health_metrics_timestamp
ON public.worker_health_metrics(cycle_timestamp DESC);

-- Enable RLS
ALTER TABLE public.worker_health_metrics ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read health metrics
CREATE POLICY "Authenticated users can read health metrics"
ON public.worker_health_metrics
FOR SELECT
TO authenticated
USING (true);

-- Allow service role to insert (worker uses service key)
CREATE POLICY "Service role can insert health metrics"
ON public.worker_health_metrics
FOR INSERT
TO service_role
WITH CHECK (true);

-- Allow anon to insert (for worker without auth)
CREATE POLICY "Anon can insert health metrics"
ON public.worker_health_metrics
FOR INSERT
TO anon
WITH CHECK (true);

-- Cleanup function to remove metrics older than 24 hours
CREATE OR REPLACE FUNCTION cleanup_old_health_metrics()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.worker_health_metrics
  WHERE cycle_timestamp < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute on cleanup function
GRANT EXECUTE ON FUNCTION cleanup_old_health_metrics() TO authenticated;
