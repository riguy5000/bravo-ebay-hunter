
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  keywords: string;
  maxPrice?: number;
  minPrice?: number;
  categoryId?: string;
  condition?: string[];
  listingType?: string[];
  minFeedback?: number;
  sortOrder?: string;
}

interface EbayItem {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  endTime?: string;
  listingUrl: string;
  imageUrl?: string;
  condition?: string;
  sellerInfo?: {
    name: string;
    feedbackScore: number;
    feedbackPercent: number;
  };
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const buildEbaySearchUrl = (params: SearchRequest): string => {
  const baseUrl = 'https://svcs.ebay.com/services/search/FindingService/v1';
  const appId = Deno.env.get('EBAY_APP_ID');
  
  if (!appId) {
    throw new Error('EBAY_APP_ID environment variable is not set');
  }

  console.log('Using eBay App ID:', appId ? appId.substring(0, 10) + '...' : 'MISSING');

  const searchParams = new URLSearchParams({
    'OPERATION-NAME': 'findItemsByKeywords',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': '',
    'keywords': params.keywords,
    'paginationInput.entriesPerPage': '10', // Reduced to minimize API usage
    'sortOrder': params.sortOrder || 'PricePlusShipping'
  });

  // Add price filters
  let filterIndex = 0;
  if (params.maxPrice) {
    searchParams.set(`itemFilter(${filterIndex}).name`, 'MaxPrice');
    searchParams.set(`itemFilter(${filterIndex}).value`, params.maxPrice.toString());
    filterIndex++;
  }
  
  if (params.minPrice) {
    searchParams.set(`itemFilter(${filterIndex}).name`, 'MinPrice');
    searchParams.set(`itemFilter(${filterIndex}).value`, params.minPrice.toString());
    filterIndex++;
  }

  // Add listing type filter
  if (params.listingType && params.listingType.length > 0) {
    searchParams.set(`itemFilter(${filterIndex}).name`, 'ListingType');
    params.listingType.forEach((type, idx) => {
      searchParams.set(`itemFilter(${filterIndex}).value(${idx})`, type);
    });
    filterIndex++;
  }

  // Add condition filter
  if (params.condition && params.condition.length > 0) {
    searchParams.set(`itemFilter(${filterIndex}).name`, 'Condition');
    params.condition.forEach((cond, idx) => {
      searchParams.set(`itemFilter(${filterIndex}).value(${idx})`, cond);
    });
    filterIndex++;
  }

  // Add feedback score filter
  if (params.minFeedback) {
    searchParams.set(`itemFilter(${filterIndex}).name`, 'FeedbackScoreMin');
    searchParams.set(`itemFilter(${filterIndex}).value`, params.minFeedback.toString());
    filterIndex++;
  }

  return `${baseUrl}?${searchParams.toString()}`;
};

const parseEbayResponse = (response: any): EbayItem[] => {
  const items: EbayItem[] = [];
  
  try {
    console.log('Parsing eBay response...');
    
    const searchResult = response.findItemsByKeywordsResponse?.[0];
    if (!searchResult) {
      console.log('No findItemsByKeywordsResponse found in response');
      return items;
    }

    const ack = searchResult.ack?.[0];
    console.log('eBay API acknowledgment:', ack);

    if (ack === 'Failure') {
      const errors = searchResult.errorMessage?.[0]?.error;
      console.error('eBay API returned failure:', errors);
      throw new Error(`eBay API Error: ${JSON.stringify(errors)}`);
    }

    const searchItems = searchResult?.searchResult?.[0]?.item;
    
    if (!searchItems) {
      console.log('No search items found in response');
      return items;
    }

    console.log(`Found ${searchItems.length} items in eBay response`);

    for (const item of searchItems) {
      const priceInfo = item.sellingStatus?.[0]?.currentPrice?.[0];
      const price = parseFloat(priceInfo?.__value__ || '0');
      
      items.push({
        itemId: item.itemId?.[0] || '',
        title: item.title?.[0] || '',
        price: price,
        currency: priceInfo?.['@currencyId'] || 'USD',
        endTime: item.listingInfo?.[0]?.endTime?.[0],
        listingUrl: item.viewItemURL?.[0] || '',
        imageUrl: item.galleryURL?.[0],
        condition: item.condition?.[0]?.conditionDisplayName?.[0],
        sellerInfo: {
          name: item.sellerInfo?.[0]?.sellerUserName?.[0] || '',
          feedbackScore: parseInt(item.sellerInfo?.[0]?.feedbackScore?.[0] || '0'),
          feedbackPercent: parseFloat(item.sellerInfo?.[0]?.positiveFeedbackPercent?.[0] || '0')
        }
      });
    }
  } catch (error) {
    console.error('Error parsing eBay response:', error);
    throw error;
  }
  
  return items;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const searchParams: SearchRequest = await req.json();
    console.log('eBay search request params:', searchParams);

    // Validate required environment variables
    const appId = Deno.env.get('EBAY_APP_ID');
    if (!appId) {
      throw new Error('EBAY_APP_ID environment variable is not configured');
    }

    const searchUrl = buildEbaySearchUrl(searchParams);
    console.log('eBay API URL (truncated):', searchUrl.substring(0, 200) + '...');

    // Add longer delay to avoid rate limiting
    console.log('Waiting 3 seconds to avoid rate limiting...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'eBaySearchBot/1.0',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      }
    });

    console.log('eBay API response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('eBay API error response:', errorText);
      
      // Handle rate limiting specifically
      if (response.status === 500 && errorText.includes('exceeded the number of times')) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'eBay API rate limit exceeded. The system cleanup should resolve this in a few minutes.',
          rateLimited: true,
          items: [],
          recommendation: 'Please run the cron cleanup function to remove orphaned jobs causing excessive API calls.',
          debug: {
            timestamp: new Date().toISOString(),
            status: response.status,
            statusText: response.statusText
          }
        }), {
          status: 429, // Use proper rate limit status code
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      
      throw new Error(`eBay API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('eBay API response received, parsing items...');

    const items = parseEbayResponse(data);
    console.log(`Successfully parsed ${items.length} items from eBay`);

    return new Response(JSON.stringify({ 
      success: true, 
      items: items,
      totalResults: items.length,
      message: `Found ${items.length} items successfully`,
      apiStatus: 'healthy'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in eBay search function:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        items: [],
        recommendation: error.message.includes('rate limit') ? 
          'Run the cron cleanup function to remove orphaned jobs causing excessive API calls.' :
          'Check eBay API configuration and network connectivity.',
        debug: {
          timestamp: new Date().toISOString(),
          errorType: error.constructor.name,
          stack: error.stack
        }
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
