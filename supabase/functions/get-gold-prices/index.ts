
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface GoldPriceResponse {
  metal: string;
  currency: string;
  exchange: string;
  symbol: string;
  prev_close_price: number;
  open_price: number;
  low_price: number;
  high_price: number;
  ch: number;
  chp: number;
  ask: number;
  bid: number;
  price: number;
  price_gram_24k: number;
  price_gram_22k: number;
  price_gram_21k: number;
  price_gram_20k: number;
  price_gram_18k: number;
  price_gram_16k: number;
  price_gram_14k: number;
  price_gram_10k: number;
}

const isDataStale = (lastUpdate: string): boolean => {
  const now = new Date();
  const lastUpdateTime = new Date(lastUpdate);
  const hoursSinceUpdate = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60 * 60);
  return hoursSinceUpdate >= 24;
};

const getCachedPrices = async () => {
  const { data, error } = await supabase
    .from('metal_prices')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching cached prices:', error);
    return null;
  }

  return data;
};

const savePricesToCache = async (prices: any[]) => {
  for (const price of prices) {
    const { error } = await supabase
      .from('metal_prices')
      .upsert({
        metal: price.metal,
        symbol: price.symbol,
        price: price.price,
        change_amount: price.change,
        change_percent: price.changePercent,
        high: price.high,
        low: price.low,
        price_gram_24k: price.priceGram24k,
        price_gram_18k: price.priceGram18k,
        price_gram_14k: price.priceGram14k,
        price_gram_10k: price.priceGram10k,
        currency: price.currency,
        source: 'goldapi',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'metal,symbol,currency'
      });

    if (error) {
      console.error('Error saving price to cache:', error);
    }
  }
};

const fetchFromAPI = async () => {
  const goldApiKey = Deno.env.get('GOLD_API_KEY');
  
  if (!goldApiKey) {
    throw new Error('GOLD_API_KEY not configured');
  }

  console.log('Fetching fresh data from Gold API...');
  
  const goldResponse = await fetch(`https://www.goldapi.io/api/XAU/USD`, {
    headers: {
      'x-access-token': goldApiKey,
    },
  });
  
  if (!goldResponse.ok) {
    if (goldResponse.status === 403) {
      throw new Error('API quota exceeded');
    }
    throw new Error(`API error: ${goldResponse.status}`);
  }
  
  const goldData: GoldPriceResponse = await goldResponse.json();
  
  const prices = [{
    metal: 'Gold',
    symbol: 'XAU',
    price: goldData.price,
    change: goldData.ch,
    changePercent: goldData.chp,
    high: goldData.high_price,
    low: goldData.low_price,
    priceGram24k: goldData.price_gram_24k,
    priceGram18k: goldData.price_gram_18k,
    priceGram14k: goldData.price_gram_14k,
    priceGram10k: goldData.price_gram_10k,
    currency: goldData.currency,
    lastUpdated: new Date().toISOString()
  }];

  // Try to fetch silver as well
  try {
    const silverResponse = await fetch(`https://www.goldapi.io/api/XAG/USD`, {
      headers: {
        'x-access-token': goldApiKey,
      },
    });
    
    if (silverResponse.ok) {
      const silverData: GoldPriceResponse = await silverResponse.json();
      prices.push({
        metal: 'Silver',
        symbol: 'XAG',
        price: silverData.price,
        change: silverData.ch,
        changePercent: silverData.chp,
        high: silverData.high_price,
        low: silverData.low_price,
        currency: silverData.currency,
        lastUpdated: new Date().toISOString()
      });
    }
  } catch (error) {
    console.log('Could not fetch silver price:', error);
  }

  return prices;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🥇 Checking cached metal prices...');
    
    // First, try to get cached prices
    const cachedPrices = await getCachedPrices();
    
    // Check if we have cached data and if it's still fresh (less than 24 hours old)
    if (cachedPrices && cachedPrices.length > 0) {
      const latestUpdate = cachedPrices[0].updated_at;
      
      if (!isDataStale(latestUpdate)) {
        console.log('✅ Using fresh cached data');
        
        // Transform cached data to match expected format
        const formattedPrices = cachedPrices.map(price => ({
          metal: price.metal,
          symbol: price.symbol,
          price: Number(price.price),
          change: Number(price.change_amount || 0),
          changePercent: Number(price.change_percent || 0),
          high: Number(price.high || 0),
          low: Number(price.low || 0),
          priceGram24k: price.price_gram_24k ? Number(price.price_gram_24k) : undefined,
          priceGram18k: price.price_gram_18k ? Number(price.price_gram_18k) : undefined,
          priceGram14k: price.price_gram_14k ? Number(price.price_gram_14k) : undefined,
          priceGram10k: price.price_gram_10k ? Number(price.price_gram_10k) : undefined,
          currency: price.currency,
          lastUpdated: price.updated_at
        }));

        return new Response(JSON.stringify({ 
          prices: formattedPrices,
          message: 'Real-time cached prices',
          apiStatus: 'cached',
          lastUpdate: latestUpdate
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
    }

    console.log('📊 Cache is stale or empty, fetching from API...');
    
    // Try to fetch fresh data from API
    try {
      const freshPrices = await fetchFromAPI();
      
      // Save to cache
      await savePricesToCache(freshPrices);
      
      console.log('✅ Fresh data fetched and cached successfully');
      
      return new Response(JSON.stringify({ 
        prices: freshPrices,
        message: 'Real-time prices updated successfully',
        apiStatus: 'fresh'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });

    } catch (apiError: any) {
      console.error('❌ API error:', apiError.message);
      
      // If API fails but we have stale cached data, use it
      if (cachedPrices && cachedPrices.length > 0) {
        console.log('🔄 Using stale cached data due to API error');
        
        const formattedPrices = cachedPrices.map(price => ({
          metal: price.metal,
          symbol: price.symbol,
          price: Number(price.price),
          change: Number(price.change_amount || 0),
          changePercent: Number(price.change_percent || 0),
          high: Number(price.high || 0),
          low: Number(price.low || 0),
          priceGram24k: price.price_gram_24k ? Number(price.price_gram_24k) : undefined,
          priceGram18k: price.price_gram_18k ? Number(price.price_gram_18k) : undefined,
          priceGram14k: price.price_gram_14k ? Number(price.price_gram_14k) : undefined,
          priceGram10k: price.price_gram_10k ? Number(price.price_gram_10k) : undefined,
          currency: price.currency,
          lastUpdated: price.updated_at
        }));

        return new Response(JSON.stringify({ 
          prices: formattedPrices,
          message: 'Using cached prices - API temporarily unavailable',
          apiStatus: 'stale-cache',
          lastUpdate: cachedPrices[0].updated_at
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
      
      throw apiError;
    }

  } catch (error: any) {
    console.error('💥 Error in get-gold-prices function:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Unable to fetch metal prices',
      message: error.message,
      apiStatus: 'error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
};

serve(handler);
