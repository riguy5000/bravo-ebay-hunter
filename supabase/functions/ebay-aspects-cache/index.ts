
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

// Function to verify if a category is a valid leaf category
async function verifyCategoryIsLeaf(categoryId: string, accessToken: string): Promise<boolean> {
  try {
    const url = `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=${categoryId}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    });

    if (!response.ok) {
      console.error(`Category verification failed for ${categoryId}:`, response.status);
      return false;
    }

    const data = await response.json();
    const category = data.categorySubtree;
    
    // A leaf category has no children
    const isLeaf = !category.childCategoryTreeNodes || category.childCategoryTreeNodes.length === 0;
    console.log(`Category ${categoryId} (${category.category?.categoryName}) is ${isLeaf ? 'LEAF' : 'NON-LEAF'}`);
    
    return isLeaf;
  } catch (error) {
    console.error(`Error verifying category ${categoryId}:`, error);
    return false;
  }
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

    console.log('Getting eBay OAuth token...');
    const accessToken = await getEbayOAuthToken();
    console.log('eBay OAuth token obtained successfully');

    // Expanded list of categories to get comprehensive aspect data
    const categories = [
      // Fine Jewelry categories (verified working)
      { id: '164330', name: 'Fine Rings', type: 'jewelry' },
      { id: '164331', name: 'Fine Necklaces & Pendants', type: 'jewelry' },
      { id: '164332', name: 'Fine Earrings', type: 'jewelry' },
      { id: '164333', name: 'Fine Bracelets', type: 'jewelry' },
      { id: '164334', name: 'Fine Brooches & Pins', type: 'jewelry' },
      
      // Fashion Jewelry categories (for more variety)
      { id: '45077', name: 'Fashion Rings', type: 'jewelry' },
      { id: '45080', name: 'Fashion Necklaces & Pendants', type: 'jewelry' },
      { id: '45081', name: 'Fashion Earrings', type: 'jewelry' },
      { id: '45079', name: 'Fashion Bracelets', type: 'jewelry' },
      
      // Gemstone categories (to be verified)
      { id: '10207', name: 'Loose Diamonds', type: 'gemstone' },
      { id: '51089', name: 'Loose Gemstones (Non-Diamond)', type: 'gemstone' },
      
      // Watch categories
      { id: '31387', name: 'Luxury Watches/Wristwatches', type: 'watch' },
      { id: '14324', name: 'Casual Watches', type: 'watch' },
      
      // Additional jewelry categories for more comprehensive data
      { id: '164336', name: 'Fine Charms & Charm Bracelets', type: 'jewelry' },
      { id: '164338', name: 'Fine Body Jewelry', type: 'jewelry' },
    ];

    console.log('Starting eBay aspects cache refresh for all categories...');
    let totalProcessed = 0;
    let totalInserted = 0;
    let errors = [];
    let successfulCategories = [];
    let verificationResults = [];

    // First, verify which categories are valid leaf categories
    console.log('Verifying category validity...');
    for (const category of categories) {
      const isLeaf = await verifyCategoryIsLeaf(category.id, accessToken);
      verificationResults.push({
        ...category,
        isLeaf,
        verified: isLeaf
      });
    }

    // Filter to only work with verified leaf categories
    const validCategories = verificationResults.filter(cat => cat.verified);
    console.log(`Found ${validCategories.length} valid leaf categories out of ${categories.length} total`);

    // Clear existing data for valid categories
    console.log('Clearing existing aspects data...');
    const validCategoryIds = validCategories.map(c => c.id);
    if (validCategoryIds.length > 0) {
      const { error: deleteError } = await supabaseClient
        .from('ebay_aspects')
        .delete()
        .in('category_id', validCategoryIds);
      
      if (deleteError) {
        console.error('Error clearing existing data:', deleteError);
      } else {
        console.log('Existing data cleared successfully');
      }
    }

    // Process each valid category
    for (const category of validCategories) {
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

        // Log aspect names for debugging
        const aspectNames = aspects.map((asp: any) => asp.localizedAspectName);
        console.log(`Aspect names for ${category.name}:`, aspectNames);

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
            values_json: values as any,
            refreshed_at: new Date().toISOString()
          });

          totalProcessed++;
        }

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

    // Verify what was actually inserted and get aspect summary
    const { data: insertedAspects, error: selectError } = await supabaseClient
      .from('ebay_aspects')
      .select('category_id, aspect_name, values_json')
      .in('category_id', validCategoryIds)
      .order('category_id, aspect_name');

    if (selectError) {
      console.error('Error checking inserted aspects:', selectError);
    } else {
      console.log(`Database verification: ${insertedAspects?.length || 0} total aspects stored`);
      
      // Create comprehensive aspect summary
      const aspectSummary: Record<string, Set<string>> = {};
      
      insertedAspects?.forEach((row: any) => {
        const aspectName = row.aspect_name;
        const values = row.values_json || [];
        
        if (!aspectSummary[aspectName]) {
          aspectSummary[aspectName] = new Set();
        }
        
        values.forEach((valueObj: any) => {
          if (valueObj && valueObj.value) {
            aspectSummary[aspectName].add(valueObj.value);
          }
        });
      });

      // Convert sets to arrays for response
      const aspectLists: Record<string, string[]> = {};
      Object.keys(aspectSummary).forEach(aspectName => {
        aspectLists[aspectName] = Array.from(aspectSummary[aspectName]).sort();
      });

      console.log('Comprehensive aspect summary:', aspectLists);
    }

    const response = {
      success: totalInserted > 0,
      message: totalInserted > 0 ? 'eBay aspects cache refreshed successfully' : 'No aspects were cached',
      timestamp: new Date().toISOString(),
      categories_attempted: categories.length,
      categories_verified: validCategories.length,
      successful_categories: successfulCategories,
      total_aspects_processed: totalProcessed,
      total_aspects_inserted: totalInserted,
      aspects_in_db: insertedAspects?.length || 0,
      category_verification: verificationResults,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('Final response:', response);

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: totalInserted > 0 ? 200 : 207
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
