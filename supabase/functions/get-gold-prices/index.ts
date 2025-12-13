
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Enhanced mock data for fallback
const getMockGoldPrices = () => {
  return [
    {
      metal: 'Gold',
      symbol: 'XAU',
      price: 2650.00,
      change: 15.50,
      changePercent: 0.59,
      high: 2665.00,
      low: 2635.00,
      priceGram24k: 85.20,
      priceGram18k: 63.90,
      priceGram14k: 49.82,
      priceGram10k: 35.58,
      currency: 'USD',
      lastUpdated: new Date().toISOString()
    },
    {
      metal: 'Silver',
      symbol: 'XAG',
      price: 30.85,
      change: 0.25,
      changePercent: 0.82,
      high: 31.10,
      low: 30.45,
      currency: 'USD',
      lastUpdated: new Date().toISOString()
    },
    {
      metal: 'Platinum',
      symbol: 'XPT',
      price: 980.50,
      change: -5.25,
      changePercent: -0.53,
      high: 995.00,
      low: 975.00,
      currency: 'USD',
      lastUpdated: new Date().toISOString()
    },
    {
      metal: 'Palladium',
      symbol: 'XPD',
      price: 1025.75,
      change: 12.30,
      changePercent: 1.22,
      high: 1035.00,
      low: 1010.50,
      currency: 'USD',
      lastUpdated: new Date().toISOString()
    }
  ];
};

const fetchApiKey = async () => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value_json')
      .eq('key', 'precious_metal_api')
      .single();

    if (error || !data) {
      console.log('No precious metal API settings found');
      return null;
    }

    const settings = data.value_json as any;
    return settings?.api_key || null;
  } catch (error) {
    console.error('Error fetching API key from settings:', error);
    return null;
  }
};

const storePricesInDatabase = async (prices: any[]) => {
  try {
    // Clear existing prices
    await supabase.from('metal_prices').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert new prices
    const dbPrices = prices.map(price => ({
      metal: price.metal,
      symbol: price.symbol,
      price: price.price,
      currency: price.currency,
      change_amount: price.change,
      change_percent: price.changePercent,
      high: price.high,
      low: price.low,
      price_gram_24k: price.priceGram24k,
      price_gram_18k: price.priceGram18k,
      price_gram_14k: price.priceGram14k,
      price_gram_10k: price.priceGram10k,
      source: 'goldapi'
    }));

    const { error } = await supabase.from('metal_prices').insert(dbPrices);
    
    if (error) {
      console.error('Error storing prices in database:', error);
    } else {
      console.log('Successfully stored prices in database');
    }
  } catch (error) {
    console.error('Error in storePricesInDatabase:', error);
  }
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching gold prices...');
    
    // Get API key from database settings
    const goldApiKey = await fetchApiKey();
    
    if (!goldApiKey) {
      console.log('No API key configured, using mock data');
      return new Response(JSON.stringify({ 
        prices: getMockGoldPrices(),
        message: 'Using mock data - API key not configured in settings',
        apiStatus: 'no-key'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Validate API key format
    if (!goldApiKey.startsWith('goldapi-')) {
      console.log('Invalid API key format, using mock data');
      return new Response(JSON.stringify({ 
        prices: getMockGoldPrices(),
        message: 'Invalid API key format - should start with "goldapi-"',
        apiStatus: 'invalid-key'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    console.log('Using API key from settings:', goldApiKey.substring(0, 10) + '...');

    // Try to fetch gold price first (most important)
    try {
      const goldResponse = await fetch(`https://www.goldapi.io/api/XAU/USD`, {
        headers: {
          'x-access-token': goldApiKey,
          'Content-Type': 'application/json',
        },
      });
      
      if (goldResponse.status === 403) {
        const errorData = await goldResponse.json();
        if (errorData.error && errorData.error.includes('quota exceeded')) {
          console.log('Gold API quota exceeded, using mock data');
          return new Response(JSON.stringify({ 
            prices: getMockGoldPrices(),
            message: 'API quota exceeded - using estimated prices',
            quotaExceeded: true,
            apiStatus: 'quota-exceeded'
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }
      }

      if (!goldResponse.ok) {
        throw new Error(`Failed to fetch gold price: ${goldResponse.status} ${goldResponse.statusText}`);
      }
      
      const goldData: GoldPriceResponse = await goldResponse.json();
      console.log('Gold API response:', goldData);
      
      // Build prices array starting with gold
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

      // Try to fetch other metals if we have quota
      const metals = [
        { symbol: 'XAG', name: 'Silver' },
        { symbol: 'XPT', name: 'Platinum' },
        { symbol: 'XPD', name: 'Palladium' }
      ];

      for (const metal of metals) {
        try {
          const response = await fetch(`https://www.goldapi.io/api/${metal.symbol}/USD`, {
            headers: {
              'x-access-token': goldApiKey,
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data: GoldPriceResponse = await response.json();
            prices.push({
              metal: metal.name,
              symbol: metal.symbol,
              price: data.price,
              change: data.ch,
              changePercent: data.chp,
              high: data.high_price,
              low: data.low_price,
              priceGram24k: data.price_gram_24k || 0,
              priceGram18k: data.price_gram_18k || 0,
              priceGram14k: data.price_gram_14k || 0,
              priceGram10k: data.price_gram_10k || 0,
              currency: data.currency,
              lastUpdated: new Date().toISOString()
            });
          } else {
            console.log(`Could not fetch ${metal.name} price: ${response.status}`);
          }
        } catch (metalError) {
          console.log(`Error fetching ${metal.name} price:`, metalError);
        }
      }

      // Store prices in database
      await storePricesInDatabase(prices);

      console.log(`Successfully fetched ${prices.length} metal prices from API`);

      return new Response(JSON.stringify({ 
        prices,
        message: `Real-time ${prices.length === 1 ? 'gold' : 'metal'} prices fetched successfully`,
        apiStatus: 'healthy'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });

    } catch (apiError: any) {
      console.error('API error, falling back to mock data:', apiError.message);
      return new Response(JSON.stringify({ 
        prices: getMockGoldPrices(),
        message: `API error: ${apiError.message} - using estimated prices`,
        fallback: true,
        apiStatus: 'error'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

  } catch (error: any) {
    console.error('Error in get-gold-prices function:', error);
    
    // Always return mock data as fallback
    return new Response(JSON.stringify({ 
      prices: getMockGoldPrices(),
      message: 'Using fallback data due to technical issues',
      error: error.message,
      apiStatus: 'fallback'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
};

serve(handler);
