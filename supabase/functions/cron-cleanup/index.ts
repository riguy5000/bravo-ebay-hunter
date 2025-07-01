
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
    console.log('🧹 Starting aggressive cron cleanup process...');

    // STEP 1: Get all existing tasks to identify what should be scheduled
    const { data: existingTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, name, status, poll_interval');

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    const activeTasks = existingTasks?.filter(task => task.status === 'active') || [];
    console.log(`📋 Found ${existingTasks?.length || 0} total tasks, ${activeTasks.length} active`);

    // STEP 2: Aggressively clean up ALL existing cron jobs first
    let cleanupCount = 0;
    
    // List of all possible task IDs that might have cron jobs (from logs and current tasks)
    const allPossibleTaskIds = [
      '98ddbb89-d9fd-41aa-ac24-bd57fb666c05', // From logs
      '52ef4333-80c0-4be1-8b49-9df97a614d57', // From logs  
      'a8de30eb-cbdc-4860-861d-8f122f43cea1', // Current Gold Scrap Scanner
      ...(existingTasks?.map(task => task.id) || []) // All current tasks
    ];

    // Remove duplicates
    const uniqueTaskIds = [...new Set(allPossibleTaskIds)];
    
    console.log(`🗑️ Attempting to clean up cron jobs for ${uniqueTaskIds.length} potential task IDs...`);

    for (const taskId of uniqueTaskIds) {
      try {
        console.log(`🗑️ Cleaning up cron job for task: ${taskId}`);
        const { error: unscheduleError } = await supabase.rpc('unschedule_task_cron', {
          task_id_param: taskId
        });

        if (!unscheduleError) {
          cleanupCount++;
          console.log(`✅ Successfully cleaned up cron job for task: ${taskId}`);
        } else {
          console.log(`ℹ️ No cron job found for task: ${taskId} (expected for some)`);
        }
      } catch (error) {
        console.log(`ℹ️ Cleanup attempt for ${taskId} completed`);
      }
    }

    // STEP 3: Wait a moment for cleanup to take effect
    console.log('⏳ Waiting 2 seconds for cleanup to take effect...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // STEP 4: Clear cron_job_id from all tasks to reset state
    if (existingTasks && existingTasks.length > 0) {
      const { error: resetError } = await supabase
        .from('tasks')
        .update({ cron_job_id: null })
        .in('id', existingTasks.map(task => task.id));

      if (resetError) {
        console.error('❌ Error resetting cron_job_id:', resetError);
      } else {
        console.log(`✅ Reset cron_job_id for all ${existingTasks.length} tasks`);
      }
    }

    // STEP 5: Update last_run timestamp for all tasks to prevent immediate re-scheduling
    if (existingTasks && existingTasks.length > 0) {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ last_run: new Date().toISOString() })
        .in('id', existingTasks.map(task => task.id));

      if (updateError) {
        console.error('❌ Error updating task last_run timestamps:', updateError);
      } else {
        console.log(`✅ Updated last_run timestamps for ${existingTasks.length} tasks`);
      }
    }

    console.log(`🎯 AGGRESSIVE Cleanup Summary:`);
    console.log(`- Total tasks found: ${existingTasks?.length || 0}`);
    console.log(`- Active tasks: ${activeTasks.length}`);
    console.log(`- Cron jobs cleaned: ${cleanupCount}`);
    console.log(`- Task states reset: ${existingTasks?.length || 0}`);
    console.log(`🚫 ALL CRON JOBS STOPPED - eBay API rate limiting should resolve in 1-2 minutes`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Aggressive cleanup completed - ALL cron jobs stopped`,
      totalTasks: existingTasks?.length || 0,
      activeTasks: activeTasks.length,
      cronJobsCleaned: cleanupCount,
      tasksReset: existingTasks?.length || 0,
      recommendation: "Wait 2-3 minutes before testing eBay API to allow rate limits to reset",
      existingTasks: existingTasks?.map(t => ({ id: t.id, name: t.name, status: t.status })) || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('💥 Error in aggressive cron cleanup:', error);
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
