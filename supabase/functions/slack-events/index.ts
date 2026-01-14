import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map emoji reactions to match status
const EMOJI_STATUS_MAP: Record<string, string> = {
  '+1': 'purchased',           // 👍
  'thumbsup': 'purchased',     // 👍
  'white_check_mark': 'purchased', // ✅
  'heavy_check_mark': 'purchased', // ✔️
  '-1': 'rejected',            // 👎
  'thumbsdown': 'rejected',    // 👎
  'x': 'rejected',             // ❌
  'eyes': 'watching',          // 👀
  'question': 'reviewing',     // ❓
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Handle Slack URL verification challenge
    if (body.type === 'url_verification') {
      console.log('🔐 Slack URL verification challenge received');
      return new Response(
        JSON.stringify({ challenge: body.challenge }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Handle event callbacks
    if (body.type === 'event_callback') {
      const event = body.event;

      // Only process reaction_added events
      if (event.type === 'reaction_added') {
        const { reaction, item } = event;
        const channelId = item.channel;
        const messageTs = item.ts;

        console.log(`👍 Reaction added: ${reaction} on message ${messageTs} in channel ${channelId}`);

        // Check if this emoji maps to a status
        const newStatus = EMOJI_STATUS_MAP[reaction];
        if (!newStatus) {
          console.log(`  ℹ️ Emoji "${reaction}" not mapped to any status, ignoring`);
          return new Response(
            JSON.stringify({ ok: true, message: 'Emoji not mapped' }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Try to find the match in jewelry table
        const { data: jewelryMatch, error: jewelryError } = await supabase
          .from('matches_jewelry')
          .select('id, status, ebay_title')
          .eq('slack_channel_id', channelId)
          .eq('slack_message_ts', messageTs)
          .single();

        if (jewelryMatch && !jewelryError) {
          console.log(`  📿 Found jewelry match: ${jewelryMatch.ebay_title?.substring(0, 40)}...`);

          const { error: updateError } = await supabase
            .from('matches_jewelry')
            .update({ status: newStatus })
            .eq('id', jewelryMatch.id);

          if (updateError) {
            console.error(`  ❌ Error updating jewelry match: ${updateError.message}`);
            return new Response(
              JSON.stringify({ ok: false, error: updateError.message }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }

          console.log(`  ✅ Updated jewelry match status to "${newStatus}"`);
          return new Response(
            JSON.stringify({ ok: true, table: 'matches_jewelry', status: newStatus }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Try to find the match in gemstone table
        const { data: gemstoneMatch, error: gemstoneError } = await supabase
          .from('matches_gemstone')
          .select('id, status, ebay_title')
          .eq('slack_channel_id', channelId)
          .eq('slack_message_ts', messageTs)
          .single();

        if (gemstoneMatch && !gemstoneError) {
          console.log(`  💎 Found gemstone match: ${gemstoneMatch.ebay_title?.substring(0, 40)}...`);

          const { error: updateError } = await supabase
            .from('matches_gemstone')
            .update({ status: newStatus })
            .eq('id', gemstoneMatch.id);

          if (updateError) {
            console.error(`  ❌ Error updating gemstone match: ${updateError.message}`);
            return new Response(
              JSON.stringify({ ok: false, error: updateError.message }),
              { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }

          console.log(`  ✅ Updated gemstone match status to "${newStatus}"`);
          return new Response(
            JSON.stringify({ ok: true, table: 'matches_gemstone', status: newStatus }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        console.log(`  ⚠️ No match found for channel ${channelId}, message ${messageTs}`);
        return new Response(
          JSON.stringify({ ok: true, message: 'No matching record found' }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // For any other event types, acknowledge receipt
    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('💥 Error handling Slack event:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
