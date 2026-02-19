import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  console.log('📊 Checking for active cron jobs...\n');

  // Check cron.job table (pg_cron)
  const { data: cronJobs, error } = await supabase
    .from('cron.job')
    .select('*');

  if (error) {
    console.log('Could not query cron.job directly:', error.message);
    console.log('\nTrying to check via RPC or other tables...');
  } else if (cronJobs && cronJobs.length > 0) {
    console.log('Active cron jobs:');
    for (const job of cronJobs) {
      console.log('  -', job.jobname || job.name, '|', job.schedule, '|', job.command?.substring(0, 100));
    }
  }

  // Check if there's a task_cron_jobs table or similar
  const { data: taskCrons } = await supabase
    .from('task_cron_jobs')
    .select('*');

  if (taskCrons && taskCrons.length > 0) {
    console.log('\nTask cron jobs:');
    for (const job of taskCrons) {
      console.log('  -', JSON.stringify(job));
    }
  }

  // Check tasks table for any cron-related fields
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, name, status, poll_interval, cron_job_id')
    .eq('status', 'active');

  if (tasks && tasks.length > 0) {
    console.log('\nActive tasks with cron info:');
    for (const task of tasks) {
      console.log('  -', task.name, '| poll_interval:', task.poll_interval, '| cron_job_id:', task.cron_job_id || 'none');
    }
  }

  process.exit(0);
})();
