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
  itemType?: 'watch' | 'jewelry' | 'gemstone';
  typeSpecificFilters?: any;
  testKey?: {
    app_id: string;
    dev_id: string;
    cert_id: string;
  };
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
  listingType?: string;
  sellerInfo?: {
    name: string;
    feedbackScore: number;
    feedbackPercent: number;
  };
}

interface EbayApiKey {
  label: string;
  app_id: string;
  dev_id: string;
  cert_id: string;
  last_used?: string;
  status?: string;
  success_rate?: number;
  oauth_token?: string;
  token_expires_at?: string;
}

interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const getOAuthToken = async (appId: string, certId: string): Promise<string> => {
  console.log(`Getting OAuth token for app ID: ${appId.substring(0, 10)}...`);
  
  const credentials = btoa(`${appId}:${certId}`);
  
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OAuth token request failed: ${response.status} ${response.statusText} - ${errorText}`);
    throw new Error(`OAuth authentication failed: ${response.status} ${response.statusText}`);
  }

  const tokenData: OAuthTokenResponse = await response.json();
  console.log('OAuth token obtained successfully');
  
  return tokenData.access_token;
};

const getAvailableApiKeys = async (): Promise<EbayApiKey[]> => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value_json')
      .eq('key', 'ebay_keys')
      .single();

    if (error || !data) {
      console.log('No eBay keys configuration found, falling back to environment variables');
      const fallbackAppId = Deno.env.get('EBAY_APP_ID');
      const fallbackDevId = Deno.env.get('EBAY_DEV_ID');
      const fallbackCertId = Deno.env.get('EBAY_CERT_ID');
      
      if (fallbackAppId && fallbackDevId && fallbackCertId) {
        return [{
          label: 'Environment Keys',
          app_id: fallbackAppId,
          dev_id: fallbackDevId,
          cert_id: fallbackCertId,
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
      const index = Math.floor(Date.now() / 60000) % availableKeys.length;
      return availableKeys[index];
  }
};

const updateKeyUsage = async (keyToUpdate: EbayApiKey, success: boolean, isRateLimited: boolean, isAuthError: boolean = false) => {
  try {
    const { data: settingsData, error: fetchError } = await supabase
      .from('settings')
      .select('value_json')
      .eq('key', 'ebay_keys')
      .single();

    if (fetchError || !settingsData) return;

    const config = settingsData.value_json as { keys: EbayApiKey[], rotation_strategy: string };
    const updatedKeys = config.keys.map(key => {
      if (key.app_id === keyToUpdate.app_id) {
        let newStatus = 'active';
        if (isRateLimited) newStatus = 'rate_limited';
        else if (isAuthError) newStatus = 'auth_error';
        else if (!success) newStatus = 'error';

        return {
          ...key,
          last_used: new Date().toISOString(),
          status: newStatus,
          success_rate: success ? Math.min(100, (key.success_rate || 0) + 5) : Math.max(0, (key.success_rate || 100) - 10),
          oauth_token: keyToUpdate.oauth_token,
          token_expires_at: keyToUpdate.token_expires_at
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

    console.log(`Updated key "${keyToUpdate.label}" status:`, { success, isRateLimited, isAuthError });
  } catch (error) {
    console.error('Error updating key usage:', error);
  }
};

const buildEbayBrowseUrl = (params: SearchRequest): string => {
  const baseUrl = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
  const searchParams = new URLSearchParams({
    q: params.keywords,
    limit: '200'
  });

  let filters: string[] = [];

  // Add price filters
  if (params.maxPrice && params.minPrice) {
    filters.push(`price:[${params.minPrice}..${params.maxPrice}],priceCurrency:USD`);
  } else if (params.maxPrice) {
    filters.push(`price:[..${params.maxPrice}],priceCurrency:USD`);
  } else if (params.minPrice) {
    filters.push(`price:[${params.minPrice}..],priceCurrency:USD`);
  }

  // Add date filtering for continuous monitoring
  if (params.dateFrom) {
    const fromDate = new Date(params.dateFrom).toISOString().split('T')[0];
    filters.push(`itemStartTime:[${fromDate}T00:00:00.000Z..]`);
  }

  // UPDATED: Use specific leaf category IDs instead of broad category mapping
  if (params.itemType === 'jewelry' && params.typeSpecificFilters?.leafCategoryId) {
    // Use the specific leaf category ID from the jewelry filter selection
    filters.push(`categoryIds:${params.typeSpecificFilters.leafCategoryId}`);
    console.log(`🎯 Using specific jewelry leaf category: ${params.typeSpecificFilters.leafCategoryId}`);
  } else if (params.itemType) {
    // Fallback to broad categories for non-jewelry or when no specific category is selected
    const categoryMapping = {
      'jewelry': '281',
      'watch': '14324', 
      'gemstone': '164694'
    };
    const categoryId = categoryMapping[params.itemType];
    if (categoryId) {
      filters.push(`categoryIds:${categoryId}`);
    }
  }

  // Handle condition filters - FIXED to use aspect-based filtering for jewelry/watch/gemstone
  const useAspectConditions = params.itemType && ['jewelry', 'watch', 'gemstone'].includes(params.itemType);
  
  if (params.condition && params.condition.length > 0) {
    console.log('🔧 Processing condition filters:', params.condition);
    console.log('🎯 Item type:', params.itemType, 'Use aspect conditions:', useAspectConditions);
    
    if (!useAspectConditions) {
      // For other categories - use global condition filtering
      console.log('🌐 Using global condition filtering');
      const conditionMapping: { [key: string]: string } = {
        'New': 'NEW',
        'Pre-owned': 'USED_EXCELLENT|USED_VERY_GOOD|USED_GOOD|USED_ACCEPTABLE',
        'For parts or not working': 'FOR_PARTS_OR_NOT_WORKING',
        // Add lowercase variants for backward compatibility
        'new': 'NEW',
        'pre-owned': 'USED_EXCELLENT|USED_VERY_GOOD|USED_GOOD|USED_ACCEPTABLE',
        'for parts or not working': 'FOR_PARTS_OR_NOT_WORKING'
      };
      
      const mappedConditions = params.condition
        .map(c => {
          const mapped = conditionMapping[c];
          if (!mapped) {
            console.warn(`⚠️ Unknown condition: ${c}`);
            return null;
          }
          console.log(`✅ Mapped condition "${c}" -> "${mapped}"`);
          return mapped;
        })
        .filter(Boolean)
        .join('|');
      
      if (mappedConditions) {
        filters.push(`conditions:{${mappedConditions}}`);
        console.log(`🎯 Applied global condition filter: conditions:{${mappedConditions}}`);
      }
    }
    // Note: Aspect-based conditions will be handled in buildAspectFilters
  }

  // Add listing type/format filters
  if (params.listingType && params.listingType.length > 0) {
    const listingTypeMapping: { [key: string]: string } = {
      'Fixed Price (BIN)': 'FIXED_PRICE',
      'Best Offer': 'FIXED_PRICE',
      'Auction': 'AUCTION',
      'Classified Ad': 'CLASSIFIED_AD',
      'Accepts Offers': 'FIXED_PRICE'
    };

    const mappedTypes = params.listingType
      .map(type => listingTypeMapping[type])
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index);

    if (mappedTypes.length > 0) {
      filters.push(`buyingOptions:{${mappedTypes.join('|')}}`);
    }

    const needsOfferFilter = params.listingType.some(type => 
      type === 'Best Offer' || type === 'Accepts Offers'
    );
    
    if (needsOfferFilter) {
      filters.push('itemLocationCountry:US');
    }
  }

  // Add type-specific aspect filters (including conditions for jewelry/watch/gemstone)
  if (params.typeSpecificFilters && params.itemType) {
    const aspectFilters = buildAspectFilters(params.itemType, params.typeSpecificFilters, params.condition);
    if (aspectFilters.length > 0) {
      filters.push(...aspectFilters);
    }
  }

  // Combine all filters
  if (filters.length > 0) {
    searchParams.set('filter', filters.join(','));
  }

  searchParams.set('sort', 'newlyListed');

  const finalUrl = `${baseUrl}?${searchParams.toString()}`;
  console.log('🔍 eBay Search URL:', finalUrl);
  console.log('🎯 Applied filters:', filters);
  
  return finalUrl;
};

const buildAspectFilters = (itemType: string, filters: any, conditions?: string[]): string[] => {
  const aspectFilters: string[] = [];
  
  console.log(`🔧 Building aspect filters for ${itemType}:`, JSON.stringify(filters, null, 2));
  console.log(`🎭 Processing conditions for ${itemType}:`, conditions);

  // FIXED: Add condition filters using aspect-based filtering for jewelry, watches, and gemstones
  if (conditions && conditions.length > 0 && ['jewelry', 'watch', 'gemstone'].includes(itemType)) {
    console.log(`🎯 Adding aspect-based condition filters for ${itemType}`);
    
    // Map UI condition values to eBay aspect values
    const conditionMapping: { [key: string]: string } = {
      'New': 'New',
      'Pre-owned': 'Pre-owned', 
      'For parts or not working': 'For parts or not working',
      // Handle variations
      'new': 'New',
      'pre-owned': 'Pre-owned',
      'for parts or not working': 'For parts or not working'
    };
    
    const conditionValues = conditions
      .map((condition: string) => {
        const mappedCondition = conditionMapping[condition] || condition;
        console.log(`🔄 Processing condition: "${condition}" -> "${mappedCondition}"`);
        return encodeURIComponent(mappedCondition);
      })
      .join('|');
    
    if (conditionValues) {
      aspectFilters.push(`aspects:Condition:${conditionValues}`);
      console.log(`✅ Added aspect condition filter: aspects:Condition:${conditionValues}`);
    }
  }

  switch (itemType) {
    case 'jewelry':
      if (filters.metal && filters.metal.length > 0) {
        const metalValues = filters.metal
          .map((m: string) => encodeURIComponent(m))
          .join('|');
        aspectFilters.push(`aspects:Metal:${metalValues}`);
        console.log(`✅ Added metal filter: aspects:Metal:${metalValues}`);
      }

      if (filters.main_stones && filters.main_stones.length > 0) {
        const stoneValues = filters.main_stones
          .map((stone: string) => {
            if (stone === 'No Stone') {
              return 'No%20Main%20Stone';
            }
            return encodeURIComponent(stone);
          })
          .join('|');
        aspectFilters.push(`aspects:Main%20Stone:${stoneValues}`);
        console.log(`✅ Added main stone filter: aspects:Main%20Stone:${stoneValues}`);
      }

      if (filters.brands && filters.brands.length > 0) {
        const brandValues = filters.brands
          .map((b: string) => encodeURIComponent(b))
          .join('|');
        aspectFilters.push(`aspects:Brand:${brandValues}`);
        console.log(`✅ Added brand filter: aspects:Brand:${brandValues}`);
      }

      // NEW: Add support for additional jewelry-specific aspects
      if (filters.metal_purity && filters.metal_purity.length > 0) {
        const purityValues = filters.metal_purity
          .map((p: string) => encodeURIComponent(p))
          .join('|');
        aspectFilters.push(`aspects:Metal%20Purity:${purityValues}`);
        console.log(`✅ Added metal purity filter: aspects:Metal%20Purity:${purityValues}`);
      }

      if (filters.setting_style && filters.setting_style.length > 0) {
        const styleValues = filters.setting_style
          .map((s: string) => encodeURIComponent(s))
          .join('|');
        aspectFilters.push(`aspects:Setting%20Style:${styleValues}`);
        console.log(`✅ Added setting style filter: aspects:Setting%20Style:${styleValues}`);
      }

      break;

    case 'watch':
      if (filters.brands && filters.brands.length > 0) {
        const brandValues = filters.brands
          .map((b: string) => encodeURIComponent(b))
          .join('|');
        aspectFilters.push(`aspects:Brand:${brandValues}`);
        console.log(`✅ Added watch brand filter: aspects:Brand:${brandValues}`);
      }

      if (filters.movement && filters.movement.length > 0) {
        const movementValues = filters.movement
          .map((m: string) => encodeURIComponent(m))
          .join('|');
        aspectFilters.push(`aspects:Movement:${movementValues}`);
        console.log(`✅ Added movement filter: aspects:Movement:${movementValues}`);
      }

      if (filters.case_material && filters.case_material.length > 0) {
        const materialValues = filters.case_material
          .map((m: string) => encodeURIComponent(m))
          .join('|');
        aspectFilters.push(`aspects:Case%20Material:${materialValues}`);
        console.log(`✅ Added case material filter: aspects:Case%20Material:${materialValues}`);
      }
      break;

    case 'gemstone':
      if (filters.stone_types && filters.stone_types.length > 0) {
        const stoneValues = filters.stone_types
          .map((s: string) => encodeURIComponent(s))
          .join('|');
        aspectFilters.push(`aspects:Stone%20Type:${stoneValues}`);
        console.log(`✅ Added stone type filter: aspects:Stone%20Type:${stoneValues}`);
      }

      if (filters.cuts && filters.cuts.length > 0) {
        const cutValues = filters.cuts
          .map((c: string) => encodeURIComponent(c))
          .join('|');
        aspectFilters.push(`aspects:Cut:${cutValues}`);
        console.log(`✅ Added cut filter: aspects:Cut:${cutValues}`);
      }
      break;
  }

  console.log(`✨ Generated ${aspectFilters.length} aspect filters for ${itemType}:`, aspectFilters);
  return aspectFilters;
};

const parseEbayBrowseResponse = (response: any, allowedCategoryIds?: string[]): EbayItem[] => {
  const items: EbayItem[] = [];
  
  try {
    console.log('📊 Parsing eBay Browse API response...');
    
    if (!response.itemSummaries) {
      console.log('📭 No itemSummaries found in response');
      return items;
    }

    console.log(`📦 Found ${response.itemSummaries.length} items in eBay response`);

    for (const item of response.itemSummaries) {
      // NEW: Prevent "random tools" bleed-through by checking category IDs
      if (allowedCategoryIds && allowedCategoryIds.length > 0) {
        const itemCategoryId = item.categoryId || item.primaryCategory?.categoryId;
        if (itemCategoryId && !allowedCategoryIds.includes(itemCategoryId)) {
          console.log(`🚫 Skipping item from unwanted category: ${itemCategoryId} - ${item.title}`);
          continue;
        }
      }

      const price = item.price?.value ? parseFloat(item.price.value) : 0;
      
      let listingFormat = 'Unknown';
      if (item.buyingOptions) {
        if (item.buyingOptions.includes('FIXED_PRICE')) {
          listingFormat = 'Fixed Price';
          if (item.buyingOptions.includes('BEST_OFFER') || item.itemAffiliateWebUrl?.includes('bo=true')) {
            listingFormat = 'Best Offer';
          }
        } else if (item.buyingOptions.includes('AUCTION')) {
          listingFormat = 'Auction';
        } else if (item.buyingOptions.includes('CLASSIFIED_AD')) {
          listingFormat = 'Classified Ad';
        }
      }
      
      items.push({
        itemId: item.itemId || '',
        title: item.title || '',
        price: price,
        currency: item.price?.currency || 'USD',
        endTime: item.itemEndDate,
        listingUrl: item.itemWebUrl || '',
        imageUrl: item.image?.imageUrl,
        condition: item.condition,
        listingType: listingFormat,
        sellerInfo: {
          name: item.seller?.username || '',
          feedbackScore: item.seller?.feedbackScore || 0,
          feedbackPercent: item.seller?.feedbackPercentage || 0
        }
      });
    }

    console.log(`✅ Parsed ${items.length} items successfully`);
  } catch (error) {
    console.error('❌ Error parsing eBay Browse response:', error);
    throw error;
  }
  
  return items;
};

const tryApiKeyRequest = async (apiKey: EbayApiKey, searchParams: SearchRequest): Promise<{ items: EbayItem[], success: boolean, rateLimited: boolean, authError: boolean, errorType?: string }> => {
  try {
    console.log(`Trying API key "${apiKey.label}" for eBay search...`);

    // Get OAuth token
    let accessToken: string;
    try {
      accessToken = await getOAuthToken(apiKey.app_id, apiKey.cert_id);
    } catch (error: any) {
      console.error(`OAuth failed for "${apiKey.label}":`, error.message);
      await updateKeyUsage(apiKey, false, false, true);
      return { items: [], success: false, rateLimited: false, authError: true, errorType: 'oauth_error' };
    }

    const searchUrl = buildEbayBrowseUrl(searchParams);
    console.log(`Making Browse API request for "${apiKey.label}"`);

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      }
    });

    console.log(`eBay Browse API response status for "${apiKey.label}":`, response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`eBay Browse API error response for "${apiKey.label}":`, errorText);
      
      // Check for rate limiting (HTTP 429 or specific error codes)
      const isRateLimited = response.status === 429 || 
        errorText.includes('rate limit') ||
        errorText.includes('quota exceeded');
      
      // Check for authentication errors
      const isAuthError = response.status === 401 || response.status === 403 ||
        errorText.includes('Invalid access token') ||
        errorText.includes('token expired');
      
      if (isRateLimited) {
        await updateKeyUsage(apiKey, false, true, false);
        console.log(`API key "${apiKey.label}" hit eBay rate limit`);
        return { items: [], success: false, rateLimited: true, authError: false, errorType: 'rate_limit' };
      }
      
      if (isAuthError) {
        await updateKeyUsage(apiKey, false, false, true);
        console.log(`API key "${apiKey.label}" has authentication issues`);
        return { items: [], success: false, rateLimited: false, authError: true, errorType: 'auth_error' };
      }
      
      await updateKeyUsage(apiKey, false, false, false);
      throw new Error(`eBay Browse API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    // NEW: Pass allowed category IDs to prevent unwanted items
    const allowedCategoryIds = searchParams.typeSpecificFilters?.leafCategoryId ? 
      [searchParams.typeSpecificFilters.leafCategoryId] : [];
    
    const items = parseEbayBrowseResponse(data, allowedCategoryIds);
    
    await updateKeyUsage(apiKey, true, false, false);
    console.log(`Successfully used API key "${apiKey.label}" - found ${items.length} items`);
    
    return { items, success: true, rateLimited: false, authError: false };
  } catch (error: any) {
    console.error(`Error with API key "${apiKey.label}":`, error);
    await updateKeyUsage(apiKey, false, false, false);
    throw error;
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const searchParams: SearchRequest = await req.json();
    console.log('🔍 eBay search request params:', JSON.stringify(searchParams, null, 2));

    if (searchParams.testKey) {
      console.log('🧪 Testing specific API key set:', searchParams.testKey.app_id.substring(0, 10) + '...');
      const testKey: EbayApiKey = {
        label: 'Test Key Set',
        app_id: searchParams.testKey.app_id,
        dev_id: searchParams.testKey.dev_id,
        cert_id: searchParams.testKey.cert_id
      };
      
      const result = await tryApiKeyRequest(testKey, searchParams);
      
      let message = '';
      let status = 200;
      
      if (result.success) {
        message = `✅ Test successful! Found ${result.items.length} items using eBay Browse API with applied filters`;
        status = 200;
      } else if (result.rateLimited) {
        message = `⏳ API key is rate limited by eBay. Daily limits reset at midnight Pacific Time. Try again later or add more API key sets.`;
        status = 429;
      } else if (result.authError) {
        if (result.errorType === 'oauth_error') {
          message = `🔒 OAuth authentication failed. Please verify your eBay Client ID (App ID) and Client Secret (Cert ID) are correct and active in production environment.`;
        } else {
          message = `🔒 Authentication failed. Please verify your eBay API credentials are correct and active.`;
        }
        status = 401;
      } else {
        message = `❌ Test failed. Check your API key configuration.`;
        status = 500;
      }
      
      return new Response(JSON.stringify({ 
        success: result.success, 
        items: result.items,
        rateLimited: result.rateLimited,
        authError: result.authError,
        totalResults: result.items.length,
        message,
        keyUsed: 'Test Key Set',
        errorType: result.errorType,
        apiVersion: 'Browse API v1 (OAuth)',
        appliedFilters: {
          listingType: searchParams.listingType,
          itemType: searchParams.itemType,
          typeSpecificFilters: searchParams.typeSpecificFilters,
          condition: searchParams.condition
        },
        troubleshooting: result.rateLimited ? {
          issue: 'eBay API Rate Limit',
          solution: 'Add more eBay API key sets from different developer accounts',
          resetTime: 'Midnight Pacific Time (daily reset)',
          recommendation: 'Each eBay developer account gets separate daily limits'
        } : result.authError ? {
          issue: 'OAuth Authentication Error',
          solution: 'Verify API credentials in eBay Developer Console',
          checkList: [
            'Client ID (App ID) is correct',
            'Client Secret (Cert ID) is correct', 
            'Keys are for Production environment',
            'Browse API is enabled in your eBay app settings'
          ]
        } : null
      }), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const apiKeys = await getAvailableApiKeys();
    
    if (apiKeys.length === 0) {
      throw new Error('No eBay API keys configured. Please add API keys in Settings > eBay API Keys.');
    }

    console.log(`🔑 Found ${apiKeys.length} configured API keys`);

    const { data: settingsData } = await supabase
      .from('settings')
      .select('value_json')
      .eq('key', 'ebay_keys')
      .single();
    
    const rotationStrategy = settingsData?.value_json?.rotation_strategy || 'round_robin';

    let lastError: any = null;
    let rateLimitedCount = 0;
    let authErrorCount = 0;
    const triedKeys = new Set<string>();

    for (let attempt = 0; attempt < apiKeys.length; attempt++) {
      const availableKeys = apiKeys.filter(key => !triedKeys.has(key.app_id));
      
      if (availableKeys.length === 0) {
        break;
      }

      const selectedKey = selectApiKey(availableKeys, rotationStrategy);
      
      if (!selectedKey) {
        throw new Error('No API keys available for use');
      }

      triedKeys.add(selectedKey.app_id);

      try {
        console.log(`🎯 Attempt ${attempt + 1}: Using API key "${selectedKey.label}"`);
        const result = await tryApiKeyRequest(selectedKey, searchParams);
        
        if (result.success) {
          return new Response(JSON.stringify({ 
            success: true, 
            items: result.items,
            totalResults: result.items.length,
            message: `Successfully found ${result.items.length} items using eBay Browse API with applied filters`,
            keyUsed: selectedKey.label,
            apiStatus: 'healthy',
            apiVersion: 'Browse API v1 (OAuth)',
            appliedFilters: {
              listingType: searchParams.listingType,
              itemType: searchParams.itemType,
              typeSpecificFilters: searchParams.typeSpecificFilters,
              maxPrice: searchParams.maxPrice,
              conditions: searchParams.condition
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        
        if (result.rateLimited) {
          rateLimitedCount++;
          console.log(`⏳ API key "${selectedKey.label}" is rate limited, trying next key...`);
          continue;
        }
        
        if (result.authError) {
          authErrorCount++;
          console.log(`🔒 API key "${selectedKey.label}" has authentication issues, trying next key...`);
          continue;
        }
        
      } catch (error: any) {
        console.error(`❌ Failed with API key "${selectedKey.label}":`, error);
        lastError = error;
        continue;
      }
    }

    if (rateLimitedCount === apiKeys.length) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'All eBay API keys are currently rate limited.',
        rateLimited: true,
        items: [],
        message: '⏳ All your eBay API keys have hit their daily limits. Limits reset at midnight Pacific Time.',
        recommendation: 'Add more API key sets from different eBay developer accounts to increase capacity.',
        apiVersion: 'Browse API v1 (OAuth)',
        troubleshooting: {
          issue: 'All API Keys Rate Limited',
          solution: 'Add API keys from different eBay developer accounts',
          resetTime: 'Midnight Pacific Time (daily reset)',
          currentKeys: apiKeys.length,
          suggestion: 'Each developer account gets separate daily limits'
        }
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (authErrorCount > 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `${authErrorCount} of ${apiKeys.length} API keys have authentication issues.`,
        items: [],
        message: '🔒 Some API keys have OAuth authentication problems. Please verify your credentials.',
        recommendation: 'Check your eBay API credentials in Settings > eBay API Keys.',
        apiVersion: 'Browse API v1 (OAuth)',
        troubleshooting: {
          issue: 'OAuth Authentication Errors',
          solution: 'Verify API credentials in eBay Developer Console',
          affectedKeys: authErrorCount,
          totalKeys: apiKeys.length,
          checkList: [
            'Client ID (App ID) is correct',
            'Client Secret (Cert ID) is correct',
            'Keys are for Production environment',
            'Browse API is enabled in your eBay app settings'
          ]
        }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    throw lastError || new Error('All API keys failed');

  } catch (error: any) {
    console.error('💥 Error in eBay search function:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        items: [],
        message: '❌ ' + error.message,
        recommendation: error.message.includes('No eBay API keys') ? 
          'Configure eBay API keys in Settings > eBay API Keys.' :
          'Check eBay API configuration and network connectivity.',
        apiVersion: 'Browse API v1 (OAuth)',
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
