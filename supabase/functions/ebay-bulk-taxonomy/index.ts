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

// Complete category mapping - JEWELRY, WATCHES, GEMS/DIAMONDS
const ALL_CATEGORIES = {
  'Jewelry - Fine Categories': {
    'Fine Rings': '164343',
    'Fine Necklaces & Pendants': '164329', 
    'Fine Earrings': '164321',
    'Fine Bracelets': '10968',
    'Brooches & Pins': '50692',
    'Charms / Charm Bracelets': '140956',
    'Body Jewellery': '103428'
  },
  'Jewelry - Fashion Categories': {
    'Fashion Rings': '50647',
    'Fashion Necklaces & Pendants': '155101',
    'Fashion Earrings': '155099',
    'Fashion Bracelets': '155100'
  },
  'Jewelry - Men\'s Categories': {
    'Men\'s Rings': '102888',
    'Men\'s Necklaces': '102890',
    'Men\'s Bracelets': '102889',
    'Men\'s Cufflinks': '102891'
  },
  'Jewelry - Wedding Categories': {
    'Engagement Rings': '92947',
    'Wedding Bands': '91452'
  },
  'Jewelry - Vintage': {
    'Vintage Fine Jewellery': '48579'
  },
  'Jewelry - Metal-only': {
    'Gold Jewellery': '67705',
    'Silver Jewellery': '4191',
    'Platinum Jewellery': '164329'
  },
  'Watches - All Categories': {
    'Wristwatches': '31387',
    'Pocket Watches': '7376',
    'Watch Parts & Accessories': '14324'
  },
  'Gems/Diamonds - Loose Stones': {
    'Loose Gemstones': '262027',
    'Loose Diamonds': '164394'  // Common category for loose diamonds
  }
};

const getOAuthToken = async (appId: string, certId: string): Promise<string> => {
  console.log(`Getting OAuth token for bulk taxonomy...`);
  
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
    console.error(`Taxonomy API error for ${categoryId}: ${response.status} ${response.statusText} - ${errorText}`);
    return null; // Return null instead of throwing to continue processing other categories
  }

  const data = await response.json();
  console.log(`Category ${categoryId}: ${data.aspects?.length || 0} aspects found`);
  
  // Special logging for diamond-related categories
  if (categoryId === '164394') {
    console.log(`LOOSE DIAMONDS (164394) - Full response:`, JSON.stringify(data, null, 2));
    const gemstoneTypeAspect = data.aspects?.find((a: any) => 
      (a.localizedAspectName || a.aspectName || '').toLowerCase().includes('gemstone type') ||
      (a.localizedAspectName || a.aspectName || '').toLowerCase().includes('stone type') ||
      (a.localizedAspectName || a.aspectName || '').toLowerCase().includes('type')
    );
    if (gemstoneTypeAspect) {
      console.log(`LOOSE DIAMONDS - Gemstone Type aspect found:`, JSON.stringify(gemstoneTypeAspect, null, 2));
    } else {
      console.log(`LOOSE DIAMONDS - No gemstone type aspect found. All aspects:`, 
        data.aspects?.map((a: any) => a.localizedAspectName || a.aspectName));
    }
  }
  
  return data;
};

const mergeAspectValues = (existingValues: any[], newValues: any[]) => {
  const valueMap = new Map();
  
  // Add existing values
  existingValues.forEach(v => {
    valueMap.set(v.value, v);
  });
  
  // Add new values (this will overwrite duplicates, keeping the latest)
  newValues.forEach(v => {
    valueMap.set(v.value, v);
  });
  
  return Array.from(valueMap.values()).sort((a, b) => a.value.localeCompare(b.value));
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting bulk taxonomy collection for all jewelry categories...');

    // Get API credentials
    const apiKey = await getApiKey();
    const accessToken = await getOAuthToken(apiKey.app_id, apiKey.cert_id);
    
    // Collect all category IDs
    const allCategories: string[] = [];
    Object.values(ALL_CATEGORIES).forEach(categoryGroup => {
      Object.values(categoryGroup).forEach(categoryId => {
        if (!allCategories.includes(categoryId)) {
          allCategories.push(categoryId);
        }
      });
    });

    console.log(`Processing ${allCategories.length} unique categories (jewelry + watches + gems)...`);
    
    // Collect all aspects across categories
    const aspectsMap = new Map<string, { values: any[], categories: string[] }>();
    let totalProcessed = 0;
    let successCount = 0;
    
    for (const categoryId of allCategories) {
      try {
        const taxonomyData = await fetchTaxonomyAspects(categoryId, accessToken);
        totalProcessed++;
        
        if (taxonomyData?.aspects) {
          successCount++;
          
          for (const aspect of taxonomyData.aspects) {
            const aspectName = aspect.localizedAspectName || aspect.aspectName || 'Unknown';
            const aspectValues = aspect.aspectValues?.map((v: any) => ({
              value: v.localizedValue || v.value || '',
              meaning: v.localizedValue || v.value || ''
            })) || [];
            
            if (aspectsMap.has(aspectName)) {
              const existing = aspectsMap.get(aspectName)!;
              existing.values = mergeAspectValues(existing.values, aspectValues);
              existing.categories.push(categoryId);
            } else {
              aspectsMap.set(aspectName, {
                values: aspectValues,
                categories: [categoryId]
              });
            }
          }
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error processing category ${categoryId}:`, error);
        totalProcessed++;
      }
    }

    console.log(`Processed ${totalProcessed} categories, ${successCount} successful`);
    console.log(`Found ${aspectsMap.size} unique aspects`);
    
    // Ensure Diamond is included in Gemstone Type for gems
    const gemstoneTypeAspect = aspectsMap.get('Gemstone Type');
    if (gemstoneTypeAspect) {
      const hasDiamond = gemstoneTypeAspect.values.some(v => v.value.toLowerCase().includes('diamond'));
      if (!hasDiamond) {
        console.log('Adding missing Diamond to Gemstone Type aspect');
        gemstoneTypeAspect.values.push({
          value: 'Diamond',
          meaning: 'Diamond'
        });
        // Re-sort the values
        gemstoneTypeAspect.values.sort((a, b) => a.value.localeCompare(b.value));
      }
    } else {
      console.log('Creating new Gemstone Type aspect with Diamond');
      aspectsMap.set('Gemstone Type', {
        values: [{ value: 'Diamond', meaning: 'Diamond' }],
        categories: ['164394', '262027'] // Add to both loose diamond and gemstone categories
      });
    }
    
    // Ensure Platinum and Palladium are included in Metal aspect for jewelry
    const metalAspect = aspectsMap.get('Metal');
    if (metalAspect) {
      const hasPlatinum = metalAspect.values.some(v => v.value === 'Platinum');
      const hasPalladium = metalAspect.values.some(v => v.value === 'Palladium');
      
      if (!hasPlatinum) {
        console.log('Adding missing Platinum to Metal aspect');
        metalAspect.values.push({
          value: 'Platinum',
          meaning: 'Platinum'
        });
      }
      
      if (!hasPalladium) {
        console.log('Adding missing Palladium to Metal aspect');
        metalAspect.values.push({
          value: 'Palladium',
          meaning: 'Palladium'
        });
      }
      
      // Re-sort the values if we added any
      if (!hasPlatinum || !hasPalladium) {
        metalAspect.values.sort((a, b) => a.value.localeCompare(b.value));
      }
    }
    
    // Store aspects properly categorized
    const aspectsToStore = [];
    
    // Define category sets for proper separation
    const jewelryCategories = new Set([
      '164343', '164329', '164321', '10968', '50692', '140956', '103428', // Fine jewelry
      '50647', '155101', '155099', '155100', // Fashion jewelry  
      '102888', '102890', '102889', '102891', // Men's jewelry
      '92947', '91452', // Wedding jewelry
      '48579', // Vintage jewelry
      '67705', '4191', '164329' // Metal-only jewelry
    ]);
    
    const watchCategories = new Set(['31387', '7376', '14324']);
    const gemCategories = new Set(['262027', '164394']);
    
    for (const [aspectName, aspectData] of aspectsMap.entries()) {
      const categories = new Set(aspectData.categories);
      
      // Only store in jewelry_merged if it comes from jewelry categories
      if (aspectData.categories.some(cat => jewelryCategories.has(cat))) {
        aspectsToStore.push({
          category_id: 'jewelry_merged',
          aspect_name: aspectName,
          values_json: aspectData.values
        });
      }
      
      // Only store in watches_merged if it comes from watch categories
      if (aspectData.categories.some(cat => watchCategories.has(cat))) {
        aspectsToStore.push({
          category_id: 'watches_merged',
          aspect_name: aspectName,
          values_json: aspectData.values
        });
      }
      
      // Only store in gems_merged if it comes from gem categories
      if (aspectData.categories.some(cat => gemCategories.has(cat))) {
        aspectsToStore.push({
          category_id: 'gems_merged',
          aspect_name: aspectName,
          values_json: aspectData.values
        });
      }
    }
    
    if (aspectsToStore.length > 0) {
      // Clear existing merged data
      await supabase
        .from('ebay_aspects')
        .delete()
        .in('category_id', ['jewelry_merged', 'watches_merged', 'gems_merged']);
      
      // Insert merged data in batches
      const batchSize = 100;
      for (let i = 0; i < aspectsToStore.length; i += batchSize) {
        const batch = aspectsToStore.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('ebay_aspects')
          .insert(batch);
          
        if (insertError) {
          console.error(`Error inserting batch ${i}-${i + batchSize}:`, insertError);
        }
      }
      
      console.log(`Stored ${aspectsToStore.length} merged aspects`);
    }

    // Get Metal aspect for response
    const metalAspect = aspectsMap.get('Metal');
    const metalCount = metalAspect?.values?.length || 0;
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `Comprehensive aspect collection completed for jewelry, watches, and gems`,
      stats: {
        categoriesProcessed: totalProcessed,
        categoriesSuccessful: successCount,
        uniqueAspects: aspectsMap.size,
        aspectsStored: aspectsToStore.length,
        metalOptionsFound: metalCount,
        jewelryCategories: Object.values(ALL_CATEGORIES['Jewelry - Fine Categories']).length + 
                          Object.values(ALL_CATEGORIES['Jewelry - Fashion Categories']).length,
        watchCategories: Object.values(ALL_CATEGORIES['Watches - All Categories']).length,
        gemCategories: Object.values(ALL_CATEGORIES['Gems/Diamonds - Loose Stones']).length
      },
      metalOptions: metalAspect?.values?.map(v => v.value) || [],
      categoriesCollected: {
        jewelry: Object.keys(ALL_CATEGORIES).filter(k => k.startsWith('Jewelry')).length,
        watches: Object.keys(ALL_CATEGORIES).filter(k => k.startsWith('Watches')).length,
        gems: Object.keys(ALL_CATEGORIES).filter(k => k.startsWith('Gems')).length
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in bulk taxonomy function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        message: 'Failed to perform bulk taxonomy collection'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
