
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
  action: 'schedule' | 'unschedule';
  taskId: string;
  pollInterval?: number;
}

const scheduleCronJob = async (taskId: string, pollInterval: number) => {
  console.log(`📅 Scheduling cron job for task ${taskId} with interval ${pollInterval}s`);
  
  try {
    const { data, error } = await supabase.rpc('schedule_task_cron', {
      task_id_param: taskId,
      poll_interval_param: pollInterval
    });

    if (error) {
      console.error('Error scheduling cron job:', error);
      throw error;
    }

    console.log(`✅ Cron job scheduled with ID: ${data}`);
    return data;
  } catch (error) {
    console.error('Failed to schedule cron job:', error);
    throw error;
  }
};

const unscheduleCronJob = async (taskId: string) => {
  console.log(`🗑️ Unscheduling cron job for task ${taskId}`);
  
  try {
    const { error } = await supabase.rpc('unschedule_task_cron', {
      task_id_param: taskId
    });

    if (error) {
      console.error('Error unscheduling cron job:', error);
      throw error;
    }

    console.log(`✅ Cron job unscheduled for task ${taskId}`);
  } catch (error) {
    console.error('Failed to unschedule cron job:', error);
    throw error;
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, taskId, pollInterval }: CronRequest = await req.json();
    
    console.log(`🔧 Cron manager called: ${action} for task ${taskId}`);

    if (!taskId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Task ID is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let cronJobId = null;

    if (action === 'schedule') {
      if (!pollInterval) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Poll interval is required for scheduling' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      
      cronJobId = await scheduleCronJob(taskId, pollInterval);
      
      // Update the task with the cron job ID
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ cron_job_id: cronJobId })
        .eq('id', taskId);

      if (updateError) {
        console.error('Error updating task with cron job ID:', updateError);
        // Try to clean up the cron job if task update fails
        await unscheduleCronJob(taskId).catch(console.error);
        throw updateError;
      }
    } else if (action === 'unschedule') {
      await unscheduleCronJob(taskId);
      
      // Clear the cron job ID from the task
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ cron_job_id: null })
        .eq('id', taskId);

      if (updateError) {
        console.error('Error clearing cron job ID from task:', updateError);
        throw updateError;
      }
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid action. Must be "schedule" or "unschedule"' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Task ${action}d successfully`,
      cronJobId: cronJobId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('💥 Error in cron manager:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
