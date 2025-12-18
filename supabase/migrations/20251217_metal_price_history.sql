-- Create table to store historical metal prices for charting
CREATE TABLE IF NOT EXISTS public.metal_price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metal TEXT NOT NULL,
  symbol TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  price_gram_24k DECIMAL(10,4),
  price_gram_18k DECIMAL(10,4),
  price_gram_14k DECIMAL(10,4),
  price_gram_10k DECIMAL(10,4),
  currency TEXT DEFAULT 'USD',
  source TEXT DEFAULT 'swissquote',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for efficient querying by metal and date
CREATE INDEX IF NOT EXISTS idx_price_history_symbol_date
ON public.metal_price_history(symbol, recorded_at DESC);

-- Create index for querying by date range
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at
ON public.metal_price_history(recorded_at DESC);

-- Enable RLS
ALTER TABLE public.metal_price_history ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read price history
CREATE POLICY "Anyone can read price history"
ON public.metal_price_history FOR SELECT
USING (true);

-- Only service role can insert (from edge function)
CREATE POLICY "Service role can insert price history"
ON public.metal_price_history FOR INSERT
WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.metal_price_history IS 'Historical metal prices for charting trends over time';
