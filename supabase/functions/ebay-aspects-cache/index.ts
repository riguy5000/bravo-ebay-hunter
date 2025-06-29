
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EbayAspect {
  localizedAspectName: string;
  aspectValues?: Array<{
    localizedValue: string;
    valueMeaning?: string;
  }>;
}

// Function to get eBay OAuth token
async function getEbayOAuthToken(): Promise<string> {
  const ebayAppId = Deno.env.get('EBAY_APP_ID');
  const ebayDevId = Deno.env.get('EBAY_DEV_ID');
  const ebayCertId = Deno.env.get('EBAY_CERT_ID');

  if (!ebayAppId || !ebayDevId || !ebayCertId) {
    throw new Error('eBay credentials not configured');
  }

  // Create the OAuth credentials string
  const credentials = btoa(`${ebayAppId}:${ebayCertId}`);
  
  const tokenUrl = 'https://api.ebay.com/identity/v1/oauth2/token';
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });

  if (!tokenResponse.ok) {
    console.error('eBay OAuth error:', tokenResponse.status, await tokenResponse.text());
    throw new Error(`eBay OAuth failed: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get OAuth token for eBay API
    console.log('Getting eBay OAuth token...');
    const accessToken = await getEbayOAuthToken();
    console.log('eBay OAuth token obtained successfully');

    // Complete jewelry categories with proper IDs
    const categories = [
      { id: '281', name: 'Fine Jewelry' },
      { id: '31387', name: 'Luxury Watches' },
      { id: '10207', name: 'Loose Diamonds' },
      { id: '51089', name: 'Loose Gemstones (Non-Diamond)' }
    ];

    console.log('Starting eBay aspects cache refresh...');

    for (const category of categories) {
      try {
        console.log(`Fetching aspects for category: ${category.name} (${category.id})`);
        
        const ebayUrl = `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${category.id}`;
        const ebayResponse = await fetch(ebayUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          },
        });

        if (!ebayResponse.ok) {
          const errorText = await ebayResponse.text();
          console.error(`eBay API error for category ${category.id}:`, ebayResponse.status, errorText);
          continue;
        }

        const aspectsData = await ebayResponse.json();
        const aspects = aspectsData.aspects || [];

        console.log(`Processing ${aspects.length} aspects for ${category.name}`);

        // Process and cache each aspect
        for (const aspect of aspects) {
          const aspectName = aspect.localizedAspectName;
          const values = aspect.aspectValues?.map((v: any) => ({
            value: v.localizedValue,
            meaning: v.valueMeaning || v.localizedValue
          })) || [];

          // Upsert aspect data
          const { error } = await supabaseClient
            .from('ebay_aspects')
            .upsert({
              category_id: category.id,
              aspect_name: aspectName,
              values_json: values,
              refreshed_at: new Date().toISOString()
            }, {
              onConflict: 'category_id,aspect_name',
              ignoreDuplicates: false
            });

          if (error) {
            console.error(`Error caching aspect ${aspectName} for category ${category.id}:`, error);
          }
        }

        console.log(`Successfully cached ${aspects.length} aspects for ${category.name}`);
      } catch (error) {
        console.error(`Error processing category ${category.name}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'eBay aspects cache refreshed for all jewelry categories',
        timestamp: new Date().toISOString(),
        categories_processed: categories.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('eBay aspects cache error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
