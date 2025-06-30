
-- Phase 1: Database Schema Updates

-- Drop existing matches table and create separate type-specific tables
DROP TABLE IF EXISTS public.matches CASCADE;

-- Create separate matches tables for each item type
CREATE TABLE public.matches_watch (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  
  -- eBay listing data
  ebay_listing_id TEXT NOT NULL,
  ebay_title TEXT NOT NULL,
  ebay_url TEXT,
  listed_price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  buy_format TEXT, -- BIN, Auction, BestOffer
  seller_feedback INTEGER,
  found_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Status and actions
  status match_status NOT NULL DEFAULT 'new',
  offer1 DECIMAL(10,2),
  offer2 DECIMAL(10,2),
  offer3 DECIMAL(10,2),
  offer4 DECIMAL(10,2),
  offer5 DECIMAL(10,2),
  purchased_toggle BOOLEAN DEFAULT false,
  arrived_toggle BOOLEAN DEFAULT false,
  return_toggle BOOLEAN DEFAULT false,
  shipped_back_toggle BOOLEAN DEFAULT false,
  refunded_toggle BOOLEAN DEFAULT false,
  
  -- Watch-specific columns
  case_material TEXT,
  band_material TEXT,
  movement TEXT,
  dial_colour TEXT,
  case_size_mm DECIMAL(5,2),
  chrono24_avg DECIMAL(10,2),
  chrono24_low DECIMAL(10,2),
  price_diff_percent DECIMAL(5,2),
  
  -- AI analysis
  ai_score DECIMAL(3,2),
  ai_reasoning TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.matches_jewelry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  
  -- eBay listing data
  ebay_listing_id TEXT NOT NULL,
  ebay_title TEXT NOT NULL,
  ebay_url TEXT,
  listed_price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  buy_format TEXT,
  seller_feedback INTEGER,
  found_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Status and actions
  status match_status NOT NULL DEFAULT 'new',
  offer1 DECIMAL(10,2),
  offer2 DECIMAL(10,2),
  offer3 DECIMAL(10,2),
  offer4 DECIMAL(10,2),
  offer5 DECIMAL(10,2),
  purchased_toggle BOOLEAN DEFAULT false,
  arrived_toggle BOOLEAN DEFAULT false,
  return_toggle BOOLEAN DEFAULT false,
  shipped_back_toggle BOOLEAN DEFAULT false,
  refunded_toggle BOOLEAN DEFAULT false,
  
  -- Jewelry-specific columns
  weight_g DECIMAL(8,3),
  karat INTEGER,
  metal_type TEXT,
  spot_price_oz DECIMAL(10,2),
  melt_value DECIMAL(10,2),
  refiner_fee_pct DECIMAL(5,2) DEFAULT 2.0,
  profit_scrap DECIMAL(10,2),
  
  -- AI analysis
  ai_score DECIMAL(3,2),
  ai_reasoning TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.matches_gemstone (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  
  -- eBay listing data
  ebay_listing_id TEXT NOT NULL,
  ebay_title TEXT NOT NULL,
  ebay_url TEXT,
  listed_price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  buy_format TEXT,
  seller_feedback INTEGER,
  found_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Status and actions
  status match_status NOT NULL DEFAULT 'new',
  offer1 DECIMAL(10,2),
  offer2 DECIMAL(10,2),
  offer3 DECIMAL(10,2),
  offer4 DECIMAL(10,2),
  offer5 DECIMAL(10,2),
  purchased_toggle BOOLEAN DEFAULT false,
  arrived_toggle BOOLEAN DEFAULT false,
  return_toggle BOOLEAN DEFAULT false,
  shipped_back_toggle BOOLEAN DEFAULT false,
  refunded_toggle BOOLEAN DEFAULT false,
  
  -- Gemstone-specific columns
  shape TEXT,
  carat DECIMAL(8,3),
  colour TEXT,
  clarity TEXT,
  cut_grade TEXT,
  cert_lab TEXT,
  rapnet_avg DECIMAL(10,2),
  rapaport_list DECIMAL(10,2),
  price_diff_percent DECIMAL(5,2),
  
  -- AI analysis
  ai_score DECIMAL(3,2),
  ai_reasoning TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add new fields to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS exclude_keywords TEXT[];
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS price_delta_type TEXT DEFAULT 'absolute';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS price_delta_value DECIMAL(10,2);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS auction_alert BOOLEAN DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS date_from TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS date_to TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS item_location TEXT;

-- Create eBay aspects cache table with proper constraints
CREATE TABLE public.ebay_aspects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id TEXT NOT NULL,
  brand TEXT,
  aspect_name TEXT NOT NULL,
  values_json JSONB NOT NULL,
  refreshed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Use the correct unique constraint that matches the upsert operation
  UNIQUE(category_id, aspect_name)
);

-- Create flexible settings table
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.matches_watch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches_jewelry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches_gemstone ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebay_aspects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for matches_watch
CREATE POLICY "Users can view their own watch matches" ON public.matches_watch FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own watch matches" ON public.matches_watch FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own watch matches" ON public.matches_watch FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own watch matches" ON public.matches_watch FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for matches_jewelry
CREATE POLICY "Users can view their own jewelry matches" ON public.matches_jewelry FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own jewelry matches" ON public.matches_jewelry FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own jewelry matches" ON public.matches_jewelry FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own jewelry matches" ON public.matches_jewelry FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for matches_gemstone
CREATE POLICY "Users can view their own gemstone matches" ON public.matches_gemstone FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own gemstone matches" ON public.matches_gemstone FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own gemstone matches" ON public.matches_gemstone FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own gemstone matches" ON public.matches_gemstone FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for ebay_aspects (public read, admin write)
CREATE POLICY "Everyone can view eBay aspects" ON public.ebay_aspects FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage eBay aspects" ON public.ebay_aspects FOR ALL USING (auth.uid() IS NOT NULL);

-- Create RLS policies for settings (admin only for now)
CREATE POLICY "Authenticated users can view settings" ON public.settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage settings" ON public.settings FOR ALL USING (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_matches_watch_task_id ON public.matches_watch(task_id);
CREATE INDEX idx_matches_watch_user_id ON public.matches_watch(user_id);
CREATE INDEX idx_matches_watch_ebay_listing_id ON public.matches_watch(ebay_listing_id);

CREATE INDEX idx_matches_jewelry_task_id ON public.matches_jewelry(task_id);
CREATE INDEX idx_matches_jewelry_user_id ON public.matches_jewelry(user_id);
CREATE INDEX idx_matches_jewelry_ebay_listing_id ON public.matches_jewelry(ebay_listing_id);

CREATE INDEX idx_matches_gemstone_task_id ON public.matches_gemstone(task_id);
CREATE INDEX idx_matches_gemstone_user_id ON public.matches_gemstone(user_id);
CREATE INDEX idx_matches_gemstone_ebay_listing_id ON public.matches_gemstone(ebay_listing_id);

CREATE INDEX idx_ebay_aspects_category_brand ON public.ebay_aspects(category_id, brand);
CREATE INDEX idx_settings_key ON public.settings(key);

-- Create triggers for updated_at
CREATE TRIGGER update_matches_watch_updated_at BEFORE UPDATE ON public.matches_watch FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_jewelry_updated_at BEFORE UPDATE ON public.matches_jewelry FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_gemstone_updated_at BEFORE UPDATE ON public.matches_gemstone FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings
INSERT INTO public.settings (key, value_json, description) VALUES
('precious_metal_api', '{"provider": "kitco", "api_key": "", "poll_interval": 300}', 'Precious metal spot price API configuration'),
('ebay_keys', '{"keys": [], "rotation_strategy": "round_robin"}', 'eBay API keys configuration'),
('llm_config', '{"provider": "openai", "model": "gpt-4o-mini", "temperature": 0.2, "max_tokens": 1000}', 'LLM configuration for processing'),
('task_templates', '{"enabled": true, "templates": ["gold_scanner", "watch_hunt"]}', 'Task template configuration');
