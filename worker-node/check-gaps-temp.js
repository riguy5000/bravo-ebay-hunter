const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // User said 10 PM on 2/1/2026
  // Assuming US timezone: 10 PM EST = 03:00 UTC on 2/2, 10 PM PST = 06:00 UTC on 2/2
  // Let's check 12 hours before and after midnight UTC on 2/2

  console.log('Checking API usage around Feb 1-2, 2026...');
  console.log('');

  // Get counts by hour for Feb 1 and Feb 2
  const startTime = '2026-02-01T12:00:00Z';  // Noon UTC Feb 1
  const endTime = '2026-02-02T12:00:00Z';    // Noon UTC Feb 2

  // Query in batches by hour to work around row limits
  const hours = [];
  let current = new Date(startTime);
  const end = new Date(endTime);

  while (current < end) {
    const hourStart = current.toISOString();
    current = new Date(current.getTime() + 60 * 60 * 1000);
    const hourEnd = current.toISOString();

    const { count } = await supabase
      .from('api_usage')
      .select('*', { count: 'exact', head: true })
      .gte('called_at', hourStart)
      .lt('called_at', hourEnd);

    hours.push({ hour: hourStart.slice(0, 13), count: count || 0 });
  }

  console.log('Hour (UTC)      | API Calls');
  console.log('-'.repeat(35));

  for (const h of hours) {
    const bar = '#'.repeat(Math.min(50, Math.floor((h.count || 0) / 20)));
    console.log(h.hour.padEnd(16) + '| ' + String(h.count).padEnd(6) + bar);
  }

  // Find gaps
  console.log('');
  console.log('=== GAPS (0 calls) ===');
  let inGap = false;
  let gapStart = null;

  for (const h of hours) {
    if (h.count === 0) {
      if (!inGap) {
        gapStart = h.hour;
        inGap = true;
      }
    } else {
      if (inGap) {
        console.log('GAP: ' + gapStart + ' to ' + h.hour);
        inGap = false;
      }
    }
  }
  if (inGap) {
    console.log('GAP: ' + gapStart + ' to END');
  }

  // Also check tasks table
  console.log('');
  console.log('=== Task polling status ===');
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, name, last_poll_at, status')
    .order('last_poll_at', { ascending: false })
    .limit(5);

  if (tasks) {
    tasks.forEach(t => {
      console.log('  ' + (t.name || 'unnamed').substring(0, 30).padEnd(32) + '| ' + t.last_poll_at + ' | ' + t.status);
    });
  }
}

main();
