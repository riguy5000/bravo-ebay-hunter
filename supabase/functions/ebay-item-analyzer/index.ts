
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  title: string;
  description?: string;
  price: number;
  currency?: string;
  sellerInfo?: {
    feedbackScore: number;
    feedbackPercentage: number;
  };
  itemType: 'jewelry' | 'watch' | 'gemstone';
}

interface JewelryAnalysis {
  metalWeight?: number;
  metalType?: string;
  metalPurity?: string;
  karat?: number;
  mainStone?: string;
  qualityScore: number; // 0-100
  dealScore: number; // 0-100
  riskFlags: string[];
  extractedData: {
    weight_g?: number;
    metal_type?: string;
    spot_price_oz?: number;
    melt_value?: number;
    profit_scrap?: number;
  };
  reasoning: string;
}

interface WatchAnalysis {
  brand?: string;
  model?: string;
  caseMaterial?: string;
  movement?: string;
  condition?: string;
  qualityScore: number;
  dealScore: number;
  riskFlags: string[];
  marketValue?: number;
  reasoning: string;
}

interface GemstoneAnalysis {
  stoneType?: string;
  carat?: number;
  color?: string;
  clarity?: string;
  cut?: string;
  qualityScore: number;
  dealScore: number;
  riskFlags: string[];
  marketValue?: number;
  reasoning: string;
}

const analyzeJewelryListing = async (openAIKey: string, data: AnalysisRequest): Promise<JewelryAnalysis> => {
  const prompt = `Analyze this jewelry eBay listing and extract structured data:

Title: ${data.title}
Description: ${data.description || 'N/A'}
Listed Price: $${data.price}
Seller Feedback: ${data.sellerInfo?.feedbackScore || 0} (${data.sellerInfo?.feedbackPercentage || 0}%)

Extract and analyze:
1. Metal weight in grams (look for patterns like "5.2g", "5.2 grams", "weighs 5.2g")
2. Metal type (gold, silver, platinum, etc.)
3. Metal purity (14k, 18k, sterling, 925, etc.)
4. Main stone/gem if present
5. Overall condition assessment
6. Quality score (0-100) based on listing quality, photos, description detail
7. Deal score (0-100) based on price vs typical market value
8. Risk flags (replica, damaged, misleading, poor seller, etc.)

Respond with JSON only:`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert jewelry appraiser and eBay listing analyzer. Extract structured data from jewelry listings and assess their quality and value. Respond only with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const result = await response.json();
  const analysis = JSON.parse(result.choices[0].message.content);

  // Calculate melt value if we have weight and metal data
  if (analysis.metalWeight && analysis.metalType?.toLowerCase().includes('gold') && analysis.karat) {
    // This would typically call a gold price API, for now using placeholder
    const goldPricePerOz = 2000; // USD per troy ounce
    const goldPricePerGram = goldPricePerOz / 31.1035;
    const purity = analysis.karat / 24;
    analysis.extractedData = {
      ...analysis.extractedData,
      weight_g: analysis.metalWeight,
      metal_type: analysis.metalType,
      spot_price_oz: goldPricePerOz,
      melt_value: analysis.metalWeight * goldPricePerGram * purity,
      profit_scrap: (analysis.metalWeight * goldPricePerGram * purity * 0.9) - data.price // 90% of melt value minus purchase price
    };
  }

  return analysis;
};

const analyzeWatchListing = async (openAIKey: string, data: AnalysisRequest): Promise<WatchAnalysis> => {
  const prompt = `Analyze this watch eBay listing:

Title: ${data.title}
Description: ${data.description || 'N/A'}
Listed Price: $${data.price}
Seller Feedback: ${data.sellerInfo?.feedbackScore || 0} (${data.sellerInfo?.feedbackPercentage || 0}%)

Extract:
1. Brand and model
2. Case material
3. Movement type
4. Condition
5. Quality score (0-100)
6. Deal score (0-100)
7. Risk flags
8. Estimated market value

Respond with JSON only.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert watch appraiser. Analyze watch listings and provide structured assessments. Respond only with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
    }),
  });

  const result = await response.json();
  return JSON.parse(result.choices[0].message.content);
};

const analyzeGemstoneListing = async (openAIKey: string, data: AnalysisRequest): Promise<GemstoneAnalysis> => {
  const prompt = `Analyze this gemstone eBay listing:

Title: ${data.title}
Description: ${data.description || 'N/A'}
Listed Price: $${data.price}
Seller Feedback: ${data.sellerInfo?.feedbackScore || 0} (${data.sellerInfo?.feedbackPercentage || 0}%)

Extract:
1. Stone type
2. Carat weight
3. Color
4. Clarity
5. Cut quality
6. Quality score (0-100)
7. Deal score (0-100)
8. Risk flags
9. Estimated market value

Respond with JSON only.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert gemologist. Analyze gemstone listings and provide structured assessments. Respond only with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
    }),
  });

  const result = await response.json();
  return JSON.parse(result.choices[0].message.content);
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const data: AnalysisRequest = await req.json();
    console.log(`Analyzing ${data.itemType} listing: ${data.title}`);

    let analysis;
    switch (data.itemType) {
      case 'jewelry':
        analysis = await analyzeJewelryListing(openAIKey, data);
        break;
      case 'watch':
        analysis = await analyzeWatchListing(openAIKey, data);
        break;
      case 'gemstone':
        analysis = await analyzeGemstoneListing(openAIKey, data);
        break;
      default:
        throw new Error(`Unsupported item type: ${data.itemType}`);
    }

    console.log(`Analysis complete. Quality: ${analysis.qualityScore}, Deal: ${analysis.dealScore}`);

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in ebay-item-analyzer:', error);
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
