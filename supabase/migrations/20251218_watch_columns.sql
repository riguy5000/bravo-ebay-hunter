-- Add missing columns to matches_watch table for better watch tracking

-- Year manufactured column
ALTER TABLE public.matches_watch
ADD COLUMN IF NOT EXISTS year_manufactured INTEGER;

-- Brand column
ALTER TABLE public.matches_watch
ADD COLUMN IF NOT EXISTS brand TEXT;

-- Model column
ALTER TABLE public.matches_watch
ADD COLUMN IF NOT EXISTS model TEXT;

-- Add index on brand for faster filtering
CREATE INDEX IF NOT EXISTS idx_matches_watch_brand
ON public.matches_watch(brand);

-- Add index on year for faster filtering
CREATE INDEX IF NOT EXISTS idx_matches_watch_year
ON public.matches_watch(year_manufactured);
