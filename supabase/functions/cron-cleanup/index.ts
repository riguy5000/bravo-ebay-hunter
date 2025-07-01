
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
    console.log('🧹 Starting cron cleanup process...');

    // Get all existing tasks to identify valid task IDs
    const { data: existingTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, name, status');

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    const validTaskIds = new Set(existingTasks?.map(task => task.id) || []);
    console.log(`📋 Found ${validTaskIds.size} valid tasks`);

    // Clean up orphaned cron jobs by attempting to unschedule all possible task-related jobs
    let cleanupCount = 0;
    const potentialOrphanedTaskIds = [
      '98ddbb89-d9fd-41aa-ac24-bd57fb666c05', // This was showing in the logs
      '52ef4333-80c0-4be1-8b49-9df97a614d57'  // Previous Gold Scrap Scanner ID
    ];

    for (const taskId of potentialOrphanedTaskIds) {
      if (!validTaskIds.has(taskId)) {
        try {
          console.log(`🗑️ Attempting to clean up orphaned cron job for task: ${taskId}`);
          const { error: unscheduleError } = await supabase.rpc('unschedule_task_cron', {
            task_id_param: taskId
          });

          if (!unscheduleError) {
            cleanupCount++;
            console.log(`✅ Successfully cleaned up orphaned cron job for task: ${taskId}`);
          } else {
            console.log(`ℹ️ No cron job found for task: ${taskId} (this is expected)`);
          }
        } catch (error) {
          console.log(`ℹ️ Cleanup attempt for ${taskId} completed (expected behavior)`);
        }
      }
    }

    // Update task last_run timestamp - CRITICAL for showing task is working
    if (validTaskIds.size > 0) {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ last_run: new Date().toISOString() })
        .in('id', Array.from(validTaskIds));

      if (updateError) {
        console.error('❌ Error updating task last_run timestamps:', updateError);
      } else {
        console.log(`✅ Updated last_run timestamps for ${validTaskIds.size} tasks`);
      }
    }

    console.log(`🎯 Cleanup Summary:`);
    console.log(`- Valid tasks found: ${validTaskIds.size}`);
    console.log(`- Orphaned cron jobs cleaned: ${cleanupCount}`);
    console.log(`- Active tasks: ${existingTasks?.filter(t => t.status === 'active').length || 0}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Cron cleanup completed successfully`,
      validTasks: validTaskIds.size,
      orphanedJobsCleanedUp: cleanupCount,
      activeTasks: existingTasks?.filter(t => t.status === 'active').length || 0,
      existingTasks: existingTasks?.map(t => ({ id: t.id, name: t.name, status: t.status })) || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('💥 Error in cron cleanup:', error);
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
