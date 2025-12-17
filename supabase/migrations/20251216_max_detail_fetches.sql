-- Add max_detail_fetches column to tasks table
-- This limits how many item details are fetched per poll cycle to control API usage

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS max_detail_fetches INTEGER DEFAULT 50;

-- Add a comment explaining the column
COMMENT ON COLUMN public.tasks.max_detail_fetches IS 'Maximum number of item detail API calls per poll cycle. NULL or 0 means unlimited.';
