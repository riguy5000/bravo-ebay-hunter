
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

interface CleanupRequest {
  action?: 'cleanup-orphaned' | 'cleanup-all';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let requestBody: CleanupRequest = {};
    try {
      requestBody = await req.json();
    } catch {
      // No body provided, use default behavior
    }

    const action = requestBody.action || 'cleanup-all';
    console.log(`🧹 Starting cron cleanup process (action: ${action})...`);

    // STEP 0: Find all task-related cron jobs from cron.job table
    const { data: cronJobs, error: cronError } = await supabase.rpc('get_task_cron_jobs');

    if (cronError) {
      console.log('Note: Could not query cron.job table directly, using fallback method');
    } else {
      console.log(`📋 Found ${cronJobs?.length || 0} task-related cron jobs in database`);
    }

    // STEP 1: Get all existing tasks to identify what should be scheduled
    const { data: existingTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, name, status, poll_interval');

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    const existingTaskIds = new Set(existingTasks?.map(task => task.id) || []);
    const activeTasks = existingTasks?.filter(task => task.status === 'active') || [];
    console.log(`📋 Found ${existingTasks?.length || 0} total tasks, ${activeTasks.length} active`);

    // STEP 2: Build list of task IDs to clean up
    let taskIdsToCleanup: string[] = [];
    let orphanedTaskIds: string[] = [];

    // If we got cron jobs from the database, extract task IDs from job names
    if (cronJobs && cronJobs.length > 0) {
      for (const job of cronJobs) {
        // Job names are like "task_9c900f0e-f64c-43f1-a6f4-a8316fc1da62"
        const match = job.jobname?.match(/^task_(.+)$/);
        if (match) {
          const taskId = match[1];
          if (!existingTaskIds.has(taskId)) {
            orphanedTaskIds.push(taskId);
            console.log(`🔍 Found orphaned cron job for deleted task: ${taskId}`);
          }
          taskIdsToCleanup.push(taskId);
        }
      }
    }

    // For cleanup-orphaned action, only clean up orphaned jobs
    // For cleanup-all action, clean up everything
    if (action === 'cleanup-orphaned') {
      taskIdsToCleanup = orphanedTaskIds;
      console.log(`🎯 Cleanup-orphaned: Will remove ${orphanedTaskIds.length} orphaned cron jobs`);
    } else {
      // Add all existing task IDs to ensure we clean everything
      taskIdsToCleanup = [...new Set([...taskIdsToCleanup, ...(existingTasks?.map(task => task.id) || [])])];
      console.log(`🗑️ Cleanup-all: Will attempt to clean up ${taskIdsToCleanup.length} cron jobs`);
    }

    let cleanupCount = 0;

    for (const taskId of taskIdsToCleanup) {
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

    console.log(`🎯 Cleanup Summary (${action}):`);
    console.log(`- Total tasks in database: ${existingTasks?.length || 0}`);
    console.log(`- Active tasks: ${activeTasks.length}`);
    console.log(`- Orphaned cron jobs found: ${orphanedTaskIds.length}`);
    console.log(`- Cron jobs cleaned: ${cleanupCount}`);
    if (action === 'cleanup-all') {
      console.log(`- Task states reset: ${existingTasks?.length || 0}`);
    }
    console.log(`✅ Cleanup completed successfully`);

    return new Response(JSON.stringify({
      success: true,
      action,
      message: action === 'cleanup-orphaned'
        ? `Cleaned up ${cleanupCount} orphaned cron jobs`
        : `Aggressive cleanup completed - ${cleanupCount} cron jobs stopped`,
      totalTasks: existingTasks?.length || 0,
      activeTasks: activeTasks.length,
      orphanedJobsFound: orphanedTaskIds.length,
      orphanedTaskIds,
      cronJobsCleaned: cleanupCount,
      tasksReset: action === 'cleanup-all' ? (existingTasks?.length || 0) : 0,
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
