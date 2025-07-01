
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

// Mock data for when API is unavailable
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
    }
  ];
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const goldApiKey = Deno.env.get('GOLD_API_KEY');
    
    if (!goldApiKey) {
      console.log('GOLD_API_KEY not configured, using mock data');
      return new Response(JSON.stringify({ 
        prices: getMockGoldPrices(),
        message: 'Using mock data - API key not configured' 
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    console.log('Fetching gold prices from API...');

    // Try to fetch gold price first (most important)
    try {
      const goldResponse = await fetch(`https://www.goldapi.io/api/XAU/USD`, {
        headers: {
          'x-access-token': goldApiKey,
        },
      });
      
      if (goldResponse.status === 403) {
        const errorData = await goldResponse.json();
        if (errorData.error && errorData.error.includes('quota exceeded')) {
          console.log('Gold API quota exceeded, using mock data');
          return new Response(JSON.stringify({ 
            prices: getMockGoldPrices(),
            message: 'API quota exceeded - using estimated prices. Please upgrade your Gold API plan for real-time data.',
            quotaExceeded: true
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
        throw new Error(`Failed to fetch gold price: ${goldResponse.status}`);
      }
      
      const goldData: GoldPriceResponse = await goldResponse.json();
      
      // Return just gold data if successful
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

      console.log('Successfully fetched gold prices from API');

      return new Response(JSON.stringify({ 
        prices,
        message: 'Real-time gold prices fetched successfully'
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
        message: 'API temporarily unavailable - using estimated prices',
        fallback: true
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
      error: error.message
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
