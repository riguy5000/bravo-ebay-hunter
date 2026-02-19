import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  console.log('📊 Checking api_usage table breakdown...\n');

  // Get counts by call_type for last 24h
  const { data: usage } = await supabase
    .from('api_usage')
    .select('call_type, source')
    .gte('called_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (!usage || usage.length === 0) {
    console.log('No usage data in last 24 hours');
    process.exit(0);
  }

  // Count by call_type
  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  for (const row of usage) {
    const type = row.call_type || 'unknown';
    const source = row.source || 'unknown';
    byType[type] = (byType[type] || 0) + 1;
    bySource[source] = (bySource[source] || 0) + 1;
  }

  console.log('Calls by type (last 24h):');
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  console.log('\nCalls by source (last 24h):');
  for (const [source, count] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source}: ${count}`);
  }

  console.log(`\nTotal logged: ${usage.length}`);
  console.log(`\n⚠️  eBay shows 67,630 calls but we only logged ${usage.length}`);
  console.log(`   Missing: ~${67630 - usage.length} calls not logged!`);

  process.exit(0);
})();
