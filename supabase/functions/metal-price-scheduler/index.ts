
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

    // Get the metal fetch interval from settings
    const { data: settingData, error: settingError } = await supabase
      .from('settings')
      .select('value_json')
      .eq('key', 'metal_fetch_interval')
      .single();

    if (settingError) {
      console.error('Error fetching metal fetch interval:', settingError);
      // Default to daily if setting not found
    }

    const intervalSeconds = settingData?.value_json ? parseInt(settingData.value_json as string) : 86400;
    console.log(`🕐 Metal fetch interval: ${intervalSeconds} seconds (${intervalSeconds / 3600} hours)`);

    // Check if we need to update metal prices based on the last update
    const { data: lastUpdate, error: lastUpdateError } = await supabase
      .from('settings')
      .select('value_json, updated_at')
      .eq('key', 'last_metal_price_update')
      .single();

    let shouldUpdate = true;
    
    if (!lastUpdateError && lastUpdate) {
      const lastUpdateTime = new Date(lastUpdate.updated_at);
      const now = new Date();
      const timeSinceUpdate = (now.getTime() - lastUpdateTime.getTime()) / 1000;
      
      if (timeSinceUpdate < intervalSeconds) {
        console.log(`⏰ Metal prices were updated ${Math.round(timeSinceUpdate)} seconds ago, skipping update`);
        shouldUpdate = false;
      }
    }

    if (!shouldUpdate) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Metal prices are up to date',
        lastUpdate: lastUpdate?.updated_at,
        nextUpdate: new Date(Date.now() + (intervalSeconds * 1000) - (Date.now() - new Date(lastUpdate?.updated_at || 0).getTime())),
        intervalSeconds
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Fetch current gold prices
    console.log('📊 Fetching current gold prices...');
    
    const { data: goldData, error: goldError } = await supabase.functions.invoke('get-gold-prices');

    if (goldError) {
      console.error('❌ Error fetching gold prices:', goldError);
      throw new Error(`Failed to fetch gold prices: ${goldError.message}`);
    }

    console.log('✅ Gold prices updated successfully:', goldData);

    // Update the last update timestamp
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
