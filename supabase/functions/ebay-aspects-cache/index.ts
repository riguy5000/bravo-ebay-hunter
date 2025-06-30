
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

interface CategoryInfo {
  id: string;
  name: string;
  type: string;
  subcategories?: CategoryInfo[];
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

// Function to get subcategories for a given category with retry logic
async function getSubcategories(categoryId: string, accessToken: string, retries = 2): Promise<CategoryInfo[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
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
        if (attempt < retries) {
          console.warn(`Attempt ${attempt + 1} failed for subcategories of ${categoryId}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        console.error(`Failed to get subcategories for ${categoryId} after ${retries + 1} attempts:`, response.status);
        return [];
      }

      const data = await response.json();
      const category = data.categorySubtree;
      
      if (!category || !category.childCategoryTreeNodes) {
        return [];
      }

      const subcategories: CategoryInfo[] = [];
      for (const child of category.childCategoryTreeNodes) {
        if (child.category) {
          subcategories.push({
            id: child.category.categoryId,
            name: child.category.categoryName,
            type: 'subcategory'
          });
        }
      }

      console.log(`Found ${subcategories.length} subcategories for ${categoryId}`);
      return subcategories;
    } catch (error) {
      if (attempt < retries) {
        console.warn(`Attempt ${attempt + 1} failed for subcategories of ${categoryId}, retrying...`, error);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      console.error(`Error getting subcategories for ${categoryId} after ${retries + 1} attempts:`, error);
      return [];
    }
  }
  return [];
}

// Function to fetch aspects with retry logic
async function fetchAspectsWithRetry(categoryId: string, categoryName: string, accessToken: string, retries = 2): Promise<EbayAspect[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ebayUrl = `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`;
      const ebayResponse = await fetch(ebayUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
      });

      if (!ebayResponse.ok) {
        if (attempt < retries) {
          console.warn(`Attempt ${attempt + 1} failed for ${categoryName} (${categoryId}), retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        console.warn(`eBay API error for ${categoryName} (${categoryId}) after ${retries + 1} attempts: ${ebayResponse.status}`);
        return [];
      }

      const aspectsData = await ebayResponse.json();
      console.log(`eBay API response for ${categoryName}:`, {
        hasAspects: !!aspectsData.aspects,
        aspectCount: aspectsData.aspects?.length || 0
      });
      
      return aspectsData.aspects || [];
    } catch (error) {
      if (attempt < retries) {
        console.warn(`Attempt ${attempt + 1} failed for ${categoryName} (${categoryId}), retrying...`, error);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      console.error(`Error fetching aspects for ${categoryName} (${categoryId}) after ${retries + 1} attempts:`, error);
      return [];
    }
  }
  return [];
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

    // Comprehensive list of jewelry categories with focus on missing aspects
    const categories = [
      // Fine Jewelry - Core categories
      { id: '164330', name: 'Fine Rings', type: 'jewelry' },
      { id: '164331', name: 'Fine Necklaces & Pendants', type: 'jewelry' },
      { id: '164332', name: 'Fine Earrings', type: 'jewelry' },
      { id: '164333', name: 'Fine Bracelets', type: 'jewelry' },
      { id: '164334', name: 'Fine Brooches & Pins', type: 'jewelry' },
      { id: '164336', name: 'Fine Charms & Charm Bracelets', type: 'jewelry' },
      
      // Fashion Jewelry - Core categories
      { id: '45077', name: 'Fashion Rings', type: 'jewelry' },
      { id: '45080', name: 'Fashion Necklaces & Pendants', type: 'jewelry' },
      { id: '45081', name: 'Fashion Earrings', type: 'jewelry' },
      { id: '45079', name: 'Fashion Bracelets', type: 'jewelry' },
      { id: '45078', name: 'Fashion Pins & Brooches', type: 'jewelry' },
      
      // Men's Jewelry - Specific subcategories
      { id: '155123', name: 'Men\'s Jewelry', type: 'jewelry' },
      { id: '155124', name: 'Men\'s Rings', type: 'jewelry' },
      { id: '155125', name: 'Men\'s Necklaces', type: 'jewelry' },
      { id: '155126', name: 'Men\'s Bracelets', type: 'jewelry' },
      
      // Wedding & Engagement - High-value categories
      { id: '164395', name: 'Engagement Rings', type: 'jewelry' },
      { id: '164396', name: 'Wedding Bands', type: 'jewelry' },
      { id: '164397', name: 'Wedding Sets', type: 'jewelry' },
      
      // Vintage & Antique - Often have unique aspects
      { id: '48579', name: 'Vintage & Antique Jewelry', type: 'jewelry' },
      { id: '48580', name: 'Vintage Fine Jewelry', type: 'jewelry' },
      { id: '48581', name: 'Vintage Costume Jewelry', type: 'jewelry' },
      
      // Metal-specific categories (should have Metal Purity, Base Metal)
      { id: '164344', name: 'Gold Jewelry', type: 'jewelry' },
      { id: '164345', name: 'Silver Jewelry', type: 'jewelry' },
      { id: '164346', name: 'Platinum Jewelry', type: 'jewelry' },
      
      // Gemstone categories for missing stone aspects
      { id: '10207', name: 'Loose Diamonds', type: 'gemstone' },
      { id: '51089', name: 'Loose Gemstones (Non-Diamond)', type: 'gemstone' },
      
      // Watch categories
      { id: '31387', name: 'Luxury Watches/Wristwatches', type: 'watch' },
      { id: '14324', name: 'Casual Watches', type: 'watch' },
      { id: '31388', name: 'Men\'s Watches', type: 'watch' },
      { id: '31389', name: 'Women\'s Watches', type: 'watch' },
      
      // Additional specialized categories
      { id: '164338', name: 'Fine Body Jewelry', type: 'jewelry' },
      { id: '50647', name: 'Watches Parts & Accessories', type: 'watch' },
      { id: '281', name: 'Jewelry & Watches', type: 'jewelry' },
    ];

    console.log('Starting comprehensive eBay aspects cache refresh...');
    let totalProcessed = 0;
    let totalInserted = 0;
    let errors = [];
    let successfulCategories = [];
    let allCategoriesToProcess: CategoryInfo[] = [];

    // Collect all categories including their subcategories
    for (const category of categories) {
      allCategoriesToProcess.push(category);
      
      // Get subcategories for each main category (limited to avoid timeout)
      try {
        const subcategories = await getSubcategories(category.id, accessToken);
        // Add up to 3 subcategories per main category to avoid overwhelming the system
        for (const subcat of subcategories.slice(0, 3)) {
          allCategoriesToProcess.push({
            ...subcat,
            type: category.type
          });
        }
      } catch (error) {
        console.warn(`Failed to get subcategories for ${category.name}:`, error);
      }
    }

    console.log(`Processing ${allCategoriesToProcess.length} total categories (including subcategories)`);

    // Clear existing data for categories we're processing
    console.log('Clearing existing aspects data...');
    const categoryIds = allCategoriesToProcess.map(c => c.id);
    if (categoryIds.length > 0) {
      const { error: deleteError } = await supabaseClient
        .from('ebay_aspects')
        .delete()
        .in('category_id', categoryIds);
      
      if (deleteError) {
        console.error('Error clearing existing data:', deleteError);
      } else {
        console.log('Existing data cleared successfully');
      }
    }

    // Process each category
    for (const category of allCategoriesToProcess) {
      try {
        console.log(`Fetching aspects for ${category.type}: ${category.name} (${category.id})`);
        
        const aspects = await fetchAspectsWithRetry(category.id, category.name, accessToken);
        
        if (aspects.length === 0) {
          console.log(`No aspects found for ${category.type} category ${category.name} (${category.id})`);
          continue;
        }

        console.log(`Processing ${aspects.length} aspects for ${category.type}: ${category.name}`);

        const aspectsToInsert = [];
        for (const aspect of aspects) {
          const aspectName = aspect.localizedAspectName;
          const values = aspect.aspectValues?.map((v: any) => ({
            value: v.localizedValue,
            meaning: v.valueMeaning || v.localizedValue
          })) || [];

          if (values.length > 0) {
            aspectsToInsert.push({
              category_id: category.id,
              aspect_name: aspectName,
              values_json: values as any,
              refreshed_at: new Date().toISOString()
            });
            totalProcessed++;
          }
        }

        if (aspectsToInsert.length > 0) {
          console.log(`Inserting ${aspectsToInsert.length} aspects for ${category.type}: ${category.name}`);
          const { error } = await supabaseClient
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

    // Verify what was inserted and provide aspect summary
    const { data: insertedAspects, error: selectError } = await supabaseClient
      .from('ebay_aspects')
      .select('category_id, aspect_name, values_json')
      .order('category_id, aspect_name');

    if (selectError) {
      console.error('Error checking inserted aspects:', selectError);
    } else {
      console.log(`Database verification: ${insertedAspects?.length || 0} total aspects stored`);
      
      // Check for key missing aspects
      const aspectSummary: Record<string, Set<string>> = {};
      insertedAspects?.forEach((row: any) => {
        const aspectName = row.aspect_name;
        if (!aspectSummary[aspectName]) {
          aspectSummary[aspectName] = new Set();
        }
        const values = row.values_json || [];
        values.forEach((valueObj: any) => {
          if (valueObj && valueObj.value) {
            aspectSummary[aspectName].add(valueObj.value);
          }
        });
      });

      // Log key aspects we were looking for
      const keyAspects = ['Color', 'Metal', 'Metal Purity', 'Base Metal', 'Type', 'Style', 'Main Stone', 'Main Stone Color', 'Material', 'Condition', 'Brand'];
      keyAspects.forEach(aspect => {
        if (aspectSummary[aspect]) {
          console.log(`✓ Found ${aspect}: ${aspectSummary[aspect].size} values`);
        } else {
          console.log(`✗ Missing ${aspect}`);
        }
      });
    }

    const response = {
      success: totalInserted > 0,
      message: totalInserted > 0 ? 'eBay aspects cache refreshed successfully with comprehensive categories and subcategories' : 'No aspects were cached',
      timestamp: new Date().toISOString(),
      categories_attempted: allCategoriesToProcess.length,
      successful_categories: successfulCategories,
      total_aspects_processed: totalProcessed,
      total_aspects_inserted: totalInserted,
      aspects_in_db: insertedAspects?.length || 0,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
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
