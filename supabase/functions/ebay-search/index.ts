
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
  
  const searchParams = new URLSearchParams({
    'OPERATION-NAME': 'findItemsByKeywords',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': appId || '',
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': '',
    'keywords': params.keywords,
    'paginationInput.entriesPerPage': '100',
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
    const searchResult = response.findItemsByKeywordsResponse?.[0];
    const searchItems = searchResult?.searchResult?.[0]?.item;
    
    if (!searchItems) return items;

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
  }
  
  return items;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const searchParams: SearchRequest = await req.json();
    console.log('Searching eBay with params:', searchParams);

    const searchUrl = buildEbaySearchUrl(searchParams);
    console.log('eBay API URL:', searchUrl);

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'eBaySearchBot/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`eBay API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('eBay API response received');

    const items = parseEbayResponse(data);
    console.log(`Parsed ${items.length} items from eBay`);

    return new Response(JSON.stringify({ 
      success: true, 
      items: items,
      totalResults: items.length 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in eBay search function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        items: []
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
