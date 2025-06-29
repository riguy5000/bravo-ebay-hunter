
-- Create enum types for better data integrity
CREATE TYPE item_type AS ENUM ('watch', 'jewelry', 'gemstone');
CREATE TYPE task_status AS ENUM ('active', 'paused', 'stopped');
CREATE TYPE match_status AS ENUM ('new', 'reviewed', 'offered', 'purchased', 'passed');
CREATE TYPE purchase_status AS ENUM ('pending', 'completed', 'cancelled', 'returned');
CREATE TYPE return_status AS ENUM ('initiated', 'shipped', 'received', 'refunded', 'denied');
CREATE TYPE resale_status AS ENUM ('pending', 'listed', 'sold', 'cancelled');

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  item_type item_type NOT NULL,
  status task_status NOT NULL DEFAULT 'active',
  
  -- Price rules
  max_price DECIMAL(10,2),
  price_percentage DECIMAL(5,2),
  
  -- eBay filters
  listing_format TEXT[], -- 'auction', 'buy_it_now', 'best_offer'
  min_seller_feedback INTEGER DEFAULT 0,
  
  -- Poll settings
  poll_interval INTEGER DEFAULT 300, -- seconds
  
  -- Item-specific filters (JSON for flexibility)
  watch_filters JSONB,
  jewelry_filters JSONB,
  gemstone_filters JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create matches table
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  
  -- eBay listing data
  ebay_item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  seller_name TEXT,
  seller_feedback INTEGER,
  listing_url TEXT,
  image_url TEXT,
  end_time TIMESTAMP WITH TIME ZONE,
  
  -- Match data
  status match_status NOT NULL DEFAULT 'new',
  offer_amount DECIMAL(10,2),
  notes TEXT,
  
  -- AI analysis
  ai_score DECIMAL(3,2), -- 0.00 to 1.00
  ai_reasoning TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchases table
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  
  purchase_price DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  fees DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2) NOT NULL,
  
  status purchase_status NOT NULL DEFAULT 'pending',
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  tracking_number TEXT,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create returns table
CREATE TABLE public.returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  
  reason TEXT NOT NULL,
  status return_status NOT NULL DEFAULT 'initiated',
  
  return_cost DECIMAL(10,2) DEFAULT 0,
  refund_amount DECIMAL(10,2),
  
  initiated_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_date TIMESTAMP WITH TIME ZONE,
  
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create resales table
CREATE TABLE public.resales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  
  platform TEXT NOT NULL, -- 'ebay', 'mercari', 'facebook', etc.
  listing_title TEXT,
  listing_price DECIMAL(10,2) NOT NULL,
  sale_price DECIMAL(10,2),
  
  status resale_status NOT NULL DEFAULT 'pending',
  
  listed_date TIMESTAMP WITH TIME ZONE,
  sold_date TIMESTAMP WITH TIME ZONE,
  
  profit DECIMAL(10,2),
  roi_percentage DECIMAL(5,2),
  
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user settings table
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  
  -- API configurations
  ebay_api_version TEXT DEFAULT 'v1',
  gold_api_version TEXT DEFAULT 'v1',
  openai_model TEXT DEFAULT 'gpt-4',
  
  -- Default settings
  default_poll_interval INTEGER DEFAULT 300,
  default_max_price DECIMAL(10,2) DEFAULT 1000,
  
  -- Notification preferences
  email_notifications BOOLEAN DEFAULT true,
  match_notifications BOOLEAN DEFAULT true,
  
  -- Theme
  theme TEXT DEFAULT 'light',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tasks
CREATE POLICY "Users can view their own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for matches
CREATE POLICY "Users can view their own matches" ON public.matches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own matches" ON public.matches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own matches" ON public.matches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own matches" ON public.matches FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for purchases
CREATE POLICY "Users can view their own purchases" ON public.purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own purchases" ON public.purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own purchases" ON public.purchases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own purchases" ON public.purchases FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for returns
CREATE POLICY "Users can view their own returns" ON public.returns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own returns" ON public.returns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own returns" ON public.returns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own returns" ON public.returns FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for resales
CREATE POLICY "Users can view their own resales" ON public.resales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own resales" ON public.resales FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own resales" ON public.resales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own resales" ON public.resales FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for user_settings
CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own settings" ON public.user_settings FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_matches_task_id ON public.matches(task_id);
CREATE INDEX idx_matches_user_id ON public.matches(user_id);
CREATE INDEX idx_matches_status ON public.matches(status);
CREATE INDEX idx_purchases_match_id ON public.purchases(match_id);
CREATE INDEX idx_purchases_user_id ON public.purchases(user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_returns_updated_at BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_resales_updated_at BEFORE UPDATE ON public.resales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
