
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const ebayAppId = Deno.env.get('EBAY_APP_ID');
    if (!ebayAppId) {
      throw new Error('EBAY_APP_ID not configured');
    }

    // Jewelry & Watches category IDs
    const categories = [
      { id: '281', name: 'Fine Jewelry' },
      { id: '164', name: 'Watches' },
      { id: '10968', name: 'Loose Diamonds & Gemstones' }
    ];

    console.log('Starting eBay aspects cache refresh...');

    for (const category of categories) {
      try {
        console.log(`Fetching aspects for category: ${category.name} (${category.id})`);
        
        const ebayUrl = `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${category.id}`;
        const ebayResponse = await fetch(ebayUrl, {
          headers: {
            'Authorization': `Bearer ${ebayAppId}`,
            'Content-Type': 'application/json',
          },
        });

        if (!ebayResponse.ok) {
          console.error(`eBay API error for category ${category.id}:`, ebayResponse.status);
          continue;
        }

        const aspectsData = await ebayResponse.json();
        const aspects = aspectsData.aspects || [];

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
            console.error(`Error caching aspect ${aspectName}:`, error);
          }
        }

        console.log(`Cached ${aspects.length} aspects for ${category.name}`);
      } catch (error) {
        console.error(`Error processing category ${category.name}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'eBay aspects cache refreshed',
        timestamp: new Date().toISOString()
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
