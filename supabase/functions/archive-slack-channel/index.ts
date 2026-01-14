import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArchiveRequest {
  channelId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channelId } = await req.json() as ArchiveRequest;

    if (!channelId) {
      return new Response(
        JSON.stringify({ success: false, error: 'channelId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const slackBotToken = Deno.env.get('SLACK_BOT_TOKEN');
    if (!slackBotToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'SLACK_BOT_TOKEN not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`📦 Archiving Slack channel: ${channelId}`);

    const response = await fetch('https://slack.com/api/conversations.archive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${slackBotToken}`
      },
      body: JSON.stringify({ channel: channelId })
    });

    const result = await response.json();

    if (!result.ok) {
      // already_archived is fine
      if (result.error === 'already_archived') {
        console.log(`ℹ️ Channel ${channelId} was already archived`);
        return new Response(
          JSON.stringify({ success: true, message: 'Channel was already archived' }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      console.error(`❌ Failed to archive channel: ${result.error}`);
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`✅ Successfully archived Slack channel: ${channelId}`);
    return new Response(
      JSON.stringify({ success: true, message: 'Channel archived successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('💥 Error archiving Slack channel:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
