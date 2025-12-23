-- Add additional columns to matches_gemstone table for enhanced gemstone tracking
-- These columns support the gemstone hunter feature with scoring and classification

-- Add stone type column
ALTER TABLE public.matches_gemstone
ADD COLUMN IF NOT EXISTS stone_type TEXT;

-- Add treatment column
ALTER TABLE public.matches_gemstone
ADD COLUMN IF NOT EXISTS treatment TEXT;

-- Add is_natural boolean
ALTER TABLE public.matches_gemstone
ADD COLUMN IF NOT EXISTS is_natural BOOLEAN DEFAULT true;

-- Add classification column (LOOSE_STONE or JEWELRY_WITH_STONE)
ALTER TABLE public.matches_gemstone
ADD COLUMN IF NOT EXISTS classification TEXT;

-- Add deal score (0-100)
ALTER TABLE public.matches_gemstone
ADD COLUMN IF NOT EXISTS deal_score INTEGER;

-- Add risk score (0-100)
ALTER TABLE public.matches_gemstone
ADD COLUMN IF NOT EXISTS risk_score INTEGER;

-- Add dimensions as JSONB
ALTER TABLE public.matches_gemstone
ADD COLUMN IF NOT EXISTS dimensions JSONB;

-- Add origin column
ALTER TABLE public.matches_gemstone
ADD COLUMN IF NOT EXISTS origin TEXT;

-- Create index on deal_score for filtering high-value deals
CREATE INDEX IF NOT EXISTS idx_gemstone_deal_score ON public.matches_gemstone(deal_score);

-- Create index on risk_score for filtering risky listings
CREATE INDEX IF NOT EXISTS idx_gemstone_risk_score ON public.matches_gemstone(risk_score);

-- Create index on stone_type for filtering by gem type
CREATE INDEX IF NOT EXISTS idx_gemstone_stone_type ON public.matches_gemstone(stone_type);

-- Create index on classification
CREATE INDEX IF NOT EXISTS idx_gemstone_classification ON public.matches_gemstone(classification);

COMMENT ON COLUMN public.matches_gemstone.stone_type IS 'Type of gemstone (Diamond, Ruby, Sapphire, etc.)';
COMMENT ON COLUMN public.matches_gemstone.treatment IS 'Treatment applied to stone (None, Heat, Oiled, Filled, etc.)';
COMMENT ON COLUMN public.matches_gemstone.is_natural IS 'True if natural stone, false if lab-created/synthetic';
COMMENT ON COLUMN public.matches_gemstone.classification IS 'LOOSE_STONE or JEWELRY_WITH_STONE';
COMMENT ON COLUMN public.matches_gemstone.deal_score IS 'Deal quality score 0-100 (higher is better)';
COMMENT ON COLUMN public.matches_gemstone.risk_score IS 'Risk score 0-100 (higher is more risky)';
COMMENT ON COLUMN public.matches_gemstone.dimensions IS 'Stone dimensions in mm {length_mm, width_mm, depth_mm}';
COMMENT ON COLUMN public.matches_gemstone.origin IS 'Geographic origin of stone (Burma, Colombia, etc.)';
