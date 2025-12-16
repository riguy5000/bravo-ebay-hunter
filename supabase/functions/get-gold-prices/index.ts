
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Swissquote API response structure
interface SwissquoteResponse {
  topo: {
    platform: string;
    server: string;
  };
  spreadProfilePrices: {
    spreadProfile: string;
    bid: number;
    ask: number;
    bidSpread: number;
    askSpread: number;
  }[];
  ts: number;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Troy ounce to grams conversion
const TROY_OZ_TO_GRAMS = 31.1035;

// Calculate per-gram prices for different karats
const calculateGramPrices = (pricePerOz: number) => {
  const pricePerGram24k = pricePerOz / TROY_OZ_TO_GRAMS;
  return {
    priceGram24k: Math.round(pricePerGram24k * 100) / 100,
    priceGram22k: Math.round(pricePerGram24k * (22/24) * 100) / 100,
    priceGram18k: Math.round(pricePerGram24k * (18/24) * 100) / 100,
    priceGram14k: Math.round(pricePerGram24k * (14/24) * 100) / 100,
    priceGram10k: Math.round(pricePerGram24k * (10/24) * 100) / 100,
  };
};

// Fallback data in case API fails (updated Dec 2025)
const getMockGoldPrices = () => {
  return [
    {
      metal: 'Gold',
      symbol: 'XAU',
      price: 4320.00,
      bid: 4318.00,
      ask: 4322.00,
      ...calculateGramPrices(4320.00),
      currency: 'USD',
      lastUpdated: new Date().toISOString()
    },
    {
      metal: 'Silver',
      symbol: 'XAG',
      price: 64.00,
      bid: 63.90,
      ask: 64.10,
      ...calculateGramPrices(64.00),
      currency: 'USD',
      lastUpdated: new Date().toISOString()
    },
    {
      metal: 'Platinum',
      symbol: 'XPT',
      price: 1850.00,
      bid: 1848.00,
      ask: 1852.00,
      ...calculateGramPrices(1850.00),
      currency: 'USD',
      lastUpdated: new Date().toISOString()
    },
    {
      metal: 'Palladium',
      symbol: 'XPD',
      price: 1610.00,
      bid: 1608.00,
      ask: 1612.00,
      ...calculateGramPrices(1610.00),
      currency: 'USD',
      lastUpdated: new Date().toISOString()
    }
  ];
};

const fetchMetalPrice = async (symbol: string, name: string) => {
  const url = `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${symbol}/USD`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${name} price: ${response.status}`);
  }

  const data: SwissquoteResponse[] = await response.json();

  if (!data || data.length === 0 || !data[0].spreadProfilePrices) {
    throw new Error(`Invalid response for ${name}`);
  }

  // Get the first spread profile (usually "standard" or best available)
  const priceData = data[0].spreadProfilePrices[0];
  const midPrice = (priceData.bid + priceData.ask) / 2;

  return {
    metal: name,
    symbol: symbol,
    price: Math.round(midPrice * 100) / 100,
    bid: priceData.bid,
    ask: priceData.ask,
    spread: priceData.bidSpread + priceData.askSpread,
    ...calculateGramPrices(midPrice),
    currency: 'USD',
    lastUpdated: new Date().toISOString()
  };
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
      change_amount: 0, // Swissquote doesn't provide change data
      change_percent: 0,
      high: price.ask,
      low: price.bid,
      price_gram_24k: price.priceGram24k,
      price_gram_18k: price.priceGram18k,
      price_gram_14k: price.priceGram14k,
      price_gram_10k: price.priceGram10k,
      source: 'swissquote'
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
    console.log('Fetching metal prices from Swissquote...');

    const metals = [
      { symbol: 'XAU', name: 'Gold' },
      { symbol: 'XAG', name: 'Silver' },
      { symbol: 'XPT', name: 'Platinum' },
      { symbol: 'XPD', name: 'Palladium' }
    ];

    const prices: any[] = [];
    const errors: string[] = [];

    // Fetch all metals in parallel
    const results = await Promise.allSettled(
      metals.map(metal => fetchMetalPrice(metal.symbol, metal.name))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        prices.push(result.value);
      } else {
        console.error(`Failed to fetch ${metals[index].name}:`, result.reason);
        errors.push(`${metals[index].name}: ${result.reason.message}`);
      }
    });

    if (prices.length === 0) {
      console.log('All API calls failed, using fallback data');
      return new Response(JSON.stringify({
        prices: getMockGoldPrices(),
        message: 'All API calls failed - using estimated prices',
        errors,
        apiStatus: 'fallback'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Store prices in database
    await storePricesInDatabase(prices);

    console.log(`Successfully fetched ${prices.length} metal prices from Swissquote`);

    return new Response(JSON.stringify({
      prices,
      message: `Real-time prices fetched from Swissquote (${prices.length} metals)`,
      errors: errors.length > 0 ? errors : undefined,
      apiStatus: 'healthy',
      source: 'swissquote'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

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
