
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
    const errorText = await tokenResponse.text();
    console.error('eBay OAuth error:', tokenResponse.status, errorText);
    throw new Error(`eBay OAuth failed: ${tokenResponse.status} - ${errorText}`);
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

    // Start with just one working category to test
    const categories = [
      { id: '31387', name: 'Luxury Watches' }, // Start with this known working category
      // We'll add more categories once this works:
      // { id: '164330', name: 'Fine Rings' },
      // { id: '164331', name: 'Fine Necklaces & Pendants' },
      // { id: '10207', name: 'Loose Diamonds' },
      // { id: '51089', name: 'Loose Gemstones (Non-Diamond)' }
    ];

    console.log('Starting eBay aspects cache refresh...');
    let totalProcessed = 0;

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
          
          // Try to parse the error response
          try {
            const errorJson = JSON.parse(errorText);
            console.error('eBay API error details:', errorJson);
          } catch (e) {
            console.error('Could not parse eBay error response');
          }
          continue;
        }

        const aspectsData = await ebayResponse.json();
        console.log(`Raw eBay response for ${category.name}:`, JSON.stringify(aspectsData, null, 2));
        
        const aspects = aspectsData.aspects || [];
        console.log(`Processing ${aspects.length} aspects for ${category.name}`);

        if (aspects.length === 0) {
          console.warn(`No aspects found for category ${category.name} (${category.id})`);
          continue;
        }

        // Process and cache each aspect
        for (const aspect of aspects) {
          const aspectName = aspect.localizedAspectName;
          const values = aspect.aspectValues?.map((v: any) => ({
            value: v.localizedValue,
            meaning: v.valueMeaning || v.localizedValue
          })) || [];

          console.log(`Caching aspect: ${aspectName} with ${values.length} values`);

          // Upsert aspect data - note: we're not using the brand column
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
            console.error('Error details:', JSON.stringify(error, null, 2));
          } else {
            console.log(`Successfully cached aspect: ${aspectName}`);
            totalProcessed++;
          }
        }

        console.log(`Successfully processed ${aspects.length} aspects for ${category.name}`);
      } catch (error) {
        console.error(`Error processing category ${category.name}:`, error);
      }
    }

    // Check what was actually inserted
    const { data: insertedAspects, error: selectError } = await supabaseClient
      .from('ebay_aspects')
      .select('category_id, aspect_name, values_json')
      .order('category_id, aspect_name');

    if (selectError) {
      console.error('Error checking inserted aspects:', selectError);
    } else {
      console.log(`Total aspects in database: ${insertedAspects?.length || 0}`);
      console.log('Sample aspects:', insertedAspects?.slice(0, 3));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'eBay aspects cache refreshed',
        timestamp: new Date().toISOString(),
        categories_processed: categories.length,
        total_aspects_processed: totalProcessed,
        aspects_in_db: insertedAspects?.length || 0
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
        timestamp: new Date().toISOString(),
        details: error.stack
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
