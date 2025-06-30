
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

    // Categories for all item types: jewelry, gemstones, and watches
    const categories = [
      // Jewelry categories (verified working)
      { id: '164330', name: 'Fine Rings', type: 'jewelry' },
      { id: '164331', name: 'Fine Necklaces & Pendants', type: 'jewelry' },
      { id: '164332', name: 'Fine Earrings', type: 'jewelry' },
      { id: '164333', name: 'Fine Bracelets', type: 'jewelry' },
      
      // Gemstone categories (to be verified)
      { id: '10207', name: 'Loose Diamonds', type: 'gemstone' },
      { id: '51089', name: 'Loose Gemstones (Non-Diamond)', type: 'gemstone' },
      
      // Watch category (to be verified)
      { id: '31387', name: 'Luxury Watches/Wristwatches', type: 'watch' }
    ];

    console.log('Starting eBay aspects cache refresh for all categories...');
    let totalProcessed = 0;
    let totalInserted = 0;
    let errors = [];
    let successfulCategories = [];

    // First, clear existing data for these categories to avoid conflicts
    console.log('Clearing existing aspects data...');
    const categoryIds = categories.map(c => c.id);
    const { error: deleteError } = await supabaseClient
      .from('ebay_aspects')
      .delete()
      .in('category_id', categoryIds);
    
    if (deleteError) {
      console.error('Error clearing existing data:', deleteError);
    } else {
      console.log('Existing data cleared successfully');
    }

    for (const category of categories) {
      try {
        console.log(`Fetching aspects for ${category.type}: ${category.name} (${category.id})`);
        
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
          console.error(`eBay API error for ${category.type} category ${category.id}:`, ebayResponse.status, errorText);
          errors.push(`${category.type} Category ${category.id} (${category.name}): ${ebayResponse.status} - ${errorText}`);
          continue;
        }

        const aspectsData = await ebayResponse.json();
        console.log(`eBay API response for ${category.name}:`, {
          hasAspects: !!aspectsData.aspects,
          aspectCount: aspectsData.aspects?.length || 0
        });
        
        const aspects = aspectsData.aspects || [];
        
        if (aspects.length === 0) {
          console.warn(`No aspects found for ${category.type} category ${category.name} (${category.id})`);
          continue;
        }

        console.log(`Processing ${aspects.length} aspects for ${category.type}: ${category.name}`);

        // Process aspects in batches to avoid conflicts
        const aspectsToInsert = [];
        for (const aspect of aspects) {
          const aspectName = aspect.localizedAspectName;
          const values = aspect.aspectValues?.map((v: any) => ({
            value: v.localizedValue,
            meaning: v.valueMeaning || v.localizedValue
          })) || [];

          aspectsToInsert.push({
            category_id: category.id,
            aspect_name: aspectName,
            values_json: values,
            refreshed_at: new Date().toISOString()
          });

          totalProcessed++;
        }

        // Insert all aspects for this category at once
        if (aspectsToInsert.length > 0) {
          console.log(`Inserting ${aspectsToInsert.length} aspects for ${category.type}: ${category.name}`);
          const { data, error } = await supabaseClient
            .from('ebay_aspects')
            .insert(aspectsToInsert);

          if (error) {
            console.error(`Database error inserting aspects for ${category.type}: ${category.name}:`, error);
            errors.push(`Database error for ${category.type} ${category.name}: ${error.message}`);
          } else {
            console.log(`Successfully inserted ${aspectsToInsert.length} aspects for ${category.type}: ${category.name}`);
            totalInserted += aspectsToInsert.length;
            successfulCategories.push(`${category.type}: ${category.name}`);
          }
        }

      } catch (error) {
        console.error(`Error processing ${category.type} category ${category.name}:`, error);
        errors.push(`${category.type} Category ${category.name}: ${error.message}`);
      }
    }

    // Verify what was actually inserted
    const { data: insertedAspects, error: selectError } = await supabaseClient
      .from('ebay_aspects')
      .select('category_id, aspect_name')
      .in('category_id', categoryIds)
      .order('category_id, aspect_name');

    if (selectError) {
      console.error('Error checking inserted aspects:', selectError);
    } else {
      console.log(`Database verification: ${insertedAspects?.length || 0} total aspects stored`);
      
      // Log summary by category
      const categoryStats = insertedAspects?.reduce((acc: any, row: any) => {
        const category = categories.find(c => c.id === row.category_id);
        const key = category ? `${category.type}: ${category.name}` : row.category_id;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      console.log('Aspects per category:', categoryStats);
    }

    const response = {
      success: totalInserted > 0,
      message: totalInserted > 0 ? 'eBay aspects cache refreshed successfully' : 'No aspects were cached',
      timestamp: new Date().toISOString(),
      categories_processed: categories.length,
      successful_categories: successfulCategories,
      total_aspects_processed: totalProcessed,
      total_aspects_inserted: totalInserted,
      aspects_in_db: insertedAspects?.length || 0,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('Final response:', response);

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: totalInserted > 0 ? 200 : 207 // 207 Multi-Status if partial success
      }
    );

  } catch (error) {
    console.error('eBay aspects cache error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
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
