-- Add item_creation_date column to track when items were listed on eBay
-- This enables latency tracking (time from listing to notification)

-- Add to matches_jewelry table
ALTER TABLE matches_jewelry
ADD COLUMN IF NOT EXISTS item_creation_date TIMESTAMPTZ;

-- Add to matches_gemstone table
ALTER TABLE matches_gemstone
ADD COLUMN IF NOT EXISTS item_creation_date TIMESTAMPTZ;

-- Add to matches_watch table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matches_watch') THEN
    ALTER TABLE matches_watch ADD COLUMN IF NOT EXISTS item_creation_date TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON COLUMN matches_jewelry.item_creation_date IS 'When the item was listed on eBay (from eBay API itemCreationDate)';
COMMENT ON COLUMN matches_gemstone.item_creation_date IS 'When the item was listed on eBay (from eBay API itemCreationDate)';
