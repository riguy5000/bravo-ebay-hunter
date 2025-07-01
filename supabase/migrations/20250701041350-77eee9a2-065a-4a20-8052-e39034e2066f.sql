
-- Add system-wide settings for metal price fetching
INSERT INTO settings (key, value_json, description) 
VALUES (
  'metal_fetch_interval',
  '86400',
  'Interval in seconds for fetching metal prices (default: 86400 = daily)'
) ON CONFLICT (key) DO NOTHING;

-- Add expanded listing format support
-- Update any existing tasks that might have the old 3-option format to use the new 5-option format
-- This ensures backward compatibility
UPDATE tasks 
SET listing_format = CASE 
  WHEN listing_format @> ARRAY['Auction'] AND listing_format @> ARRAY['FixedPrice'] 
    THEN ARRAY['Fixed Price (BIN)', 'Auction']
  WHEN listing_format @> ARRAY['FixedPrice'] 
    THEN ARRAY['Fixed Price (BIN)']
  WHEN listing_format @> ARRAY['Auction'] 
    THEN ARRAY['Auction']
  WHEN listing_format @> ARRAY['StoreInventory'] 
    THEN ARRAY['Fixed Price (BIN)']
  ELSE listing_format
END
WHERE listing_format IS NOT NULL;
