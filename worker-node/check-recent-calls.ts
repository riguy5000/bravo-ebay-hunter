import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  console.log('📊 Recent API calls (last 2 hours):\n');

  const { data: usage } = await supabase
    .from('api_usage')
    .select('*')
    .gte('called_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('called_at', { ascending: false })
    .limit(50);

  if (!usage || usage.length === 0) {
    console.log('No calls logged in last 2 hours');
  } else {
    console.log('Time (UTC)'.padEnd(12) + 'Key'.padEnd(10) + 'Source'.padEnd(12) + 'Type'.padEnd(15) + 'Endpoint');
    console.log('-'.repeat(85));

    for (const row of usage) {
      const time = row.called_at.slice(11, 19);
      const key = (row.api_key_label || '?').padEnd(10);
      const source = (row.source || 'unknown').padEnd(12);
      const type = (row.call_type || 'unknown').padEnd(15);
      const endpoint = row.endpoint || '-';
      console.log(`${time.padEnd(12)}${key}${source}${type}${endpoint}`);
    }

    // Summary by source
    console.log('\n📊 Calls by source (last 2h):');
    const bySource: Record<string, number> = {};
    for (const row of usage) {
      const source = row.source || 'unknown';
      bySource[source] = (bySource[source] || 0) + 1;
    }
    for (const [source, count] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${source}: ${count}`);
    }

    // Summary by key
    console.log('\n📊 Calls by key (last 2h):');
    const byKey: Record<string, number> = {};
    for (const row of usage) {
      const key = row.api_key_label || 'unknown';
      byKey[key] = (byKey[key] || 0) + 1;
    }
    for (const [key, count] of Object.entries(byKey).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${key}: ${count}`);
    }
  }

  // Also check Supabase Edge Function logs if possible
  console.log('\n💡 To see Edge Function logs, run:');
  console.log('   npx supabase functions logs ebay-search --project-ref hzinvalidlnlhindttbu');

  process.exit(0);
})();
