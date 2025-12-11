
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

interface TaxonomyRequest {
  categoryId: string;
}

const getOAuthToken = async (appId: string, certId: string): Promise<string> => {
  console.log(`Getting OAuth token for taxonomy API...`);
  
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

  const tokenData = await response.json();
  console.log('OAuth token obtained successfully for taxonomy');
  
  return tokenData.access_token;
};

const getApiKey = async () => {
  const { data, error } = await supabase
    .from('settings')
    .select('value_json')
    .eq('key', 'ebay_keys')
    .single();

  if (error || !data) {
    const fallbackAppId = Deno.env.get('EBAY_APP_ID');
    const fallbackCertId = Deno.env.get('EBAY_CERT_ID');
    
    if (fallbackAppId && fallbackCertId) {
      return { app_id: fallbackAppId, cert_id: fallbackCertId };
    }
    throw new Error('No eBay API keys configured');
  }

  const config = data.value_json as { keys: any[] };
  const firstKey = config.keys?.[0];
  
  if (!firstKey) {
    throw new Error('No eBay API keys available');
  }

  return { app_id: firstKey.app_id, cert_id: firstKey.cert_id };
};

const fetchTaxonomyAspects = async (categoryId: string, accessToken: string) => {
  const url = `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`;

  console.log(`Fetching taxonomy aspects for category ${categoryId}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Taxonomy API error: ${response.status} ${response.statusText} - ${errorText}`);
    throw new Error(`Taxonomy API failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`Taxonomy API response: ${data.aspects?.length || 0} aspects found`);
  
  return data;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { categoryId }: TaxonomyRequest = await req.json();
    
    if (!categoryId) {
      throw new Error('Category ID is required');
    }

    console.log(`Processing taxonomy request for category: ${categoryId}`);

    // Check if this is a synthetic/merged category ID (not a real eBay category)
    if (categoryId.includes('_merged') || !/^\d+$/.test(categoryId)) {
      console.log(`Skipping API call for synthetic category: ${categoryId}, returning cached data if available`);
      
      // Try to return cached data for synthetic categories
      const { data: cachedData } = await supabase
        .from('ebay_aspects')
        .select('*')
        .eq('category_id', categoryId)
        .order('aspect_name');
      
      if (cachedData && cachedData.length > 0) {
        return new Response(JSON.stringify({ 
          success: true,
          categoryId,
          aspects: cachedData.map(a => ({
            aspect_name: a.aspect_name,
            values_json: a.values_json,
            refreshed_at: a.refreshed_at
          })),
          totalAspects: cachedData.length,
          message: `Returned ${cachedData.length} cached aspects for synthetic category ${categoryId}`
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      
      // No cached data - return empty but successful response
      return new Response(JSON.stringify({ 
        success: true,
        categoryId,
        aspects: [],
        totalAspects: 0,
        message: `No cached data available for synthetic category ${categoryId}`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get API credentials
    const apiKey = await getApiKey();
    
    // Get OAuth token
    const accessToken = await getOAuthToken(apiKey.app_id, apiKey.cert_id);
    
    // Fetch taxonomy data from eBay
    const taxonomyData = await fetchTaxonomyAspects(categoryId, accessToken);
    
    // Process and cache the aspects
    const aspects = [];
    
    if (taxonomyData.aspects) {
      for (const aspect of taxonomyData.aspects) {
        const aspectData = {
          category_id: categoryId,
          aspect_name: aspect.localizedAspectName || aspect.aspectName || 'Unknown',
          values_json: aspect.aspectValues?.map((v: any) => ({
            value: v.localizedValue || v.value || '',
            meaning: v.localizedValue || v.value || ''
          })) || []
        };
        
        aspects.push(aspectData);
      }
      
      // Clear existing data for this category
      await supabase
        .from('ebay_aspects')
        .delete()
        .eq('category_id', categoryId);
      
      // Insert fresh data
      if (aspects.length > 0) {
        const { error: insertError } = await supabase
          .from('ebay_aspects')
          .insert(aspects);
          
        if (insertError) {
          console.error('Error caching taxonomy data:', insertError);
        } else {
          console.log(`Cached ${aspects.length} aspects for category ${categoryId}`);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      categoryId,
      aspects: aspects.map(a => ({
        aspect_name: a.aspect_name,
        values_json: a.values_json,
        refreshed_at: new Date().toISOString()
      })),
      totalAspects: aspects.length,
      message: `Successfully fetched and cached ${aspects.length} aspects for category ${categoryId}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in taxonomy function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        message: 'Failed to fetch taxonomy data'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
