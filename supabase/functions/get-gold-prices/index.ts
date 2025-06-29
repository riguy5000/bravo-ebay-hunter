
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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const goldApiKey = Deno.env.get('GOLD_API_KEY');
    
    if (!goldApiKey) {
      throw new Error('GOLD_API_KEY not configured');
    }

    console.log('Fetching gold prices from API...');

    // Fetch current gold, silver, platinum, and palladium prices
    const metals = ['XAU', 'XAG', 'XPT', 'XPD']; // Gold, Silver, Platinum, Palladium
    const promises = metals.map(async (metal) => {
      const response = await fetch(`https://www.goldapi.io/api/${metal}/USD`, {
        headers: {
          'x-access-token': goldApiKey,
        },
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch ${metal} price:`, response.status, await response.text());
        throw new Error(`Failed to fetch ${metal} price: ${response.status}`);
      }
      
      const data: GoldPriceResponse = await response.json();
      return {
        metal: metal === 'XAU' ? 'Gold' : metal === 'XAG' ? 'Silver' : metal === 'XPT' ? 'Platinum' : 'Palladium',
        symbol: metal,
        price: data.price,
        change: data.ch,
        changePercent: data.chp,
        high: data.high_price,
        low: data.low_price,
        priceGram24k: data.price_gram_24k,
        priceGram18k: data.price_gram_18k,
        priceGram14k: data.price_gram_14k,
        priceGram10k: data.price_gram_10k,
        currency: data.currency,
        lastUpdated: new Date().toISOString()
      };
    });

    const prices = await Promise.all(promises);
    
    console.log('Successfully fetched gold prices:', prices.length, 'metals');

    return new Response(JSON.stringify({ prices }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('Error in get-gold-prices function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
