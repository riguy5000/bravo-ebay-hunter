
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🥇 Metal price scheduler started');

    // Get the metal fetch interval from settings (default to 24 hours = 86400 seconds)
    const { data: settingData, error: settingError } = await supabase
      .from('settings')
      .select('value_json')
      .eq('key', 'metal_fetch_interval')
      .single();

    if (settingError && settingError.code !== 'PGRST116') {
      console.error('Error fetching metal fetch interval:', settingError);
    }

    const intervalSeconds = settingData?.value_json ? parseInt(settingData.value_json as string) : 86400; // 24 hours default
    console.log(`🕐 Metal fetch interval: ${intervalSeconds} seconds (${intervalSeconds / 3600} hours)`);

    // Check the last update from the metal_prices table
    const { data: lastPriceData, error: lastPriceError } = await supabase
      .from('metal_prices')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    let shouldUpdate = true;
    
    if (!lastPriceError && lastPriceData) {
      const lastUpdateTime = new Date(lastPriceData.updated_at);
      const now = new Date();
      const timeSinceUpdate = (now.getTime() - lastUpdateTime.getTime()) / 1000;
      
      if (timeSinceUpdate < intervalSeconds) {
        console.log(`⏰ Metal prices were updated ${Math.round(timeSinceUpdate)} seconds ago, skipping update`);
        shouldUpdate = false;
      }
    } else {
      console.log('📊 No cached prices found, will fetch fresh data');
    }

    if (!shouldUpdate) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Metal prices are up to date',
        lastUpdate: lastPriceData?.updated_at,
        nextUpdate: new Date(Date.now() + (intervalSeconds * 1000) - (Date.now() - new Date(lastPriceData?.updated_at || 0).getTime())),
        intervalSeconds
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Fetch current gold prices using the get-gold-prices function
    console.log('📊 Fetching current gold prices...');
    
    const { data: goldData, error: goldError } = await supabase.functions.invoke('get-gold-prices');

    if (goldError) {
      console.error('❌ Error fetching gold prices:', goldError);
      throw new Error(`Failed to fetch gold prices: ${goldError.message}`);
    }

    console.log('✅ Gold prices updated successfully');

    // Update the last update timestamp in settings
    await supabase
      .from('settings')
      .upsert({
        key: 'last_metal_price_update',
        value_json: new Date().toISOString(),
        description: 'Timestamp of the last metal price update'
      });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Metal prices updated successfully',
      goldData,
      intervalSeconds,
      nextUpdate: new Date(Date.now() + intervalSeconds * 1000)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('💥 Error in metal price scheduler:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
