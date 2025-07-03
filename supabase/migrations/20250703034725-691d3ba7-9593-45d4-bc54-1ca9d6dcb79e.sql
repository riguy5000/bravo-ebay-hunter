
-- Create a table to store metal prices with timestamps
CREATE TABLE public.metal_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metal TEXT NOT NULL,
  symbol TEXT NOT NULL,
  price NUMERIC NOT NULL,
  change_amount NUMERIC,
  change_percent NUMERIC,
  high NUMERIC,
  low NUMERIC,
  price_gram_24k NUMERIC,
  price_gram_18k NUMERIC,
  price_gram_14k NUMERIC,
  price_gram_10k NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  source TEXT DEFAULT 'goldapi',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(metal, symbol, currency)
);

-- Add Row Level Security (RLS)
ALTER TABLE public.metal_prices ENABLE ROW LEVEL SECURITY;

-- Create policy that allows everyone to view metal prices (public data)
CREATE POLICY "Everyone can view metal prices" 
  ON public.metal_prices 
  FOR SELECT 
  USING (true);

-- Create policy that allows authenticated users to manage metal prices
CREATE POLICY "Service can manage metal prices" 
  ON public.metal_prices 
  FOR ALL 
  USING (auth.uid() IS NOT NULL);

-- Add trigger to update the updated_at column
CREATE TRIGGER update_metal_prices_updated_at
  BEFORE UPDATE ON public.metal_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
