-- Add source column to track where API calls originate from
ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'unknown';

-- Add comment for documentation
COMMENT ON COLUMN api_usage.source IS 'Source of the API call: worker, web-ui, edge-function, etc.';
