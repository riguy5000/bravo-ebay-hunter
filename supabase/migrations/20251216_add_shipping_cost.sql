-- Add shipping_cost column to matches tables
-- This stores the shipping cost from eBay listings for total cost calculations

ALTER TABLE public.matches_jewelry
ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2) DEFAULT 0;

ALTER TABLE public.matches_watch
ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2) DEFAULT 0;

ALTER TABLE public.matches_gemstone
ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2) DEFAULT 0;

-- Add comments
COMMENT ON COLUMN public.matches_jewelry.shipping_cost IS 'Shipping cost from eBay listing in USD';
COMMENT ON COLUMN public.matches_watch.shipping_cost IS 'Shipping cost from eBay listing in USD';
COMMENT ON COLUMN public.matches_gemstone.shipping_cost IS 'Shipping cost from eBay listing in USD';
