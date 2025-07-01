
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

interface CronRequest {
  action: 'schedule' | 'unschedule' | 'schedule-metal-prices';
  taskId?: string;
  pollInterval?: number;
  metalInterval?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, taskId, pollInterval, metalInterval }: CronRequest = await req.json();
    
    console.log(`🔧 Cron manager called: ${action}${taskId ? ` for task ${taskId}` : ''}`);

    if (action === 'schedule-metal-prices') {
      // Schedule metal price fetching (separate from eBay tasks)
      const interval = metalInterval || 86400; // Default to daily
      console.log(`🥇 Scheduling metal price cron job with interval ${interval}s`);
      
      const { data, error } = await supabase.rpc('schedule_task_cron', {
        task_id_param: 'metal-prices', // Use a fixed ID for metal prices
        poll_interval_param: interval
      });

      if (error) {
        console.error('❌ Error scheduling metal price cron job:', error);
        throw error;
      }

      console.log('✅ Metal price cron job scheduled with ID:', data);
      
      return new Response(JSON.stringify({ 
        success: true, 
        cronJobId: data,
        message: `Metal price cron job scheduled with ${interval}s interval`,
        type: 'metal-prices'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!taskId) {
      throw new Error('Task ID is required for eBay task scheduling');
    }

    if (action === 'schedule') {
      const interval = pollInterval || 300; // Default to 5 minutes
      console.log(`📅 Scheduling cron job for task ${taskId} with interval ${interval}s`);
      
      const { data, error } = await supabase.rpc('schedule_task_cron', {
        task_id_param: taskId,
        poll_interval_param: interval
      });

      if (error) {
        console.error('❌ Error scheduling cron job:', error);
        throw error;
      }

      console.log('✅ Cron job scheduled with ID:', data);
      
      return new Response(JSON.stringify({ 
        success: true, 
        cronJobId: data,
        message: `eBay task cron job scheduled with ${interval}s interval`,
        type: 'ebay-task'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });

    } else if (action === 'unschedule') {
      console.log(`🗑️ Unscheduling cron job for task ${taskId}`);
      
      const { error } = await supabase.rpc('unschedule_task_cron', {
        task_id_param: taskId
      });

      if (error) {
        console.error('❌ Error unscheduling cron job:', error);
        throw error;
      }

      console.log('✅ Cron job unscheduled successfully');
      
      return new Response(JSON.stringify({ 
        success: true,
        message: 'eBay task cron job unscheduled successfully',
        type: 'ebay-task'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error('💥 Error in cron manager:', error);
    
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
