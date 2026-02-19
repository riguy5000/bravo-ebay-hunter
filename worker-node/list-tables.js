const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listTables() {
  // Get all tables by trying to query each potential table
  const potentialTables = [
    'tasks', 'api_usage', 'rejected_items', 'matches_jewelry', 'matches_gemstone',
    'matches_watch', 'item_cache', 'users', 'profiles', 'logs', 'worker_logs',
    'error_logs', 'notifications', 'slack_messages', 'audit_log', 'activity_log',
    'events', 'job_logs', 'cron_logs', 'api_logs', 'request_logs', 'debug_logs',
    'system_events', 'worker_events', 'task_logs', 'search_logs', 'match_logs'
  ];

  console.log('Checking for tables...\n');

  const foundTables = [];

  for (const table of potentialTables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      foundTables.push(table);
      const cols = data && data[0] ? Object.keys(data[0]) : [];
      console.log('✓ ' + table);
      console.log('  Columns: ' + cols.join(', '));

      // Check if any column looks like it could contain errors/logs
      const logCols = cols.filter(c =>
        c.includes('error') || c.includes('log') || c.includes('message') ||
        c.includes('level') || c.includes('status') || c.includes('event')
      );
      if (logCols.length > 0) {
        console.log('  ** Potential log columns: ' + logCols.join(', '));
      }
      console.log('');
    }
  }

  console.log('\n=== Found ' + foundTables.length + ' tables ===');
}

listTables();
