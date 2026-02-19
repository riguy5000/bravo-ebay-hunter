import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  // Get ALL records with no time filter
  const { data, count } = await supabase
    .from('api_usage')
    .select('*', { count: 'exact' })
    .order('called_at', { ascending: false })
    .limit(10);

  console.log('Total records in api_usage:', count);
  console.log('\nLatest 10 records:');
  if (data) {
    for (const row of data) {
      console.log('  ' + row.called_at + ' | ' + row.api_key_label + ' | ' + row.call_type + ' | ' + (row.source || 'null'));
    }
  }

  // Now check with 24h filter
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  console.log('\nCutoff time for 24h filter:', cutoff);
  console.log('Current time:', new Date().toISOString());

  const { data: recent, count: recentCount } = await supabase
    .from('api_usage')
    .select('*', { count: 'exact' })
    .gte('called_at', cutoff)
    .limit(5);

  console.log('\nRecords in last 24h:', recentCount);
  if (recent && recent.length > 0) {
    console.log('Sample:', recent[0]);
  }

  // Count by call_type overall
  const { data: allData } = await supabase
    .from('api_usage')
    .select('call_type');

  if (allData) {
    const byType: Record<string, number> = {};
    for (const row of allData) {
      const type = row.call_type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    }
    console.log('\nAll-time calls by type:');
    for (const [type, cnt] of Object.entries(byType)) {
      console.log('  ' + type + ': ' + cnt);
    }
  }

  process.exit(0);
})();
