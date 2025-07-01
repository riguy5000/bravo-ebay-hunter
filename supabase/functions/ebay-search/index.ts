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
  testKey?: string; // For testing specific keys
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

interface EbayApiKey {
  label: string;
  key: string;
  request_interval: number;
  last_used?: string;
  status?: string;
  success_rate?: number;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const getAvailableApiKeys = async (): Promise<EbayApiKey[]> => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value_json')
      .eq('key', 'ebay_keys')
      .single();

    if (error || !data) {
      console.log('No eBay keys configuration found, falling back to environment variable');
      const fallbackKey = Deno.env.get('EBAY_APP_ID');
      if (fallbackKey) {
        return [{
          label: 'Environment Key',
          key: fallbackKey,
          request_interval: 60,
          status: 'unknown'
        }];
      }
      return [];
    }

    const config = data.value_json as { keys: EbayApiKey[], rotation_strategy: string };
    return config.keys || [];
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return [];
  }
};

const selectApiKey = (keys: EbayApiKey[], strategy: string = 'round_robin'): EbayApiKey | null => {
  const availableKeys = keys.filter(key => 
    key.status !== 'rate_limited' && key.status !== 'error'
  );

  if (availableKeys.length === 0) {
    console.log('No available API keys, trying all keys as fallback');
    return keys.length > 0 ? keys[0] : null;
  }

  switch (strategy) {
    case 'least_used':
      return availableKeys.reduce((least, current) => {
        const leastUsed = new Date(least.last_used || '1970-01-01').getTime();
        const currentUsed = new Date(current.last_used || '1970-01-01').getTime();
        return currentUsed < leastUsed ? current : least;
      });
    
    case 'random':
      return availableKeys[Math.floor(Math.random() * availableKeys.length)];
    
    case 'round_robin':
    default:
      // Simple round robin based on current time
      const index = Math.floor(Date.now() / 60000) % availableKeys.length;
      return availableKeys[index];
  }
};

const updateKeyUsage = async (keyToUpdate: EbayApiKey, success: boolean, isRateLimited: boolean) => {
  try {
    const { data: settingsData, error: fetchError } = await supabase
      .from('settings')
      .select('value_json')
      .eq('key', 'ebay_keys')
      .single();

    if (fetchError || !settingsData) return;

    const config = settingsData.value_json as { keys: EbayApiKey[], rotation_strategy: string };
    const updatedKeys = config.keys.map(key => {
      if (key.key === keyToUpdate.key) {
        return {
          ...key,
          last_used: new Date().toISOString(),
          status: isRateLimited ? 'rate_limited' : (success ? 'active' : 'error'),
          success_rate: success ? Math.min(100, (key.success_rate || 0) + 5) : Math.max(0, (key.success_rate || 100) - 10)
        };
      }
      return key;
    });

    await supabase
      .from('settings')
      .upsert({
        key: 'ebay_keys',
        value_json: { ...config, keys: updatedKeys },
        updated_at: new Date().toISOString()
      });

    console.log(`Updated key "${keyToUpdate.label}" status:`, { success, isRateLimited });
  } catch (error) {
    console.error('Error updating key usage:', error);
  }
};

const buildEbaySearchUrl = (params: SearchRequest, appId: string): string => {
  const baseUrl = 'https://svcs.ebay.com/services/search/FindingService/v1';

  console.log('Using eBay App ID:', appId ? appId.substring(0, 10) + '...' : 'MISSING');

  const searchParams = new URLSearchParams({
    'OPERATION-NAME': 'findItemsByKeywords',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': '',
    'keywords': params.keywords,
    'paginationInput.entriesPerPage': '10',
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

const tryApiKeyRequest = async (apiKey: EbayApiKey, searchParams: SearchRequest): Promise<{ items: EbayItem[], success: boolean, rateLimited: boolean }> => {
  try {
    const searchUrl = buildEbaySearchUrl(searchParams, apiKey.key);
    console.log(`Trying API key "${apiKey.label}" for eBay search...`);

    await new Promise(resolve => setTimeout(resolve, Math.max(1000, apiKey.request_interval * 1000)));

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'eBaySearchBot/1.0',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      }
    });

    console.log(`eBay API response status for "${apiKey.label}":`, response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`eBay API error response for "${apiKey.label}":`, errorText);
      
      const isRateLimited = response.status === 500 && errorText.includes('exceeded the number of times');
      
      if (isRateLimited) {
        await updateKeyUsage(apiKey, false, true);
        return { items: [], success: false, rateLimited: true };
      }
      
      await updateKeyUsage(apiKey, false, false);
      throw new Error(`eBay API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const items = parseEbayResponse(data);
    
    await updateKeyUsage(apiKey, true, false);
    console.log(`Successfully used API key "${apiKey.label}" - found ${items.length} items`);
    
    return { items, success: true, rateLimited: false };
  } catch (error: any) {
    console.error(`Error with API key "${apiKey.label}":`, error);
    await updateKeyUsage(apiKey, false, false);
    throw error;
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const searchParams: SearchRequest = await req.json();
    console.log('eBay search request params:', searchParams);

    // If testing a specific key, use only that key
    if (searchParams.testKey) {
      console.log('Testing specific API key:', searchParams.testKey.substring(0, 10) + '...');
      const testKey: EbayApiKey = {
        label: 'Test Key',
        key: searchParams.testKey,
        request_interval: 3
      };
      
      const result = await tryApiKeyRequest(testKey, searchParams);
      
      return new Response(JSON.stringify({ 
        success: result.success, 
        items: result.items,
        rateLimited: result.rateLimited,
        totalResults: result.items.length,
        message: result.success ? `Test successful! Found ${result.items.length} items` : 'Test failed',
        keyUsed: 'Test Key'
      }), {
        status: result.success ? 200 : (result.rateLimited ? 429 : 500),
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get all available API keys
    const apiKeys = await getAvailableApiKeys();
    
    if (apiKeys.length === 0) {
      throw new Error('No eBay API keys configured. Please add API keys in Settings > eBay API Keys.');
    }

    console.log(`Found ${apiKeys.length} configured API keys`);

    // Get rotation strategy
    const { data: settingsData } = await supabase
      .from('settings')
      .select('value_json')
      .eq('key', 'ebay_keys')
      .single();
    
    const rotationStrategy = settingsData?.value_json?.rotation_strategy || 'round_robin';

    // Try API keys until one works
    let lastError: any = null;
    let rateLimitedCount = 0;

    for (let attempt = 0; attempt < apiKeys.length; attempt++) {
      const selectedKey = selectApiKey(apiKeys, rotationStrategy);
      
      if (!selectedKey) {
        throw new Error('No API keys available for use');
      }

      try {
        console.log(`Attempt ${attempt + 1}: Using API key "${selectedKey.label}"`);
        const result = await tryApiKeyRequest(selectedKey, searchParams);
        
        if (result.success) {
          return new Response(JSON.stringify({ 
            success: true, 
            items: result.items,
            totalResults: result.items.length,
            message: `Successfully found ${result.items.length} items`,
            keyUsed: selectedKey.label,
            apiStatus: 'healthy'
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        
        if (result.rateLimited) {
          rateLimitedCount++;
          console.log(`API key "${selectedKey.label}" is rate limited, trying next key...`);
          continue;
        }
        
      } catch (error: any) {
        console.error(`Failed with API key "${selectedKey.label}":`, error);
        lastError = error;
        
        // Remove this key from future attempts in this request
        const keyIndex = apiKeys.findIndex(k => k.key === selectedKey.key);
        if (keyIndex > -1) {
          apiKeys.splice(keyIndex, 1);
        }
      }
    }

    // All keys failed
    if (rateLimitedCount === apiKeys.length) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'All eBay API keys are currently rate limited. Please wait for rate limits to reset.',
        rateLimited: true,
        items: [],
        recommendation: 'Add more API keys in Settings > eBay API Keys to increase capacity.',
        debug: {
          timestamp: new Date().toISOString(),
          totalKeys: apiKeys.length,
          rateLimitedKeys: rateLimitedCount
        }
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    throw lastError || new Error('All API keys failed');

  } catch (error: any) {
    console.error('Error in eBay search function:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        items: [],
        recommendation: error.message.includes('No eBay API keys') ? 
          'Configure eBay API keys in Settings > eBay API Keys.' :
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
